/**
 * MCP (Model Context Protocol) Orchestration Layer
 *
 * This module provides the foundation for connecting Drift AI to real orchestration engines.
 * Current implementations:
 *   - LangGraph: For agentic workflows with memory and tooling
 *   - Temporal: For distributed task orchestration and durability
 *   - Custom: Extensible interface for other orchestration engines
 *
 * Replace agent.service.ts in-memory store with MCP server calls to achieve real orchestration.
 */

export type AgentStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'APPROVED'
export type AgentPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

export interface AgentTask {
  id: string
  agentId: string
  taskType: string
  status: AgentStatus
  priority: AgentPriority
  input: Record<string, unknown>
  output?: Record<string, unknown>
  error?: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  approvalRequired: boolean
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED'
}

export interface OrchestrationConfig {
  engine: 'langgraph' | 'temporal' | 'custom'
  endpoint: string
  apiKey?: string
  timeout: number
  retryPolicy: {
    maxAttempts: number
    backoffMs: number
  }
}

/**
 * Abstract MCP Orchestration Client
 * Implement this interface to connect to your orchestration engine
 */
export abstract class MCPOrchestrationClient {
  protected config: OrchestrationConfig

  constructor(config: OrchestrationConfig) {
    this.config = config
  }

  /**
   * Submit an agent task to the orchestration engine
   */
  abstract submitTask(task: AgentTask): Promise<string>

  /**
   * Get the status of a running task
   */
  abstract getTaskStatus(taskId: string): Promise<AgentStatus>

  /**
   * Pause a running task
   */
  abstract pauseTask(taskId: string): Promise<void>

  /**
   * Resume a paused task
   */
  abstract resumeTask(taskId: string): Promise<void>

  /**
   * Get task output once completed
   */
  abstract getTaskOutput(taskId: string): Promise<Record<string, unknown> | null>

  /**
   * Approve an output that requires human review
   */
  abstract approveTaskOutput(taskId: string, approved: boolean): Promise<void>
}

/**
 * LangGraph MCP Client Implementation
 * Connects to a LangGraph server for agentic workflows
 */
export class LangGraphMCPClient extends MCPOrchestrationClient {
  async submitTask(task: AgentTask): Promise<string> {
    try {
      const response = await fetch(`${this.config.endpoint}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify(task),
      })

      if (!response.ok) {
        throw new Error(`LangGraph API error: ${response.statusText}`)
      }

      const data = (await response.json()) as { taskId: string }
      return data.taskId
    } catch (err) {
      console.error('[LangGraphMCPClient] submitTask failed:', err)
      throw err
    }
  }

  async getTaskStatus(taskId: string): Promise<AgentStatus> {
    try {
      const response = await fetch(`${this.config.endpoint}/tasks/${taskId}`, {
        headers: this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {},
      })

      if (!response.ok) {
        throw new Error(`LangGraph API error: ${response.statusText}`)
      }

      const data = (await response.json()) as { status: AgentStatus }
      return data.status
    } catch (err) {
      console.error('[LangGraphMCPClient] getTaskStatus failed:', err)
      throw err
    }
  }

  async pauseTask(taskId: string): Promise<void> {
    await fetch(`${this.config.endpoint}/tasks/${taskId}/pause`, {
      method: 'POST',
      headers: this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {},
    })
  }

  async resumeTask(taskId: string): Promise<void> {
    await fetch(`${this.config.endpoint}/tasks/${taskId}/resume`, {
      method: 'POST',
      headers: this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {},
    })
  }

  async getTaskOutput(taskId: string): Promise<Record<string, unknown> | null> {
    try {
      const response = await fetch(`${this.config.endpoint}/tasks/${taskId}/output`, {
        headers: this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {},
      })

      if (!response.ok) {
        return null
      }

      return (await response.json()) as Record<string, unknown>
    } catch (err) {
      console.error('[LangGraphMCPClient] getTaskOutput failed:', err)
      return null
    }
  }

  async approveTaskOutput(taskId: string, approved: boolean): Promise<void> {
    await fetch(`${this.config.endpoint}/tasks/${taskId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey && { Authorization: `Bearer ${this.config.apiKey}` }),
      },
      body: JSON.stringify({ approved }),
    })
  }
}

/**
 * Factory function to create the appropriate MCP client
 */
export function createMCPClient(config: OrchestrationConfig): MCPOrchestrationClient {
  switch (config.engine) {
    case 'langgraph':
      return new LangGraphMCPClient(config)
    case 'temporal':
      // TODO: Implement TemporalMCPClient
      throw new Error('Temporal implementation pending')
    case 'custom':
      throw new Error('Custom MCP client must be provided')
    default:
      throw new Error(`Unknown orchestration engine: ${config.engine}`)
  }
}

/**
 * Helper to convert old in-memory agent.service tasks to MCP format
 */
export function legacyTaskToMCPTask(
  legacyTask: Record<string, unknown> & { id: string; agentId: string }
): AgentTask {
  return {
    id: legacyTask.id as string,
    agentId: legacyTask.agentId as string,
    taskType: (legacyTask.type as string) || 'unknown',
    status: (legacyTask.status as AgentStatus) || 'IDLE',
    priority: (legacyTask.priority as AgentPriority) || 'NORMAL',
    input: (legacyTask.input as Record<string, unknown>) || {},
    output: legacyTask.output as Record<string, unknown> | undefined,
    error: legacyTask.error as string | undefined,
    createdAt: new Date(legacyTask.createdAt as string),
    approvalRequired: (legacyTask.approvalRequired as boolean) ?? false,
  }
}
