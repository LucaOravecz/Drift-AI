import Anthropic from '@anthropic-ai/sdk'
import prisma from '@/lib/db'
import { createHash } from 'crypto'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

type ModelTier = 'flagship' | 'standard' | 'economy'

const MODEL_MAP: Record<ModelTier, string> = {
  flagship: 'claude-3-7-sonnet-20250219',
  standard: 'claude-3-5-sonnet-20241022',
  economy:  'claude-3-5-haiku-20241022',
}

const DEFAULT_TIER: ModelTier = 'standard'
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 500

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

let _client: Anthropic | null = null
function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _client
}

// ---------------------------------------------------------------------------
// Cost tracking helpers
// ---------------------------------------------------------------------------

const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  'claude-3-7-sonnet-20250219': { input: 3, output: 15 },
  'claude-3-5-sonnet-20241022':  { input: 3, output: 15 },
  'claude-3-5-haiku-20241022':   { input: 0.8, output: 4 },
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_MILLION[model] ?? COST_PER_MILLION['claude-3-5-sonnet-20241022']
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000
}

async function recordUsage(params: {
  organizationId: string
  userId?: string
  model: string
  feature: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  success: boolean
  errorMessage?: string
  requestId?: string
}) {
  const costUsd = estimateCost(params.model, params.inputTokens, params.outputTokens)
  await prisma.aiUsageRecord.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      model: params.model,
      feature: params.feature,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      costUsd,
      latencyMs: params.latencyMs,
      success: params.success,
      errorMessage: params.errorMessage,
      requestId: params.requestId,
    },
  }).catch(() => {
    // Never let usage recording failure break the caller
  })
}

// ---------------------------------------------------------------------------
// Retry with exponential backoff
// ---------------------------------------------------------------------------

type RetryableError = Anthropic.APIError

function isRetryable(err: unknown): err is RetryableError {
  if (err instanceof Anthropic.APIError) {
    return err.status === 429 || err.status === 500 || err.status === 502 || err.status === 503
  }
  return false
}

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isRetryable(err) || attempt === retries) throw err
      const delay = BASE_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 200
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastErr
}

// ---------------------------------------------------------------------------
// Model routing
// ---------------------------------------------------------------------------

export type FeatureRoute =
  | 'BRIEF_GENERATION'
  | 'OUTREACH_DRAFT'
  | 'COMPLIANCE_SCAN'
  | 'OPPORTUNITY_REASONING'
  | 'TAX_REASONING'
  | 'RESEARCH_MEMO'
  | 'CLIENT_SUMMARY'
  | 'SENTIMENT_ANALYSIS'
  | 'GENERAL'

const FEATURE_TIER: Record<FeatureRoute, ModelTier> = {
  BRIEF_GENERATION:     'standard',
  OUTREACH_DRAFT:       'standard',
  COMPLIANCE_SCAN:      'standard',
  OPPORTUNITY_REASONING:'flagship',
  TAX_REASONING:        'flagship',
  RESEARCH_MEMO:        'flagship',
  CLIENT_SUMMARY:       'economy',
  SENTIMENT_ANALYSIS:   'economy',
  GENERAL:              'standard',
}

function resolveModel(feature: FeatureRoute, override?: string): string {
  if (override) return override
  return MODEL_MAP[FEATURE_TIER[feature] ?? DEFAULT_TIER]
}

// ---------------------------------------------------------------------------
// Structured output via tool_use (replaces regex JSON parsing)
// ---------------------------------------------------------------------------

function buildJsonTool<T>(schema: Record<string, unknown>) {
  return {
    name: 'structured_output',
    description: 'Return structured data matching the provided schema.',
    input_schema: schema as Anthropic.Tool.InputSchema,
  } satisfies Anthropic.Tool
}

// ---------------------------------------------------------------------------
// Public API — callClaude (text response, with retry + tracking)
// ---------------------------------------------------------------------------

export interface CallClaudeOptions {
  feature?: FeatureRoute
  modelOverride?: string
  maxTokens?: number
  thinkingBudget?: number
  organizationId: string
  userId?: string
}

