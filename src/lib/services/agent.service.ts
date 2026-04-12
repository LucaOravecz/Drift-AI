/**
 * Agent Service — Database-backed orchestration layer for the Agent Command Center.
 * Reads from Prisma models (AgentDefinition, AgentTask, AgentOutput, AgentApproval)
 * Extension point: integrate with real orchestration engine (LangGraph, Temporal, etc.)
 */

import prisma from '@/lib/db'
import type { AgentDefinition, AgentTask, AgentOutput } from '@prisma/client'

export type AgentStatus = 'RUNNING' | 'IDLE' | 'PAUSED' | 'ERROR' | 'REVIEW_NEEDED'

/**
 * Augmented AgentDefinition with nested relations
 */
export interface AgentDefinitionWithRelations extends AgentDefinition {
  recentTasks: (AgentTask & { agent?: AgentDefinition })[]
  outputs: (AgentOutput & { approvals?: any[] })[]
}

export const AgentService = {
  /**
   * Get all agents for an organization
   */
  async getAll(organizationId: string = 'org-demo'): Promise<AgentDefinitionWithRelations[]> {
    const agents = await prisma.agentDefinition.findMany({
      where: { organizationId },
      include: {
        tasks: {
          orderBy: { createdAt: 'desc' },
          take: 3, // Last 3 tasks
        },
        outputs: {
          orderBy: { createdAt: 'desc' },
          take: 5, // Last 5 outputs
          include: {
            approvals: true,
          },
        },
      },
    })

    // Map to legacy format with recentTasks
    return agents.map(agent => ({
      ...agent,
      recentTasks: agent.tasks,
      currentTask: agent.tasks.length > 0 ? agent.tasks[0].description : null,
      taskQueueCount: agent.tasks.length,
    })) as unknown as AgentDefinitionWithRelations[]
  },

  /**
   * Get a single agent by ID
   */
  async getById(
    agentId: string,
    organizationId: string = 'org-demo'
  ): Promise<AgentDefinitionWithRelations | null> {
    const agent = await prisma.agentDefinition.findUnique({
      where: { id: agentId },
      include: {
        tasks: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        outputs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            approvals: true,
          },
        },
      },
    })

    if (!agent || agent.organizationId !== organizationId) {
      return null
    }

    return {
      ...agent,
      recentTasks: agent.tasks,
      currentTask: agent.tasks.length > 0 ? agent.tasks[0].description : null,
      taskQueueCount: agent.tasks.length,
    } as unknown as AgentDefinitionWithRelations
  },

  /**
   * Run an agent — creates a new task and updates agent status
   */
  async runAgent(
    agentId: string,
    organizationId: string = 'org-demo'
  ): Promise<{ success: boolean; message: string }> {
    const agent = await prisma.agentDefinition.findUnique({
      where: { id: agentId },
    })

    if (!agent || agent.organizationId !== organizationId) {
      return { success: false, message: 'Agent not found' }
    }

    if (agent.status === 'RUNNING') {
      return { success: false, message: 'Agent is already running' }
    }

    const taskDescriptions: Record<string, string> = {
      'agent-sales': 'Scanning CRM for new lead scoring opportunities',
      'agent-client-intelligence': 'Refreshing intelligence profiles for all active clients',
      'agent-meeting-brief': 'Pre-generating briefs for next 48 hours of meetings',
      'agent-tax': 'Running full portfolio tax-loss harvest scan',
      'agent-investment-research': 'Analyzing latest market data for portfolio drift signals',
      'agent-document-intelligence': 'Processing queued documents',
      'agent-relationship': 'Scanning for contact gaps and relationship timing signals',
      'agent-compliance': 'Running compliance check on pending communications',
      'agent-workflow-orchestrator': 'Rebuilding daily priority queue',
    }

    // Create new task
    const newTask = await prisma.agentTask.create({
      data: {
        agentId,
        organizationId,
        description: taskDescriptions[agentId] ?? 'Running on-demand task',
        type: 'GENERAL',
        status: 'IN_PROGRESS',
        priority: 'NORMAL',
        input: '{}',
      },
    })

    // Update agent status
    await prisma.agentDefinition.update({
      where: { id: agentId },
      data: {
        status: 'RUNNING',
        lastRun: new Date(),
      },
    })

    // Auto-complete after simulated delay (for demo)
    // TODO: Replace with real orchestration engine (LangGraph, Temporal, etc.)
    setTimeout(async () => {
      const currentAgent = await prisma.agentDefinition.findUnique({
        where: { id: agentId },
      })
      if (currentAgent && currentAgent.status === 'RUNNING') {
        await prisma.agentDefinition.update({
          where: { id: agentId },
          data: {
            status: 'IDLE',
            outputsToday: currentAgent.outputsToday + 1,
          },
        })
        await prisma.agentTask.update({
          where: { id: newTask.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            output: JSON.stringify({ success: true, message: 'On-demand run completed successfully.' }),
          },
        })
      }
    }, 8000)

    return { success: true, message: `${agent.name} started` }
  },

  /**
   * Pause an agent
   */
  async pauseAgent(
    agentId: string,
    organizationId: string = 'org-demo'
  ): Promise<{ success: boolean; message: string }> {
    const agent = await prisma.agentDefinition.findUnique({
      where: { id: agentId },
    })

    if (!agent || agent.organizationId !== organizationId) {
      return { success: false, message: 'Agent not found' }
    }

    if (agent.status === 'PAUSED') {
      return { success: false, message: 'Agent is already paused' }
    }

    await prisma.agentDefinition.update({
      where: { id: agentId },
      data: { status: 'PAUSED' },
    })

    return { success: true, message: `${agent.name} paused` }
  },

  /**
   * Resume a paused agent
   */
  async resumeAgent(
    agentId: string,
    organizationId: string = 'org-demo'
  ): Promise<{ success: boolean; message: string }> {
    const agent = await prisma.agentDefinition.findUnique({
      where: { id: agentId },
    })

    if (!agent || agent.organizationId !== organizationId) {
      return { success: false, message: 'Agent not found' }
    }

    if (agent.status !== 'PAUSED') {
      return { success: false, message: 'Agent is not paused' }
    }

    await prisma.agentDefinition.update({
      where: { id: agentId },
      data: { status: 'IDLE' },
    })

    return { success: true, message: `${agent.name} resumed` }
  },

  /**
   * Approve an agent output
   */
  async approveOutput(
    outputId: string,
    organizationId: string = 'org-demo'
  ): Promise<{ success: boolean }> {
    const output = await prisma.agentOutput.findUnique({
      where: { id: outputId },
    })

    if (!output || output.organizationId !== organizationId) {
      return { success: false }
    }

    await prisma.agentOutput.update({
      where: { id: outputId },
      data: { reviewStatus: 'APPROVED' },
    })

    // Decrement pending reviews
    const agent = await prisma.agentDefinition.findUnique({
      where: { id: output.agentId },
    })

    if (agent && agent.pendingReviews > 0) {
      await prisma.agentDefinition.update({
        where: { id: output.agentId },
        data: { pendingReviews: agent.pendingReviews - 1 },
      })
    }

    return { success: true }
  },

  /**
   * Dismiss an agent output
   */
  async dismissOutput(
    outputId: string,
    organizationId: string = 'org-demo'
  ): Promise<{ success: boolean }> {
    const output = await prisma.agentOutput.findUnique({
      where: { id: outputId },
    })

    if (!output || output.organizationId !== organizationId) {
      return { success: false }
    }

    await prisma.agentOutput.update({
      where: { id: outputId },
      data: { reviewStatus: 'DISMISSED' },
    })

    // Decrement pending reviews
    const agent = await prisma.agentDefinition.findUnique({
      where: { id: output.agentId },
    })

    if (agent && agent.pendingReviews > 0) {
      await prisma.agentDefinition.update({
        where: { id: output.agentId },
        data: { pendingReviews: agent.pendingReviews - 1 },
      })
    }

    return { success: true }
  },

  /**
   * Get workload summary across all agents
   */
  async getWorkloadSummary(organizationId: string = 'org-demo') {
    const agents = await prisma.agentDefinition.findMany({
      where: { organizationId },
    })

    const tasks = await prisma.agentTask.findMany({
      where: { organizationId },
    })

    const running = agents.filter(a => a.status === 'RUNNING').length
    const idle = agents.filter(a => a.status === 'IDLE').length
    const paused = agents.filter(a => a.status === 'PAUSED').length
    const errors = agents.filter(a => a.status === 'ERROR').length
    const reviewNeeded = agents.filter(a => a.status === 'REVIEW_NEEDED').length

    return {
      totalAgents: agents.length,
      running,
      idle,
      paused,
      errors,
      reviewNeeded,
      totalOutputsToday: agents.reduce((sum, a) => sum + a.outputsToday, 0),
      totalPendingReviews: agents.reduce((sum, a) => sum + a.pendingReviews, 0),
      totalQueueItems: tasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'PENDING').length,
    }
  },
}
