import prisma from '../db'
import { SIEMService } from './siem.service'

export type AuditSeverity = 'INFO' | 'WARNING' | 'CRITICAL'
export type SourceType = 'AI' | 'USER' | 'SYSTEM'

export interface AuditContext {
  userId?: string
  organizationId: string
  action: string
  target: string
  details?: string
  beforeState?: any
  afterState?: any
  metadata?: any
  aiInvolved?: boolean
  severity?: AuditSeverity
}

export class AuditService {
  /**
   * Captures a mission-critical audit event for institutional record keeping.
   * Supports 'Decision Replay' via before/after state snapshots.
   */
  static async logAction(ctx: AuditContext) {
    try {
      const log = await prisma.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          userId: ctx.userId ?? null,
          action: ctx.action,
          target: ctx.target,
          details: ctx.details ?? (typeof ctx.afterState === 'object' 
            ? JSON.stringify(ctx.afterState) 
            : String(ctx.afterState || ctx.action)),
          beforeState: ctx.beforeState ? JSON.stringify(ctx.beforeState) as any : undefined,
          afterState: ctx.afterState ? JSON.stringify(ctx.afterState) as any : undefined,
          metadata: ctx.metadata ? JSON.stringify(ctx.metadata) as any : undefined,
          aiInvolved: ctx.aiInvolved ?? false,
          severity: ctx.severity ?? 'INFO',
        }
      })
      
      // Institutional Governance: Push high-severity events to external SIEM
      if (log.severity === 'CRITICAL' || log.severity === 'WARNING') {
        SIEMService.pushInstitutionalEvent(log)
      }

      return log
    } catch (error) {
      console.error('AuditLog failure in mission-critical layer:', error)
      // In a real institutional setting, this would trigger a secondary fail-safe log
      return null
    }
  }

  /**
   * Retrieves the version history of a decision or output for regulatory review.
   */
  static async getDecisionHistory(target: string, organizationId: string) {
    return prisma.auditLog.findMany({
      where: { target, organizationId },
      orderBy: { timestamp: 'desc' },
      include: { user: { select: { name: true, role: true } } }
    })
  }

  /**
   * Traces an AI output back to its structured reasoning and source data.
   */
  static async getDecisionTrace(logId: string) {
    const log = await prisma.auditLog.findUnique({ where: { id: logId } })
    if (!log || !log.metadata) return null
    return JSON.parse(String(log.metadata))
  }
}