export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  options: CallClaudeOptions,
): Promise<string> {
  const model = resolveModel(options.feature ?? 'GENERAL', options.modelOverride)
  const maxTokens = options.maxTokens ?? 8192
  const startMs = Date.now()

  let inputTokens = 0
  let outputTokens = 0
  let requestId: string | undefined

  try {
    const message = await withRetry(() =>
      getClient().messages.create({
        model,
        max_tokens: maxTokens,
        ...(options.thinkingBudget ? {
          thinking: { type: 'enabled', budget_tokens: options.thinkingBudget },
        } : {}),
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    )

    inputTokens = message.usage.input_tokens
    outputTokens = message.usage.output_tokens
    requestId = message.id

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')

    await recordUsage({
      organizationId: options.organizationId,
      userId: options.userId,
      model,
      feature: options.feature ?? 'GENERAL',
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startMs,
      success: true,
      requestId,
    })

    return text
  } catch (err) {
    const apiErr = err as Anthropic.APIError | null
    await recordUsage({
      organizationId: options.organizationId,
      userId: options.userId,
      model,
      feature: options.feature ?? 'GENERAL',
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startMs,
      success: false,
      errorMessage: apiErr?.message ?? String(err),
      requestId: apiErr?.headers?.['request-id'],
    })
    throw err
  }
}

// ---------------------------------------------------------------------------
// Public API — callClaudeStructured (JSON via tool_use, no regex)
// ---------------------------------------------------------------------------

export interface CallClaudeStructuredOptions<T> extends CallClaudeOptions {
  schema: Record<string, unknown>
}

export async function callClaudeStructured<T>(
  systemPrompt: string,
  userMessage: string,
  options: CallClaudeStructuredOptions<T>,
): Promise<T> {
  const model = resolveModel(options.feature ?? 'GENERAL', options.modelOverride)
  const maxTokens = options.maxTokens ?? 4096
  const startMs = Date.now()
  const tool = buildJsonTool<T>(options.schema)

  let inputTokens = 0
  let outputTokens = 0
  let requestId: string | undefined

  try {
    const message = await withRetry(() =>
      getClient().messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name },
        messages: [{ role: 'user', content: userMessage }],
      }),
    )

    inputTokens = message.usage.input_tokens
    outputTokens = message.usage.output_tokens
    requestId = message.id

    const toolBlock = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === tool.name,
    )

    if (!toolBlock) {
      throw new Error('Claude did not return structured output via tool_use')
    }

    await recordUsage({
      organizationId: options.organizationId,
      userId: options.userId,
      model,
      feature: options.feature ?? 'GENERAL',
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startMs,
      success: true,
      requestId,
    })

    return toolBlock.input as T
  } catch (err) {
    const apiErr = err as Anthropic.APIError | null
    await recordUsage({
      organizationId: options.organizationId,
      userId: options.userId,
      model,
      feature: options.feature ?? 'GENERAL',
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startMs,
      success: false,
      errorMessage: apiErr?.message ?? String(err),
      requestId: apiErr?.headers?.['request-id'],
    })
    throw err
  }
}

// ---------------------------------------------------------------------------
// Public API — callClaudeJSON (backward-compatible wrapper)
// ---------------------------------------------------------------------------

export async function callClaudeJSON<T>(
  systemPrompt: string,
  userMessage: string,
  options: CallClaudeOptions & { schema?: Record<string, unknown> },
): Promise<T> {
  if (options.schema) {
    return callClaudeStructured<T>(systemPrompt, userMessage, {
      ...options,
      schema: options.schema,
    })
  }

  // Fallback: text response parsed as JSON (for gradual migration)
  const text = await callClaude(systemPrompt, userMessage, {
    ...options,
    maxTokens: options.maxTokens ?? 4096,
  })
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
  return JSON.parse(cleaned) as T
}

// ---------------------------------------------------------------------------
// Public API — Streaming
// ---------------------------------------------------------------------------

export interface StreamCallbacks {
  onToken?: (token: string) => void
  onComplete?: (fullText: string) => void
  onError?: (err: Error) => void
}

export async function streamClaude(
  systemPrompt: string,
  userMessage: string,
  options: CallClaudeOptions,
  callbacks: StreamCallbacks = {},
): Promise<string> {
  const model = resolveModel(options.feature ?? 'GENERAL', options.modelOverride)
  const maxTokens = options.maxTokens ?? 8192
  const startMs = Date.now()
  let fullText = ''

  try {
    const stream = getClient().messages.stream({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    stream.on('text', (text) => {
      fullText += text
      callbacks.onToken?.(text)
    })

    const finalMessage = await stream.finalMessage()

    await recordUsage({
      organizationId: options.organizationId,
      userId: options.userId,
      model,
      feature: options.feature ?? 'GENERAL',
      inputTokens: finalMessage.usage.input_tokens,
      outputTokens: finalMessage.usage.output_tokens,
      latencyMs: Date.now() - startMs,
      success: true,
      requestId: finalMessage.id,
    })

    callbacks.onComplete?.(fullText)
    return fullText
  } catch (err) {
    const apiErr = err as Anthropic.APIError | null
    await recordUsage({
      organizationId: options.organizationId,
      userId: options.userId,
      model,
      feature: options.feature ?? 'GENERAL',
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startMs,
      success: false,
      errorMessage: apiErr?.message ?? String(err),
    })
    const wrapped = err instanceof Error ? err : new Error(String(err))
    callbacks.onError?.(wrapped)
    throw err
  }
}

// ---------------------------------------------------------------------------
// Budget check — prevent runaway costs
// ---------------------------------------------------------------------------

export async function checkAiBudget(
  organizationId: string,
  monthlyBudgetUsd = 500,
): Promise<{ allowed: boolean; spent: number; budget: number }> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const result = await prisma.aiUsageRecord.aggregate({
    where: {
      organizationId,
      createdAt: { gte: startOfMonth },
    },
    _sum: { costUsd: true },
  })

  const spent = result._sum.costUsd ?? 0
  return { allowed: spent < monthlyBudgetUsd, spent, budget: monthlyBudgetUsd }
}
