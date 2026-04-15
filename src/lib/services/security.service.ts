import { AuditService } from './audit.service'

export type InstitutionalRole = 'ADMIN' | 'SENIOR_ADVISOR' | 'ADVISOR' | 'COMPLIANCE_OFFICER' | 'ANALYST' | 'AUDITOR' | 'READ_ONLY'

export type Capability = 
  | 'CLIENT_VIEW'
  | 'CLIENT_WRITE'
  | 'FINANCIAL_PII_VIEW'
  | 'AI_GENERATION'
  | 'COMMUNICATION_SEND'
  | 'COMMUNICATION_APPROVE'
  | 'OPPORTUNITY_APPROVE_HIGH'
  | 'AUDIT_VIEW'
  | 'COMPLIANCE_RESOLVE'
  | 'USER_MANAGE'
  | 'ONBOARDING_MANAGE'

export const ROLE_CAPABILITIES: Record<InstitutionalRole, Capability[]> = {
  ADMIN: [
    'CLIENT_VIEW', 'CLIENT_WRITE', 'FINANCIAL_PII_VIEW', 'AI_GENERATION', 
    'COMMUNICATION_SEND', 'COMMUNICATION_APPROVE', 'OPPORTUNITY_APPROVE_HIGH', 
    'AUDIT_VIEW', 'COMPLIANCE_RESOLVE', 'USER_MANAGE', 'ONBOARDING_MANAGE'
  ],
  SENIOR_ADVISOR: [
    'CLIENT_VIEW', 'CLIENT_WRITE', 'FINANCIAL_PII_VIEW', 'AI_GENERATION', 
    'COMMUNICATION_SEND', 'COMMUNICATION_APPROVE', 'OPPORTUNITY_APPROVE_HIGH', 
    'USER_MANAGE', 'ONBOARDING_MANAGE'
  ],
  ADVISOR: [
    'CLIENT_VIEW', 'CLIENT_WRITE', 'AI_GENERATION'
  ],
  COMPLIANCE_OFFICER: [
    'CLIENT_VIEW', 'FINANCIAL_PII_VIEW', 'AUDIT_VIEW', 'COMPLIANCE_RESOLVE', 'COMMUNICATION_APPROVE'
  ],
  ANALYST: [
    'CLIENT_VIEW', 'AI_GENERATION'
  ],
  AUDITOR: [
    'CLIENT_VIEW', 'AUDIT_VIEW'
  ],
  READ_ONLY: [
    'CLIENT_VIEW'
  ]
}

export interface SecurityContext {
  userId: string
  organizationId: string
  role: InstitutionalRole
}

export function roleHasAllCapabilities(role: string, required: readonly Capability[]): boolean {
  if (required.length === 0) return true;
  const normalized = role as InstitutionalRole;
  const granted = ROLE_CAPABILITIES[normalized];
  if (!granted) return false;
  return required.every((c) => granted.includes(c));
}

export class SecurityService {
  /**
   * Enforces institutional access control. 
   * Throws if the user lacks the required capability for the action.
   */
  static async enforceAccess(ctx: SecurityContext, capability: Capability, resourceName: string) {
    const allowed = ROLE_CAPABILITIES[ctx.role]?.includes(capability)
    
    if (!allowed) {
      // SOC 2 Critical: Log unauthorized access attempts
      await AuditService.logAction({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        target: resourceName,
        metadata: { requiredCapability: capability, userRole: ctx.role },
        severity: 'CRITICAL',
      })
      
      throw new Error(`Security Violation: User lacks required capability [${capability}] to access ${resourceName}. Event logged for Compliance.`)
    }

    // SOC 2: Log sensitive data access (Read events)
    if (capability === 'FINANCIAL_PII_VIEW' || capability === 'AUDIT_VIEW') {
      await AuditService.logAction({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'SENSITIVE_DATA_ACCESS',
        target: resourceName,
        severity: 'INFO',
      })
    }
  }

  /**
   * Institutional PII Masking utility.
   * Ensures sensitive fields are only visible to authorized roles.
   */
  static maskPII(ctx: SecurityContext, data: any, sensitiveFields: string[]) {
    if (ctx.role === 'ADMIN' || ROLE_CAPABILITIES[ctx.role]?.includes('FINANCIAL_PII_VIEW')) {
      return data
    }

    const maskedData = { ...data }
    sensitiveFields.forEach(field => {
      if (maskedData[field]) {
        maskedData[field] = '*** MASKED BY COMPLIANCE ***'
      }
    })
    return maskedData
  }
}
