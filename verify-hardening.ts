import { AuditService } from './src/lib/services/audit.service'
import { ComplianceService } from './src/lib/services/compliance.service'
import prisma from './src/lib/db'

async function verifyHardenedSecurity() {
  console.log('--- STARTING SECURITY HARDENING VERIFICATION ---')
  
  const orgId = 'test-org-123'
  
  // 1. Verify SIEM Integration
  console.log('\n[1/2] Verifying SIEM Egress...')
  console.log('Expectation: JSON log with [INSTITUTIONAL_SIEM_LOG] prefix should appear below.')
  
  await AuditService.logAction({
    organizationId: orgId,
    action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
    target: 'ComplianceDashboard',
    details: 'Verification test for SIEM egress.',
    severity: 'CRITICAL',
    aiInvolved: false
  })

  // 2. Verify Task Escalation
  console.log('\n[2/2] Verifying Task Escalation...')
  // Create an immediate critical flag
  const flag = await prisma.complianceFlag.create({
    data: {
      organizationId: orgId,
      type: 'RISKY_WORDING',
      severity: 'CRITICAL',
      description: 'IMMEDIATE ESCALATION TEST',
      target: 'Test',
      targetId: 'test-1',
      status: 'OPEN'
    }
  })

  console.log(`Created Critical Flag: ${flag.id}. Running Compliance Sweep...`)
  const result = await ComplianceService.runGlobalComplianceCheck(orgId)
  console.log(`Sweep Result: ${JSON.stringify(result)}`)

  const escalatedTask = await prisma.task.findFirst({
    where: { description: { contains: `FLAG_REF:${flag.id}` } }
  })

  if (escalatedTask) {
    console.log(`✅ PASS: Task Escalation successful. Task [${escalatedTask.id}] created for Flag [${flag.id}].`)
    console.log(`Task Priority: ${escalatedTask.priority} | Title: ${escalatedTask.title}`)
  } else {
    console.log(`❌ FAIL: No task found for Flag [${flag.id}]. Escalation logic failed.`)
  }

  // Cleanup
  await prisma.auditLog.deleteMany({ where: { organizationId: orgId } })
  await prisma.complianceFlag.deleteMany({ where: { organizationId: orgId } })
  await prisma.task.deleteMany({ where: { description: { contains: `FLAG_REF:${flag.id}` } } })

  console.log('\n--- VERIFICATION COMPLETE ---')
}

verifyHardenedSecurity()
