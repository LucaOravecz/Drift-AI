import { z } from 'zod'

/**
 * Institutional Data Integrity Schemas (Zod).
 * Enforces strict typing and validation constraints for SOC 2 processing integrity.
 */

export const OrganizationIdSchema = z.string().cuid()
export const UserIdSchema = z.string().cuid()
export const ClientIdSchema = z.string().cuid()

export const CommunicationInputSchema = z.object({
  clientId: ClientIdSchema,
  type: z.enum(['EMAIL', 'MEETING_NOTE', 'PHONE', 'GIFT', 'MILESTONE_OUTREACH']),
  subject: z.string().min(1).max(200).optional(),
  body: z.string().min(1),
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT', 'REJECTED']).default('DRAFT')
})

export const OpportunityUpdateSchema = z.object({
  id: z.string().cuid(),
  status: z.enum(['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'EXECUTED']),
  description: z.string().optional(),
})

export const TaxInsightReviewSchema = z.object({
  id: z.string().cuid(),
  action: z.enum(['ACCEPTED', 'DISMISSED', 'PENDING_APPROVAL', 'TASK_CREATED'])
})

export const OnboardingStepSchema = z.object({
  id: z.string().cuid(),
  status: z.enum(['PENDING', 'BLOCKED', 'COMPLETED', 'PENDING_APPROVAL']),
  notes: z.string().max(500).optional()
})

export const ClientCreateSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().optional(),
  type: z.enum(['INDIVIDUAL', 'HOUSEHOLD', 'ENTITY', 'TRUST']).default('INDIVIDUAL'),
  aum: z.number().min(0).optional()
})
