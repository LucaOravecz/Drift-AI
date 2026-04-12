import { ComplianceService } from './src/lib/services/compliance.service'
import prisma from './src/lib/db'

async function verifyComplianceDashboard() {
  console.log('--- STARTING COMPLIANCE DASHBOARD VERIFICATION ---')
  
  // 1. Setup mock data for review
  console.log('\n[1/3] Setting up mock review items...')
  const client = await prisma.client.findFirst()
  if (!client) {
    console.error('No client found to test with.')
    process.exit(1)
  }

  // Ensure items exist in various tables with "PENDING" statuses
  await prisma.communication.create({
    data: {
      clientId: client.id,
      type: 'EMAIL',
      direction: 'OUTBOUND',
      status: 'PENDING_APPROVAL',
      subject: 'COMPLIANCE TEST: HIGH VALUE OUTREACH',
      body: 'This is a test draft requiring approval.'
    }
  })

  await prisma.taxInsight.create({
    data: {
      clientId: client.id,
      title: 'COMPLIANCE TEST: TLH OVERRIDE',
      category: 'TLH',
      rationale: 'Strategic rebalancing opportunity flagged by AI.',
      status: 'UNDER_REVIEW',
      suggestedAction: 'Sell long-term positions to offset gains.'
    }
  })

  console.log('Mock items created.')

  // 2. Test Aggregation
  console.log('\n[2/3] Fetching Unified Review Queue...')
  const queue = await ComplianceService.getUnifiedReviewQueue()
  
  console.log(`Queue Size: ${queue.length}`)
  const sources = new Set(queue.map(item => item.source))
  console.log(`Active Sources detected: ${Array.from(sources).join(', ')}`)

  const testComm = queue.find(i => i.source === 'COMMUNICATION' && i.title.includes('COMPLIANCE TEST'))
  const testTax = queue.find(i => i.source === 'TAX' && i.title.includes('COMPLIANCE TEST'))

  if (testComm && testTax) {
    console.log('✅ PASS: Unified Inbox correctly aggregates cross-service entities.')
  } else {
    console.log('❌ FAIL: Aggregation missing expected items.')
  }

  // 3. Cleanup
  console.log('\n[3/3] Cleaning up test data...')
  await prisma.communication.deleteMany({ where: { subject: { contains: 'COMPLIANCE TEST' } } })
  await prisma.taxInsight.deleteMany({ where: { title: { contains: 'COMPLIANCE TEST' } } })
  
  console.log('\n--- VERIFICATION COMPLETE ---')
}

verifyComplianceDashboard()
