import 'server-only'

import prisma from '@/lib/db'
import { createHash } from 'crypto'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

type ModelTier = 'flagship' | 'standard' | 'economy'

const MODEL_MAP: Record<ModelTier, string> = {
  flagship: 'claude-sonnet-4-20250514',
  standard: 'claude-haiku-4-5-20251001',
  economy:  'claude-haiku-4-5-20251001',
}

const DEFAULT_TIER: ModelTier = 'standard'
const MAX_RETRIES = 3
const BASE_BACKOFF_MS = 500

// ---------------------------------------------------------------------------
// OpenRouter client singleton
// ---------------------------------------------------------------------------

interface OpenRouterMessage {
  role: 'user' | 'assistant'
  content: string
}

interface OpenRouterResponse {
  id: string
  choices: {
    message: {
      content: string
    }
  }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
  }
}

async function callOpenRouter(
  model: string,
  messages: OpenRouterMessage[],
  maxTokens: number,
): Promise<OpenRouterResponse> {
  const apiKey = process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://driftai.app',
      'X-Title': 'Drift AI',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OpenRouter API error: ${response.status} - ${error}`)
  }

  return response.json() as Promise<OpenRouterResponse>
}

// ---------------------------------------------------------------------------
// Cost tracking helpers
// ---------------------------------------------------------------------------

const COST_PER_MILLION: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 0, output: 0 },
  'claude-haiku-4-5-20251001': { input: 0, output: 0 },
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = COST_PER_MILLION[model] ?? { input: 0, output: 0 }
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

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    const message = err.message.toLowerCase()
    return message.includes('429') || message.includes('500') || message.includes('502') || message.includes('503')
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
// JSON schema to instruction string
// ---------------------------------------------------------------------------

function schemaToInstructions(schema: Record<string, unknown>): string {
  return JSON.stringify(schema, null, 2)
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
    const response = await withRetry(() =>
      callOpenRouter(model, [
        { role: 'user', content: `${systemPrompt}\n\n${userMessage}` },
      ], maxTokens),
    )

    inputTokens = response.usage.prompt_tokens
    outputTokens = response.usage.completion_tokens
    requestId = response.id

    const text = response.choices[0]?.message.content ?? ''

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
    await recordUsage({
      organizationId: options.organizationId,
      userId: options.userId,
      model,
      feature: options.feature ?? 'GENERAL',
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startMs,
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
      requestId,
    })
    throw err
  }
}

// ---------------------------------------------------------------------------
// Public API — callClaudeStructured (JSON parsing)
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

  let inputTokens = 0
  let outputTokens = 0
  let requestId: string | undefined

  try {
    const schemaInstructions = schemaToInstructions(options.schema)
    const enhancedPrompt = `${systemPrompt}\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no code blocks, no explanations, no extra text.\nRequired schema:\n${schemaInstructions}\n\nStart with { or [ and end with } or ]. Output valid JSON only.`

    const response = await withRetry(() =>
      callOpenRouter(model, [
        { role: 'user', content: `${enhancedPrompt}\n\n${userMessage}` },
      ], maxTokens),
    )

    inputTokens = response.usage.prompt_tokens
    outputTokens = response.usage.completion_tokens
    requestId = response.id

    const text = response.choices[0]?.message.content ?? ''
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()

    // Try to extract JSON if it's wrapped in text
    let jsonText = cleaned
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
    if (jsonMatch) {
      jsonText = jsonMatch[0]
    }

    const result = JSON.parse(jsonText) as T

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

    return result
  } catch (err) {
    await recordUsage({
      organizationId: options.organizationId,
      userId: options.userId,
      model,
      feature: options.feature ?? 'GENERAL',
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startMs,
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
      requestId,
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
// Public API — Streaming (non-streaming fallback for OpenRouter)
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
    const response = await withRetry(() =>
      callOpenRouter(model, [
        { role: 'user', content: `${systemPrompt}\n\n${userMessage}` },
      ], maxTokens),
    )

    fullText = response.choices[0]?.message.content ?? ''
    callbacks.onToken?.(fullText)
    callbacks.onComplete?.(fullText)

    await recordUsage({
      organizationId: options.organizationId,
      userId: options.userId,
      model,
      feature: options.feature ?? 'GENERAL',
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
      latencyMs: Date.now() - startMs,
      success: true,
      requestId: response.id,
    })

    return fullText
  } catch (err) {
    await recordUsage({
      organizationId: options.organizationId,
      userId: options.userId,
      model,
      feature: options.feature ?? 'GENERAL',
      inputTokens: 0,
      outputTokens: 0,
      latencyMs: Date.now() - startMs,
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
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
