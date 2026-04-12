import { PrismaClient } from '@prisma/client'
import { createPasswordHash } from '../src/lib/password'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding Drift AI — comprehensive demo data...')

  // ── Clean ──────────────────────────────────────────────────────────────────
  // New tables first (depend on existing tables)
  await prisma.agentApproval.deleteMany()
  await prisma.agentOutput.deleteMany()
  await prisma.agentTask.deleteMany()
  await prisma.agentDefinition.deleteMany()
  await prisma.auditEvent.deleteMany()
  await prisma.aiUsageRecord.deleteMany()
  await prisma.outboundWebhook.deleteMany()
  await prisma.complianceRule.deleteMany()
  await prisma.integrationConfig.deleteMany()
  await prisma.apiKey.deleteMany()
  await prisma.subscription.deleteMany()
  await prisma.clientTag.deleteMany()
  await prisma.tag.deleteMany()
  // Original tables
  await prisma.auditLog.deleteMany()
  await prisma.complianceFlag.deleteMany()
  await prisma.researchMemo.deleteMany()
  await prisma.task.deleteMany()
  await prisma.relationshipEvent.deleteMany()
  await prisma.communication.deleteMany()
  await prisma.holding.deleteMany()
  await prisma.financialAccount.deleteMany()
  await prisma.document.deleteMany()
  await prisma.meeting.deleteMany()
  await prisma.lifeEvent.deleteMany()
  await prisma.onboardingStep.deleteMany()
  await prisma.onboardingWorkflow.deleteMany()
  await prisma.investmentInsight.deleteMany()
  await prisma.taxInsight.deleteMany()
  await prisma.opportunity.deleteMany()
  await prisma.intelligenceProfile.deleteMany()
  await prisma.prospect.deleteMany()
  await prisma.campaign.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.userSession.deleteMany()
  await prisma.userPreference.deleteMany()
  await prisma.organizationSettings.deleteMany()
  await prisma.client.deleteMany()
  await prisma.user.deleteMany()
  await prisma.organization.deleteMany()

  // ── 1. Organization + Users ────────────────────────────────────────────────
  const org = await prisma.organization.create({
    data: { name: 'Drift Financial Partners' },
  })

  await prisma.organizationSettings.create({
    data: {
      organizationId: org.id,
      brandName: 'Drift OS',
      brandShortName: 'Drift',
      productName: 'Drift Intelligence Platform',
      tagline: 'AI Operating System for Financial Firms',
      accentColor: '#4f46e5',
      supportEmail: 'support@drift.ai',
      notificationsEmail: 'ops@drift.ai',
    },
  })

  const advisor = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'advisor@drift.ai',
      name: 'Elena Rostova',
      role: 'ADVISOR',
      passwordHash: createPasswordHash('advisor123'),
      isActive: true,
      mustChangePassword: false,
      lastPasswordChangeAt: new Date(),
    },
  })
  const seniorAdvisor = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'senior@drift.ai',
      name: 'Jonathan Vane',
      role: 'SENIOR_ADVISOR',
      passwordHash: createPasswordHash('senior123'),
      isActive: true,
      mustChangePassword: false,
      lastPasswordChangeAt: new Date(),
    },
  })
  const admin = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'admin@drift.ai',
      name: 'Morgan Hale',
      role: 'ADMIN',
      passwordHash: createPasswordHash('admin123456'),
      isActive: true,
      mustChangePassword: false,
      lastPasswordChangeAt: new Date(),
    },
  })
  const compliance = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'compliance@drift.ai',
      name: 'Sarah Compliance',
      role: 'COMPLIANCE_OFFICER',
      passwordHash: createPasswordHash('compliance123'),
      isActive: true,
      mustChangePassword: false,
      lastPasswordChangeAt: new Date(),
    },
  })
  const cpa = await prisma.user.create({
    data: {
      organizationId: org.id,
      email: 'cpa@drift.ai',
      name: 'Marcus Webb',
      role: 'ANALYST',
      passwordHash: createPasswordHash('analyst123'),
      isActive: true,
      mustChangePassword: false,
      lastPasswordChangeAt: new Date(),
    },
  })

  await prisma.userPreference.createMany({
    data: [
      {
        userId: advisor.id,
        timezone: 'America/Chicago',
        locale: 'en-US',
        emailNotifications: true,
        inAppNotifications: true,
        weeklyDigest: true,
      },
      {
        userId: seniorAdvisor.id,
        timezone: 'America/Chicago',
        locale: 'en-US',
        emailNotifications: true,
        inAppNotifications: true,
        weeklyDigest: true,
      },
      {
        userId: admin.id,
        timezone: 'America/Chicago',
        locale: 'en-US',
        emailNotifications: true,
        inAppNotifications: true,
        weeklyDigest: true,
      },
      {
        userId: compliance.id,
        timezone: 'America/Chicago',
        locale: 'en-US',
        emailNotifications: true,
        inAppNotifications: true,
        weeklyDigest: false,
      },
      {
        userId: cpa.id,
        timezone: 'America/Chicago',
        locale: 'en-US',
        emailNotifications: false,
        inAppNotifications: true,
        weeklyDigest: false,
      },
    ],
  })

  // ── 2. Clients ─────────────────────────────────────────────────────────────
  const householdId1 = 'HH_PETERSON_9921'
  const c1 = await prisma.client.create({
    data: {
      organizationId: org.id,
      householdId: householdId1,
      name: 'Peterson Household',
      type: 'HOUSEHOLD',
      email: 'david.peterson@email.com',
      aum: 4200000,
      riskProfile: 'Moderate Growth',
      lastContactAt: new Date(Date.now() - 12 * 86400000),
      // Tags now managed via ClientTag relation
      intelligence: {
        create: {
          familyContext: 'David (62) and Linda (58). 2 kids in college, 1 grandchild. David is 3 years from retirement.',
          communication: 'Prefers text for quick updates, email for documents. Extremely data-driven. Linda prefers phone calls.',
          concerns: 'Worried about inflation eroding purchasing power. Anxious about sequence-of-returns risk near retirement.',
          goals: 'Retire comfortably at 65. Fund grandchildren education. Leave meaningful inheritance.',
          lifeStage: 'PRE_RETIREMENT',
          sentimentScore: 92,
          relationStrength: 88,
        },
      },
    },
  })

  // Linked Entities for Peterson
  await prisma.client.create({
    data: {
      organizationId: org.id,
      householdId: householdId1,
      name: 'David Peterson IRA',
      type: 'INDIVIDUAL',
      aum: 1200000,
      riskProfile: 'Balanced',
    }
  })

  await prisma.client.create({
    data: {
      organizationId: org.id,
      householdId: householdId1,
      name: 'Peterson Family Trust',
      type: 'TRUST',
      aum: 2500000,
      riskProfile: 'Conservative',
    }
  })

  const c2 = await prisma.client.create({
    data: {
      organizationId: org.id,
      name: 'Dr. Amanda Reyes',
      type: 'INDIVIDUAL',
      email: 'areyes@reyesclinic.com',
      aum: 6800000,
      riskProfile: 'Aggressive',
      lastContactAt: new Date(Date.now() - 2 * 86400000),
      // Tags now managed via ClientTag relation
      intelligence: {
        create: {
          familyContext: 'Single, 44. Owns two medical clinics. No children. Parents are aging.',
          communication: 'Very busy. Bullet points only. Does not like phone calls during market hours. Best reached 7-8 AM.',
          concerns: 'Tax burden from practice income. Wants private equity exposure. Worries about practice succession.',
          goals: 'Aggressive wealth accumulation. Diversify away from real estate. Create tax-efficient retirement structure.',
          lifeStage: 'ACCUMULATION',
          sentimentScore: 85,
          relationStrength: 78,
        },
      },
    },
  })

  const c3 = await prisma.client.create({
    data: {
      organizationId: org.id,
      name: 'Sarah Jenkins',
      type: 'INDIVIDUAL',
      email: 'sarah.jenkins@gmail.com',
      aum: 850000,
      riskProfile: 'Conservative',
      churnScore: 82,
      lastContactAt: new Date(Date.now() - 270 * 86400000),
      // Tags now managed via ClientTag relation
      intelligence: {
        create: {
          familyContext: 'Widowed, 71. Looking to transfer wealth to two nieces. Has one adult son who is estranged.',
          communication: 'Prefers quarterly phone calls. Missed the last two scheduled reviews. Feels underserved.',
          concerns: 'Feels like she is not getting enough attention. Market volatility scares her. Lack of proactive outreach.',
          goals: 'Preserve capital. Simplify estate. Make charitable giving easier.',
          lifeStage: 'DISTRIBUTION',
          sentimentScore: 38,
          relationStrength: 30,
        },
      },
    },
  })

  const c4 = await prisma.client.create({
    data: {
      organizationId: org.id,
      name: 'Williams Trust',
      type: 'TRUST',
      email: 'marcus.williams@wlegal.com',
      aum: 12400000,
      riskProfile: 'Balanced',
      lastContactAt: new Date(Date.now() - 21 * 86400000),
      // Tags now managed via ClientTag relation
      intelligence: {
        create: {
          familyContext: 'Marcus (68) and Clara (65). Trust established for 3 adult children. Family business recently sold.',
          communication: 'Marcus drives decisions. Clara is more risk-averse. Prefer formal quarterly reviews.',
          concerns: 'How to distribute trust assets fairly. Tax efficiency post-business sale. Estate equalization.',
          goals: 'Preserve inter-generational wealth. Minimize estate tax. Fund grandchildren trusts.',
          lifeStage: 'DISTRIBUTION',
          sentimentScore: 74,
          relationStrength: 82,
        },
      },
    },
  })

  const c5 = await prisma.client.create({
    data: {
      organizationId: org.id,
      name: 'The Harrison Family',
      type: 'HOUSEHOLD',
      email: 'james.harrison@harrisonco.com',
      aum: 21500000,
      riskProfile: 'Growth',
      lastContactAt: new Date(Date.now() - 30 * 86400000),
      churnScore: 45,
      // Tags now managed via ClientTag relation
      intelligence: {
        create: {
          familyContext: 'James (55) and Patricia (52). 4 children. Owns construction company worth $40M. Recently relocated to Florida.',
          communication: 'James is direct and deal-oriented. Wants numbers, not narrative. Patricia focuses on family goals.',
          concerns: 'Business concentration risk. No clear succession plan. Recent relocation tax implications.',
          goals: 'Diversify away from business. Protect assets. Build family office-like structure.',
          lifeStage: 'ACCUMULATION',
          sentimentScore: 68,
          relationStrength: 71,
        },
      },
    },
  })

  const c6 = await prisma.client.create({
    data: {
      organizationId: org.id,
      name: 'Michael Chang',
      type: 'INDIVIDUAL',
      email: 'mchang@gmail.com',
      aum: 2100000,
      riskProfile: 'Conservative Growth',
      lastContactAt: new Date(Date.now() - 45 * 86400000),
      // Tags now managed via ClientTag relation
      intelligence: {
        create: {
          familyContext: 'Married (Gloria, 62). Retired engineer. Two grown children in tech industry.',
          communication: 'Likes detailed explanations. Responds well to charts and projections. Very organized.',
          concerns: 'Managing RMDs efficiently. Healthcare costs in retirement. Not outliving money.',
          goals: 'Generate consistent income. Minimize taxes in retirement. Leave legacy for grandchildren.',
          lifeStage: 'RETIREMENT',
          sentimentScore: 80,
          relationStrength: 75,
        },
      },
    },
  })

  // ── 2b. Tags ──────────────────────────────────────────────────────────────
  const tagData = [
    { name: 'Legacy Planning', color: '#4f46e5' },
    { name: 'High Net Worth', color: '#7c3aed' },
    { name: 'Private Practice', color: '#2563eb' },
    { name: 'Tax Focus', color: '#0891b2' },
    { name: 'High Income', color: '#059669' },
    { name: 'At-Risk', color: '#dc2626' },
    { name: 'Estate Planning', color: '#d97706' },
    { name: 'Trust', color: '#9333ea' },
    { name: 'Multi-Gen', color: '#c026d3' },
    { name: 'UHNW', color: '#e11d48' },
    { name: 'Business Owner', color: '#ea580c' },
    { name: 'Growth', color: '#16a34a' },
    { name: 'RMD Planning', color: '#0284c7' },
    { name: 'Medicare', color: '#6d28d9' },
    { name: 'Onboarding', color: '#ca8a04' },
    { name: 'New Client', color: '#65a30d' },
    { name: 'Physician', color: '#0ea5e9' },
    { name: 'Business', color: '#f97316' },
  ]

  const tags = await Promise.all(
    tagData.map((t) =>
      prisma.tag.create({
        data: { organizationId: org.id, name: t.name, color: t.color },
      }),
    ),
  )

  const tagMap = new Map(tags.map((t) => [t.name, t.id]))

  // Assign tags to clients
  await prisma.clientTag.createMany({
    data: [
      { clientId: c1.id, tagId: tagMap.get('Legacy Planning')! },
      { clientId: c1.id, tagId: tagMap.get('High Net Worth')! },
      { clientId: c2.id, tagId: tagMap.get('Private Practice')! },
      { clientId: c2.id, tagId: tagMap.get('Tax Focus')! },
      { clientId: c2.id, tagId: tagMap.get('High Income')! },
      { clientId: c3.id, tagId: tagMap.get('At-Risk')! },
      { clientId: c3.id, tagId: tagMap.get('Estate Planning')! },
      { clientId: c4.id, tagId: tagMap.get('Trust')! },
      { clientId: c4.id, tagId: tagMap.get('Estate Planning')! },
      { clientId: c4.id, tagId: tagMap.get('Multi-Gen')! },
      { clientId: c5.id, tagId: tagMap.get('UHNW')! },
      { clientId: c5.id, tagId: tagMap.get('Business Owner')! },
      { clientId: c5.id, tagId: tagMap.get('Growth')! },
      { clientId: c6.id, tagId: tagMap.get('RMD Planning')! },
      { clientId: c6.id, tagId: tagMap.get('Medicare')! },
    ],
  })

  // ── 2c. Subscription ──────────────────────────────────────────────────────
  await prisma.subscription.create({
    data: {
      organizationId: org.id,
      plan: 'PROFESSIONAL',
      status: 'ACTIVE',
      seatCount: 5,
      trialEndsAt: new Date(Date.now() + 14 * 86400000),
    },
  })

  // ── 3. Opportunities ───────────────────────────────────────────────────────
  await prisma.opportunity.createMany({
    data: [
      {
        clientId: c1.id,
        type: 'IDLE_CASH',
        valueEst: 1200000,
        confidence: 95.5,
        description: 'Detected $1.2M in external cash accounts linked via Plaid. Has been idle for 4+ months.',
        evidence: 'Plaid link data showed cash inflows from likely RSU vesting. Account balance consistent for 18 weeks.',
        suggestedAction: 'Propose High-Yield Municipal Bond Ladder for tax-efficient income generation.',
        draftOutreach: 'Hi David, I noticed a significant cash balance sitting in your checking account that we haven\'t discussed. Given current rates, we could be generating meaningful tax-free income. Can we schedule 20 minutes this week?',
        status: 'DRAFT',
      },
      {
        clientId: c2.id,
        type: 'CROSS_SELL',
        valueEst: 0,
        confidence: 88.0,
        description: 'Amanda\'s practice revenue jumped 40% YoY. A Defined Benefit plan could shelter $230k/year.',
        evidence: 'Annual 1099 review showed massive spike in K-1 distributions. Practice added second location.',
        suggestedAction: 'Propose Defined Benefit Plan implementation alongside existing SEP-IRA.',
        draftOutreach: 'Amanda — quick note. Your practice income jumped significantly this year. A Defined Benefit plan could reduce your taxable income by $200k+ this year. Worth 15 minutes?',
        status: 'PENDING_REVIEW',
      },
      {
        clientId: c4.id,
        type: 'REBALANCE',
        valueEst: 450000,
        confidence: 91.0,
        description: 'Tech sector drift to 34% of equity allocation. Target is 22%. Rebalance opportunity with TLH benefits.',
        evidence: 'Custodian report Q3. Top 5 mega-cap tech positions now 34% vs 22% model. $450k in unrealized losses available.',
        suggestedAction: 'Direct indexing rebalance with tax-loss harvesting overlay. Harvest $45k in losses.',
        status: 'DRAFT',
      },
      {
        clientId: c5.id,
        type: 'ESTATE',
        valueEst: 0,
        confidence: 78.5,
        description: 'Harrison recently relocated to Florida. Estate plan was drafted in New Jersey. Needs immediate update.',
        evidence: 'Address change detected in custodian records. Previous estate plan references NJ trust laws.',
        suggestedAction: 'Refer to estate attorney for Florida domicile update. Review SLAT and FLP structures.',
        draftOutreach: 'James — now that you\'re settled in Florida, we need to update your estate documents. The move also triggers some planning opportunities. Can we set up a call with our estate attorney this month?',
        status: 'DRAFT',
      },
      {
        clientId: c3.id,
        type: 'ROLLOVER',
        valueEst: 120000,
        confidence: 72.0,
        description: 'Sarah has an old 403(b) from previous employer sitting dormant. Rollover opportunity.',
        evidence: 'Tax return analysis shows external 403(b) distribution-eligible account. Has not been touched in 6 years.',
        suggestedAction: 'Propose IRA rollover. Consolidate to simplify estate and improve investment options.',
        status: 'DRAFT',
      },
    ],
  })

  // ── 4. Tax Insights ────────────────────────────────────────────────────────
  await prisma.taxInsight.createMany({
    data: [
      {
        clientId: c1.id,
        title: 'Tax-Loss Harvesting: Tech Sector Pullback',
        category: 'TLH',
        rationale: 'Tech sector pullback in Q3 created unrealized losses in joint brokerage account.',
        evidence: 'AAPL lot purchased 03/2023 down 18%. MSFT lot purchased 01/2023 down 12%. Combined loss: ~$45k.',
        estimatedImpact: '~$45,000 deduction offset',
        suggestedAction: 'Sell AAPL and MSFT specific lots. Buy QQQ as proxy to maintain exposure. Avoid wash sale.',
        urgency: 'HIGH',
        status: 'UNDER_REVIEW',
        draftNote: 'Hi David, we noticed an opportunity to harvest $45k in losses against your gains from the property sale earlier this year. This is time-sensitive due to year-end. Can we schedule a quick review call?',
      },
      {
        clientId: c2.id,
        title: 'Donor-Advised Fund: Charitable Bunching Strategy',
        category: 'CHARITABLE',
        rationale: 'Extremely high income year from practice expansion. Standard deduction is suboptimal. Charitable bunching via DAF could generate $80k+ deduction.',
        evidence: 'Q3 estimated payment 300% above Q2. Practice K-1 projected to hit $1.8M. Typical annual giving: $30k.',
        estimatedImpact: 'Est. $80,000+ itemized deduction',
        suggestedAction: 'Fund a Donor Advised Fund with $200k in highly appreciated stock. Take deduction now, distribute to charities over 3 years.',
        urgency: 'HIGH',
        status: 'UNDER_REVIEW',
        draftNote: 'Amanda — given your practice income this year, we have an opportunity to dramatically reduce your tax bill through a charitable bunching strategy. This involves a Donor Advised Fund and must be executed before Dec 31.',
      },
      {
        clientId: c4.id,
        title: 'Tax-Loss Harvesting: $45k Opportunity in QQQ',
        category: 'TLH',
        rationale: 'Tech sector pullback in Q3 triggered a 15% drawdown in the specific lot of QQQ purchased last year.',
        evidence: 'QQQ lot purchased 11/2022 at $312. Current price $265. 200 shares. Loss: $9,400. Other tech positions add to ~$45k total.',
        estimatedImpact: '~$45,000 tax offset against trust distributions',
        suggestedAction: 'Harvest losses before year-end. Replace with similar ETF to maintain allocation.',
        urgency: 'HIGH',
        status: 'UNDER_REVIEW',
      },
      {
        clientId: c6.id,
        title: 'Required Minimum Distribution Planning',
        category: 'RMD',
        rationale: 'Michael turning 73 this year triggers RMD requirements across three IRA accounts. QCD strategy can reduce taxable income.',
        evidence: 'DOB 03/12/1952. Combined IRA balance: $1.8M. Estimated RMD: $68,000/yr. Current charitable giving: $15,000/yr.',
        estimatedImpact: 'Up to $15,000 annual QCD offset; penalty avoidance on $68k RMD',
        suggestedAction: 'Redirect $15k of RMD as Qualified Charitable Distribution to avoid income recognition. Schedule remaining RMD distributions strategically.',
        urgency: 'HIGH',
        status: 'UNDER_REVIEW',
      },
      {
        clientId: c5.id,
        title: 'Florida Domicile: Estate Tax Planning Review',
        category: 'ENTITY',
        rationale: 'Relocation to Florida from NJ creates estate planning window. Florida has no estate tax. Existing trust structures may need updating.',
        evidence: 'Address change filed with custodian 09/2024. Previous estate plan drafted in NJ with NJ-specific trust provisions.',
        estimatedImpact: 'Potential estate tax elimination on $21M+ estate',
        suggestedAction: 'Urgent: Coordinate with estate attorney to update domicile documents. Review SLAT funding and FLP structure for Florida applicability.',
        urgency: 'HIGH',
        status: 'UNDER_REVIEW',
      },
      {
        clientId: c1.id,
        title: 'Roth Conversion Opportunity Before Retirement',
        category: 'CONTRIBUTION',
        rationale: 'David is 3 years from retirement and currently in the 32% bracket. Partial Roth conversion this year could fill the bracket before income drops.',
        evidence: 'Current taxable income: ~$380k. 32% bracket top: $553k. Headroom: ~$173k for Roth conversion at current rate.',
        estimatedImpact: 'Lock in 32% rate vs est. 35%+ at RMD age',
        suggestedAction: 'Convert $100k from Traditional IRA to Roth IRA before Dec 31. Pair with TLH to offset income.',
        urgency: 'MEDIUM',
        status: 'UNDER_REVIEW',
      },
    ],
  })

  // ── 5. Investment Insights ─────────────────────────────────────────────────
  await prisma.investmentInsight.createMany({
    data: [
      {
        clientId: c4.id,
        title: 'Mega-Cap Tech Overweight — Rebalance Discussion',
        assetTicker: 'TECH_COMPOSITE',
        thesis: 'Top 5 mega-cap tech positions have drifted to 34% of equity allocation vs 22% model target. This creates concentration risk and tax-efficient rebalance opportunity via TLH.',
        risks: 'Emotional attachment to high-performing positions. Tax event on gains. Market timing risk.',
        catalysts: 'Q4 seasonality. Year-end rebalance window. TLH pairing available.',
        questions: 'What is the client\'s tax basis on AAPL and MSFT positions? Are there any pending stock options or RSUs?',
        status: 'UNDER_REVIEW',
      },
      {
        clientId: c5.id,
        title: 'Business Concentration Risk — Construction Sector Exposure',
        assetTicker: 'HARRISON_CO',
        thesis: 'Harrison family has ~65% of net worth tied to privately held construction company. A sector downturn or key-person event would be catastrophic. Diversification strategy needed.',
        risks: 'Liquidity event triggers large capital gains. Business valuation may be inflated. Key-person dependency.',
        catalysts: 'Recent FL relocation creates new domicile tax opportunity. Interest in partial sale mentioned in last meeting.',
        questions: 'Has James considered an ESOP? What is current buy-sell agreement? Is there a succession plan in place?',
        status: 'UNDER_REVIEW',
      },
      {
        clientId: c2.id,
        title: 'Private Credit Allocation — Income Enhancement',
        assetTicker: 'PRIVATE_CREDIT',
        thesis: 'Amanda\'s current portfolio is 100% public equity. Adding 15% private credit could generate 8-10% yield, reduce correlation, and align with her income diversification goals.',
        risks: 'Illiquidity. Manager selection risk. Fee drag. Not suitable for needing near-term liquidity.',
        catalysts: 'Practice sale discussions suggest possible future liquidity event. High income makes yield tax planning complex.',
        questions: 'What is her 5-year liquidity plan? Is she an accredited investor for fund minimums?',
        status: 'SAVED_MEMO',
      },
    ],
  })

  // ── 6. Research Memos ─────────────────────────────────────────────────────
  await prisma.researchMemo.createMany({
    data: [
      {
        clientId: c4.id,
        title: 'Q4 2024 Rebalance Memo — Williams Trust',
        assetOrSector: 'Technology / Equity Allocation',
        thesis: 'The Williams Trust equity portfolio has drifted materially from the 60/40 Balanced model. Technology now represents 34% of equity vs a 22% target. The Q3 pullback presents a simultaneous rebalance and tax-loss harvesting opportunity that should be executed before year-end.',
        risks: '1. Wash sale rule violations if repurchase is too rapid. 2. Market recovery before harvest is executed. 3. Marcus may resist selling high-conviction AAPL position.',
        catalysts: '1. Year-end tax deadline. 2. Q3 pullback created $45k+ in harvestable losses. 3. New bond inventory available in muni space offers attractive after-tax yield.',
        questions: 'Confirm tax basis on all affected positions. Review any pending margin loans. Confirm Clara agrees to rebalance.',
        sources: 'Custodian report Q3 2024, Internal model allocation report, YTD performance attribution',
        status: 'APPROVED',
        generatedBy: 'AI + Advisor Review',
      },
      {
        clientId: c2.id,
        title: 'Private Credit Overview — Reyes Portfolio',
        assetOrSector: 'Private Credit',
        thesis: 'Adding a 15% allocation to private credit for Dr. Reyes would provide diversified income, reduce public market correlation, and align with her desire to diversify away from pure equity exposure.',
        risks: '1. Illiquidity lock-up typically 5-7 years. 2. Manager selection is critical in this space. 3. Fee structures are complex. 4. May not be suitable if practice sale occurs in <3 years.',
        catalysts: '1. Current rates make private credit yields (8-10%) exceptionally attractive. 2. Amanda\'s high tax bracket makes yield tax planning complex — muni equivalents are harder to find at this return level.',
        questions: 'Confirm accredited investor status. Discuss practice sale timeline. Review existing illiquid holdings.',
        sources: 'Internal research, Blackstone Private Credit fund materials, Client profile data',
        status: 'REVIEWED',
        generatedBy: 'AI',
      },
    ],
  })

  // ── 7. Meetings ───────────────────────────────────────────────────────────
  const m1 = await prisma.meeting.create({
    data: {
      clientId: c4.id,
      title: 'Williams Trust Q4 Portfolio Review',
      type: 'REVIEW',
      scheduledAt: new Date(Date.now() + 2 * 3600000), // 2 hours from now (today)
      status: 'SCHEDULED',
      attendees: 'Marcus Williams, Clara Williams, Elena Rostova (Advisor)',
      briefGenerated: true,
      briefText: JSON.stringify({
        snapshot: {
          aum: '$12.4M',
          ytdReturn: '+8.4%',
          riskProfile: 'Balanced',
          lastReview: '3 months ago',
        },
        recentChanges: [
          'Business sale completed — $3.2M proceeds received in trust account',
          'Tech sector drift to 34% equity allocation (model: 22%)',
          'Two children started college — 529 funding discussions pending',
        ],
        topOpportunities: [
          'Rebalance tech overweight with simultaneous TLH ($45k available)',
          'Deploy $3.2M business sale proceeds into diversified income strategy',
          'Review 529 funding for grandchildren',
        ],
        taxItems: [
          'Year-end TLH deadline — must act before Dec 31',
          'Trust distribution planning for 2024 tax year',
          'Review estimated payment accuracy given business sale gains',
        ],
        complianceReminders: [
          'Investment Policy Statement last signed 2 years ago — update recommended',
          'Beneficiary designations: verify all accounts post-business sale',
        ],
        suggestedAgenda: [
          '1. YTD performance review and attribution (10 min)',
          '2. Business sale proceeds deployment plan (15 min)',
          '3. Year-end TLH execution discussion (10 min)',
          '4. 529 funding strategy for grandchildren (10 min)',
          '5. Q1 2025 planning calendar (5 min)',
        ],
        talkingPoints: [
          '"The business sale proceeds create a unique one-time planning window — let\'s make sure we deploy them thoughtfully."',
          '"Our tech rebalance has a silver lining — the pullback actually lets us harvest losses while staying invested."',
          '"I want to show you a simple income ladder proposal for the new capital."',
        ],
        docsToReview: ['Q3 Custodian Statement', 'Rebalance Memo (emailed yesterday)', 'Trust Agreement Schedule B'],
      }),
    },
  })

  await prisma.meeting.create({
    data: {
      clientId: c1.id,
      title: 'Peterson Household Annual Review',
      type: 'REVIEW',
      scheduledAt: new Date(Date.now() + 26 * 3600000), // Tomorrow at 10 AM
      status: 'SCHEDULED',
      attendees: 'David Peterson, Linda Peterson, Elena Rostova (Advisor)',
      briefGenerated: false,
    },
  })

  await prisma.meeting.create({
    data: {
      clientId: c2.id,
      title: 'Reyes Tax Planning — Year-End Strategy',
      type: 'TAX',
      scheduledAt: new Date(Date.now() - 7 * 86400000), // Last week (completed)
      status: 'COMPLETED',
      attendees: 'Dr. Amanda Reyes, Elena Rostova, Marcus Webb (CPA)',
      briefGenerated: true,
      notes: 'Amanda agreed to DAF strategy. CPA to finalize contribution amount. Follow-up scheduled for week of Nov 11.',
    },
  })

  await prisma.meeting.create({
    data: {
      clientId: c5.id,
      title: 'Harrison Family — Florida Estate Update',
      type: 'PLANNING',
      scheduledAt: new Date(Date.now() + 5 * 86400000),
      status: 'SCHEDULED',
      attendees: 'James Harrison, Patricia Harrison, Elena Rostova, Estate Attorney TBD',
      briefGenerated: false,
    },
  })

  // ── 8. Onboarding Workflows ────────────────────────────────────────────────
  // Onboarding 1: Evans Family Trust — stalled at signatures
  const evansClient = await prisma.client.create({
    data: {
      organizationId: org.id,
      name: 'Evans Family Trust',
      type: 'TRUST',
      email: 'rj.evans@evansfoundation.com',
      aum: 3200000,
      riskProfile: 'Moderate',
      // Tags now managed via ClientTag relation
    },
  })
  const ob1 = await prisma.onboardingWorkflow.create({
    data: {
      clientId: evansClient.id,
      stage: 'PROPOSAL',
      healthScore: 65,
      notes: 'Engagement letter sent 2 days ago. Waiting on signatures from co-trustee.',
    },
  })
  await prisma.onboardingStep.createMany({
    data: [
      { workflowId: ob1.id, name: 'Initial Discovery Call', status: 'COMPLETED', completedAt: new Date(Date.now() - 14 * 86400000) },
      { workflowId: ob1.id, name: 'Fact Finder & Risk Questionnaire', status: 'COMPLETED', completedAt: new Date(Date.now() - 10 * 86400000) },
      { workflowId: ob1.id, name: 'KYC / AML Verification', status: 'COMPLETED', completedAt: new Date(Date.now() - 8 * 86400000) },
      { workflowId: ob1.id, name: 'Proposal Presented', status: 'COMPLETED', completedAt: new Date(Date.now() - 3 * 86400000) },
      { workflowId: ob1.id, name: 'Engagement Letter Signatures', status: 'BLOCKED', notes: 'Co-trustee Patricia Evans has not signed. Second reminder sent.' },
      { workflowId: ob1.id, name: 'Custodial Account Opening', status: 'PENDING' },
      { workflowId: ob1.id, name: 'Initial Funding & First Meeting', status: 'PENDING' },
    ],
  })

  // Onboarding 2: Dr. Robert Chen — blocked on docs
  const chenClient = await prisma.client.create({
    data: {
      organizationId: org.id,
      name: 'Dr. Robert Chen',
      type: 'INDIVIDUAL',
      email: 'rob.chen@chenortho.com',
      aum: 1800000,
      riskProfile: 'Moderate Growth',
      // Tags now managed via ClientTag relation
    },
  })
  const ob2 = await prisma.onboardingWorkflow.create({
    data: {
      clientId: chenClient.id,
      stage: 'DOCS_REQUESTED',
      healthScore: 30,
      notes: 'Robert is very busy. Has not uploaded brokerage statements despite 3 reminders.',
    },
  })
  await prisma.onboardingStep.createMany({
    data: [
      { workflowId: ob2.id, name: 'Initial Discovery Call', status: 'COMPLETED', completedAt: new Date(Date.now() - 21 * 86400000) },
      { workflowId: ob2.id, name: 'Fact Finder & Risk Questionnaire', status: 'BLOCKED', notes: 'Missing 3 years of brokerage statements. Reminded 3 times.' },
      { workflowId: ob2.id, name: 'KYC / AML Verification', status: 'PENDING' },
      { workflowId: ob2.id, name: 'Proposal Presented', status: 'PENDING' },
      { workflowId: ob2.id, name: 'Engagement Letter Signatures', status: 'PENDING' },
      { workflowId: ob2.id, name: 'Custodial Account Opening', status: 'PENDING' },
      { workflowId: ob2.id, name: 'Initial Funding & First Meeting', status: 'PENDING' },
    ],
  })

  // Onboarding 3: Nguyen Partnership — nearly complete
  const nguyenClient = await prisma.client.create({
    data: {
      organizationId: org.id,
      name: 'Nguyen Partnership LLC',
      type: 'ENTITY',
      email: 'linh.nguyen@nguyenpartners.com',
      aum: 4500000,
      riskProfile: 'Growth',
      // Tags now managed via ClientTag relation
    },
  })
  const ob3 = await prisma.onboardingWorkflow.create({
    data: {
      clientId: nguyenClient.id,
      stage: 'ACCOUNT_SETUP',
      healthScore: 90,
      notes: 'All documents received. Account opening submitted. Expected funding next week.',
    },
  })
  await prisma.onboardingStep.createMany({
    data: [
      { workflowId: ob3.id, name: 'Initial Discovery Call', status: 'COMPLETED', completedAt: new Date(Date.now() - 35 * 86400000) },
      { workflowId: ob3.id, name: 'Fact Finder & Risk Questionnaire', status: 'COMPLETED', completedAt: new Date(Date.now() - 28 * 86400000) },
      { workflowId: ob3.id, name: 'KYC / AML Verification', status: 'COMPLETED', completedAt: new Date(Date.now() - 22 * 86400000) },
      { workflowId: ob3.id, name: 'Proposal Presented', status: 'COMPLETED', completedAt: new Date(Date.now() - 14 * 86400000) },
      { workflowId: ob3.id, name: 'Engagement Letter Signatures', status: 'COMPLETED', completedAt: new Date(Date.now() - 7 * 86400000) },
      { workflowId: ob3.id, name: 'Custodial Account Opening', status: 'COMPLETED', completedAt: new Date(Date.now() - 2 * 86400000) },
      { workflowId: ob3.id, name: 'Initial Funding & First Meeting', status: 'PENDING' },
    ],
  })

  // ── 9. Sales / Prospects ──────────────────────────────────────────────────
  const campaign1 = await prisma.campaign.create({
    data: {
      organizationId: org.id,
      name: 'Business Exit Planning Sequence',
      type: 'EMAIL_SEQUENCE',
      status: 'ACTIVE',
      targetCount: 42,
      openRate: 38.5,
      replyRate: 12.2,
    },
  })

  const campaign2 = await prisma.campaign.create({
    data: {
      organizationId: org.id,
      name: 'Pre-Retirement Outreach 2024',
      type: 'NURTURE',
      status: 'ACTIVE',
      targetCount: 28,
      openRate: 44.1,
      replyRate: 8.7,
    },
  })

  await prisma.prospect.createMany({
    data: [
      {
        organizationId: org.id,
        name: 'Marcus & Chloe Vance',
        email: 'mvance@vancegroup.com',
        phone: '(415) 882-3309',
        source: 'REFERRAL',
        stage: 'DISCOVERY',
        score: 92,
        estimatedAum: 2400000,
        notes: 'Referred by James Harrison. Business owner, 52. Looking to exit in 2-3 years. Very engaged.',
        lastTouchAt: new Date(Date.now() - 1 * 86400000),
        nextAction: 'Send discovery questionnaire and schedule tax planning call',
        campaignId: campaign1.id,
        aiInsight: 'Opened "Tax strategies for exiting business owners" email 3x in 24h. High intent signal. Recommend direct call within 24 hours.',
      },
      {
        organizationId: org.id,
        name: 'David Albright',
        email: 'd.albright@albco.com',
        source: 'WEBSITE',
        stage: 'QUALIFIED',
        score: 74,
        estimatedAum: 800000,
        notes: 'Found us through Google. Physician, recently sold practice. Has old 401k to rollover.',
        lastTouchAt: new Date(Date.now() - 5 * 86400000),
        nextAction: 'Follow up on proposal sent last Thursday',
        aiInsight: 'No response in 5 days after proposal. Churn risk 40%. Send follow-up with different angle — focus on rollover simplification rather than investment returns.',
      },
      {
        organizationId: org.id,
        name: 'The Nakamura Family',
        email: 'ken.nakamura@nmc.co',
        source: 'SEMINAR',
        stage: 'PROPOSAL',
        score: 88,
        estimatedAum: 3600000,
        notes: 'Attended estate planning seminar. Ken (64) and Yuki (60). Tech executive, stock options expiring.',
        lastTouchAt: new Date(Date.now() - 2 * 86400000),
        nextAction: 'Finalize options exercise strategy memo and send proposal',
        campaignId: campaign2.id,
        aiInsight: 'Stock options expiring Q1 2025. Time-sensitive planning window. High urgency. Recommend scheduling call before Nov 15.',
      },
      {
        organizationId: org.id,
        name: 'Rachel Osei',
        email: 'rachel.osei@gmail.com',
        source: 'INBOUND',
        stage: 'LEAD',
        score: 55,
        estimatedAum: 450000,
        notes: 'Filled out contact form asking about retirement planning. Single, 38. Just got promoted.',
        lastTouchAt: new Date(Date.now() - 3 * 86400000),
        nextAction: 'Send intro email and schedule discovery call',
        aiInsight: 'Low AUM but high growth potential. Age 38, high-income trajectory. Good candidate for long-term relationship building.',
      },
      {
        organizationId: org.id,
        name: 'Brewster Capital Partners',
        email: 'sam.brewster@brewstercap.com',
        source: 'COLD_OUTREACH',
        stage: 'NEGOTIATION',
        score: 97,
        estimatedAum: 8500000,
        notes: 'Institutional prospect. Frustrated with current custodian. Wants to move by Q1 2025. High urgency.',
        lastTouchAt: new Date(),
        nextAction: 'Send final fee schedule and onboarding timeline',
        aiInsight: 'Highest value prospect in pipeline. Current custodian service issues are the pain point. Lead with operational excellence and white-glove service story.',
      },
    ],
  })

  // ── 10. Documents ─────────────────────────────────────────────────────────
  await prisma.document.createMany({
    data: [
      {
        clientId: c4.id,
        fileName: 'Williams_Estate_Plan_vFINAL.pdf',
        fileSize: 4404000,
        documentType: 'ESTATE_PLAN',
        pageCount: 214,
        status: 'SUMMARIZED',
        summaryText: 'Comprehensive estate plan for Marcus and Clara Williams. Establishes Revocable Living Trust, ILIT, and FLP structure. Key risk: Schedule A (personal property) unfunded. Trust assets directed to 3 adult children with staggered distribution at 25, 30, and 35.',
        keyPoints: JSON.stringify([
          'Revocable Living Trust — primary vehicle for all non-retirement assets',
          'ILIT holds $3M life insurance policy — annual gifting required to fund premiums',
          'FLP structure for business interests — needs updating post-business sale',
          'Unfunded Schedule A (personal property inventory) — action required',
          'Power of Attorney and Healthcare Directives — current and valid',
        ]),
        actionItems: JSON.stringify([
          'Fund Schedule A with current personal property inventory',
          'Update FLP operating agreement post-business sale',
          'Review ILIT premium gifting — current strategy may be over-funding',
          'Add new grandchildren as contingent beneficiaries',
        ]),
        riskItems: JSON.stringify([
          'CRITICAL: Schedule A unfunded — estate assets may not transfer as intended',
          'HIGH: FLP structure references business that no longer exists post-sale',
          'MEDIUM: ILIT premiums not reviewed since 2021 — possible over-insurance',
        ]),
        deadlines: JSON.stringify([
          'ILIT annual gift exclusion: Dec 31, 2024',
          'Schedule A: Recommend completing before next annual review',
        ]),
      },
      {
        clientId: c1.id,
        fileName: 'Peterson_2023_Tax_Return.pdf',
        fileSize: 2150000,
        documentType: 'TAX_RETURN',
        pageCount: 86,
        status: 'SUMMARIZED',
        summaryText: 'Federal and state tax returns for David and Linda Peterson. W-2 income $285k. Rental income $48k from 2 properties. Long-term capital gains $122k from property sale. Effective rate 28.4%. No estimated payments made.',
        keyPoints: JSON.stringify([
          'Total federal tax: $134,000',
          'W-2 income: $285,000 (David principal, Linda part-time)',
          'Rental income: $48,000 (2 properties, 1 with mortgage)',
          'Long-term capital gains: $122,000 (property sale)',
          'Charitable deductions: $12,000 (under standard deduction)',
        ]),
        actionItems: JSON.stringify([
          'Set up estimated tax payments for 2024 — no payments made in 2023',
          'Review rental property depreciation schedules',
          'Consider DAF to push above standard deduction threshold',
        ]),
        riskItems: JSON.stringify([
          'HIGH: No estimated tax payments — potential underpayment penalty for 2024',
          'MEDIUM: Capital gains may trigger NII tax in 2024 if another sale occurs',
        ]),
      },
      {
        clientId: c5.id,
        fileName: 'Harrison_Trust_Agreement.pdf',
        fileSize: 3580000,
        documentType: 'TRUST_AGREEMENT',
        pageCount: 112,
        status: 'PROCESSING',
        summaryText: undefined,
        keyPoints: undefined,
      },
      {
        clientId: c2.id,
        fileName: 'Reyes_Clinic_Financials_2024.pdf',
        fileSize: 1200000,
        documentType: 'FINANCIAL_PLAN',
        pageCount: 44,
        status: 'SUMMARIZED',
        summaryText: 'Consolidated financials for Reyes Medical Group. Revenue up 42% YoY to $4.2M. EBITDA margins 31%. Second location opened Q2 2024. Estimated K-1 distribution to Dr. Reyes: $1.82M.',
        keyPoints: JSON.stringify([
          'Practice revenue: $4.2M (up 42% YoY)',
          'EBITDA: $1.3M (31% margin)',
          'Second location opened Q2 2024 — lease 10 years',
          'Estimated K-1 income to Amanda: $1.82M',
          'Current retirement plan: SEP-IRA only ($68k max contribution)',
        ]),
        actionItems: JSON.stringify([
          'Explore Defined Benefit Plan to shelter additional $160k+ per year',
          'Review buy-sell agreement for new partner joining Q1 2025',
          'Update business interruption insurance for second location',
        ]),
        riskItems: JSON.stringify([
          'HIGH: No buy-sell agreement for second location partner yet',
          'MEDIUM: SEP-IRA is the only retirement vehicle — significant tax-deferral opportunity missed',
        ]),
      },
    ],
  })

  // ── 11. Communications ────────────────────────────────────────────────────
  await prisma.communication.createMany({
    data: [
      {
        clientId: c4.id,
        type: 'EMAIL',
        direction: 'OUTBOUND',
        subject: 'Q4 Rebalance Opportunity — Williams Trust',
        body: 'Marcus, ahead of our review meeting, I wanted to flag a rebalance opportunity in the trust account. The tech pullback has created $45k in harvestable losses we can use to rebalance your equity allocation back toward the target. I\'ve attached a brief memo. Happy to walk through it tomorrow.',
        status: 'SENT',
        sentAt: new Date(Date.now() - 1 * 86400000),
      },
      {
        clientId: c2.id,
        type: 'EMAIL',
        direction: 'OUTBOUND',
        subject: 'Year-End Tax Planning Window — Action Required',
        body: 'Amanda — following up on our discussion. The DAF strategy could save you $80k+ this year but the window closes Dec 31. Marcus (CPA) has prepared the analysis. Can we schedule 30 minutes before Thanksgiving?',
        status: 'SENT',
        sentAt: new Date(Date.now() - 3 * 86400000),
      },
      {
        clientId: c3.id,
        type: 'EMAIL',
        direction: 'OUTBOUND',
        subject: 'Checking In — We Haven\'t Spoken in a While',
        body: 'Sarah, I wanted to reach out personally. I realize we haven\'t connected in several months and I\'m sorry for that. A lot has changed in the market and in the planning landscape, and I want to make sure you\'re feeling confident about where things stand. Would you be open to a call this week?',
        status: 'PENDING_APPROVAL',
      },
      {
        clientId: evansClient.id,
        type: 'EMAIL',
        direction: 'OUTBOUND',
        subject: 'Reminder: Engagement Letter Signature Needed',
        body: 'Hi Patricia, just a quick reminder that we\'re waiting on your signature on the engagement letter to move forward with opening the Evans Family Trust accounts. The DocuSign link is still active. Please let me know if you have any questions.',
        status: 'SENT',
        sentAt: new Date(Date.now() - 2 * 86400000),
      },
    ],
  })

  // ── 12. Relationship Events ────────────────────────────────────────────────
  await prisma.relationshipEvent.createMany({
    data: [
      {
        clientId: c4.id,
        type: 'ANNIVERSARY',
        title: '40th Wedding Anniversary — Marcus & Clara',
        description: 'Marcus and Clara Williams celebrate their 40th anniversary this week. High-value relationship moment.',
        eventDate: new Date(Date.now() + 3 * 86400000),
        draftMessage: 'Marcus and Clara, 40 years — what an incredible milestone. I\'ve so enjoyed being part of your financial journey. Wishing you a wonderful celebration.',
        status: 'PENDING',
        giftSuggestion: 'Premium wine or experience gift ($150-250 range). They enjoy travel.',
      },
      {
        clientId: c6.id,
        type: 'BIRTHDAY',
        title: 'Michael Chang Turns 73',
        description: 'Michael\'s 73rd birthday triggers first RMD year. Planning outreach should coincide with birthday to feel personal, not transactional.',
        eventDate: new Date(Date.now() + 12 * 86400000),
        draftMessage: 'Michael, wishing you a wonderful 73rd birthday! As we discussed, this is an important year from a planning perspective and we\'ve prepared some thoughts on your RMD strategy. Happy to connect when you\'re ready.',
        status: 'PENDING',
      },
      {
        clientId: c2.id,
        type: 'MILESTONE',
        title: 'Second Clinic Grand Opening',
        description: 'Dr. Reyes opened her second location in Q2. Significant personal milestone worth acknowledging.',
        eventDate: new Date(Date.now() - 45 * 86400000),
        draftMessage: 'Amanda, your second location is a testament to everything you\'ve built. Congrats on the grand opening — the hard work is clearly paying off.',
        status: 'COMPLETED',
      },
      {
        clientId: c1.id,
        type: 'CHECK_IN',
        title: 'Peterson — 12-Day No Contact Alert',
        description: 'David and Linda Peterson haven\'t been contacted in 12 days. Pre-retirement clients should have monthly touchpoints.',
        status: 'PENDING',
        draftMessage: 'Hi David, just a quick check-in — markets have been interesting lately and I wanted to make sure you\'re seeing the same picture I am. Nothing alarming, but worth a quick conversation. How\'s the week looking?',
      },
      {
        clientId: c5.id,
        type: 'REFERRAL_MOMENT',
        title: 'Harrison — Florida Network Referral Opportunity',
        description: 'James recently relocated and mentioned two neighbors who are also business owners looking for wealth management. High-value referral moment.',
        status: 'PENDING',
        draftMessage: 'James, glad the Florida move is going smoothly! You mentioned your neighbors Tom and Bill might benefit from a conversation — I\'d love an introduction whenever you think the timing is right. No pressure.',
      },
    ],
  })

  // ── 13. Life Events ───────────────────────────────────────────────────────
  await prisma.lifeEvent.createMany({
    data: [
      {
        clientId: c6.id,
        title: 'Approaching First RMD Year (Age 73)',
        type: 'RETIREMENT',
        detectedFrom: 'Date of birth in client profile',
        implications: 'First RMD required by April 1 of year following turning 73. Combined IRA balance $1.8M. Estimated annual RMD $68,000.',
        opportunity: 'QCD strategy to offset RMD impact. Roth conversion prior to RMD start.',
      },
      {
        clientId: c5.id,
        title: 'Relocation to Florida — Domicile Change',
        type: 'RELOCATION',
        detectedFrom: 'Custodian address change detected 09/2024',
        implications: 'Florida has no state income tax or estate tax. Previous NJ estate plan may be invalid or suboptimal.',
        opportunity: 'Estate plan update. Potential domicile-based tax savings. New network referrals.',
      },
      {
        clientId: c4.id,
        title: 'Business Sale — $3.2M Liquidity Event',
        type: 'BUSINESS_SALE',
        detectedFrom: 'Trust account large inflow detected via custodian feed',
        implications: 'Large lump-sum creates short-term tax event and long-term investment planning opportunity.',
        opportunity: 'Immediate investment of proceeds. Year-end tax planning. Gift and estate tax planning window.',
      },
      {
        clientId: c2.id,
        title: 'Second Clinic Opening — Business Expansion',
        type: 'BUSINESS_SALE',
        detectedFrom: 'Client disclosed in meeting 06/2024',
        implications: 'Increased income, new business entity, additional employees. More complex financial picture.',
        opportunity: 'DB plan, group benefits, buy-sell agreement, business succession planning.',
      },
    ],
  })

  // ── 14. Compliance Flags ──────────────────────────────────────────────────
  await prisma.complianceFlag.createMany({
    data: [
      {
        organizationId: org.id,
        type: 'UNREVIEWED_DRAFT',
        severity: 'MEDIUM',
        description: 'AI-generated outreach draft for Sarah Jenkins (churn risk client) has been pending approval for 2 days.',
        target: 'Communication:sarah-jenkins-checkin',
        aiInvolved: true,
        status: 'OPEN',
      },
      {
        organizationId: org.id,
        type: 'STALE_RECOMMENDATION',
        severity: 'HIGH',
        description: 'Tax insight "RMD Optimization for Michael Chang" has been UNDER_REVIEW for 18 days without action.',
        target: 'TaxInsight:michael-rmd',
        aiInvolved: true,
        status: 'OPEN',
      },
      {
        organizationId: org.id,
        type: 'MISSING_APPROVAL',
        severity: 'CRITICAL',
        description: 'Investment rebalance memo for Williams Trust has been approved by AI but not countersigned by licensed advisor.',
        target: 'ResearchMemo:williams-rebalance',
        aiInvolved: true,
        status: 'UNDER_REVIEW',
        reviewedBy: advisor.id,
      },
      {
        organizationId: org.id,
        type: 'RISKY_WORDING',
        severity: 'MEDIUM',
        description: 'AI-generated email to Marcus Vance (prospect) contained forward-looking performance language: "historically generated 10% returns." Needs review.',
        target: 'Communication:vance-followup-draft',
        aiInvolved: true,
        status: 'RESOLVED',
        resolvedAt: new Date(Date.now() - 3 * 86400000),
      },
    ],
  })

  // ── 15. Tasks ─────────────────────────────────────────────────────────────
  await prisma.task.createMany({
    data: [
      {
        userId: advisor.id,
        clientId: c3.id,
        title: 'Schedule outreach call — Sarah Jenkins churn risk',
        description: 'Sarah hasn\'t been contacted in 9 months. Sentiment score is 38/100. Priority outreach needed.',
        dueDate: new Date(Date.now() + 2 * 86400000),
        priority: 'URGENT',
        source: 'AI_GENERATED',
      },
      {
        userId: advisor.id,
        clientId: c6.id,
        title: 'Schedule RMD planning call — Michael Chang',
        description: 'First RMD year is approaching. Need to discuss QCD strategy and distribution planning.',
        dueDate: new Date(Date.now() + 7 * 86400000),
        priority: 'HIGH',
        source: 'AI_GENERATED',
      },
      {
        userId: advisor.id,
        clientId: c1.id,
        title: 'Execute TLH — Peterson tech sector positions',
        description: 'Year-end deadline approaching. Harvest $45k in AAPL/MSFT losses. Buy QQQ proxy.',
        dueDate: new Date(Date.now() + 14 * 86400000),
        priority: 'HIGH',
        source: 'AI_GENERATED',
      },
      {
        userId: cpa.id,
        clientId: c2.id,
        title: 'Finalize DAF contribution amount for Reyes',
        description: 'Amanda agreed to DAF strategy. CPA to finalize contribution amount and securities selection.',
        dueDate: new Date(Date.now() + 10 * 86400000),
        priority: 'HIGH',
        source: 'MANUAL',
      },
      {
        userId: advisor.id,
        clientId: evansClient.id,
        title: 'Follow up on Evans engagement letter — co-trustee signature',
        description: 'Patricia Evans has not signed engagement letter. Third reminder needed. Consider phone call.',
        dueDate: new Date(Date.now() + 1 * 86400000),
        priority: 'URGENT',
        source: 'ONBOARDING',
      },
      {
        userId: advisor.id,
        title: 'Call Marcus Vance — hot prospect 92 score',
        description: 'Opened business exit email 3x. Very high intent. Call within 24h recommended.',
        dueDate: new Date(),
        priority: 'URGENT',
        source: 'AI_GENERATED',
      },
    ],
  })

  // ── 16. Audit Logs ────────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      {
        organizationId: org.id,
        userId: null,
        action: 'AI_OPPORTUNITY_DETECTED',
        target: `Client:${c1.id}`,
        details: 'System detected $1.2M idle cash via Plaid aggregation. Opportunity created.',
        aiInvolved: true,
        severity: 'INFO',
        timestamp: new Date(Date.now() - 2 * 3600000),
      },
      {
        organizationId: org.id,
        userId: null,
        action: 'AI_TAX_INSIGHT_GENERATED',
        target: `Client:${c4.id}`,
        details: 'Tax-loss harvesting opportunity detected. $45k in Q3 tech losses available. Insight created for advisor review.',
        aiInvolved: true,
        severity: 'INFO',
        timestamp: new Date(Date.now() - 5 * 3600000),
      },
      {
        organizationId: org.id,
        userId: advisor.id,
        action: 'COMMUNICATION_SENT',
        target: `Client:${c4.id}`,
        details: 'Advisor sent Q4 rebalance memo email to Marcus Williams. AI drafted, advisor reviewed and approved.',
        aiInvolved: true,
        severity: 'INFO',
        timestamp: new Date(Date.now() - 1 * 86400000),
      },
      {
        organizationId: org.id,
        userId: null,
        action: 'AI_CHURN_RISK_DETECTED',
        target: `Client:${c3.id}`,
        details: 'Churn risk engine flagged Sarah Jenkins. Score: 82/100. No contact in 270 days. Sentiment declining.',
        aiInvolved: true,
        severity: 'WARNING',
        timestamp: new Date(Date.now() - 5 * 3600000),
      },
      {
        organizationId: org.id,
        userId: cpa.id,
        action: 'TAX_INSIGHT_REVIEWED',
        target: `Client:${c2.id}`,
        details: 'CPA Marcus Webb reviewed DAF charitable bunching insight for Dr. Reyes. Status: ACCEPTED.',
        aiInvolved: false,
        severity: 'INFO',
        timestamp: new Date(Date.now() - 7 * 86400000),
      },
      {
        organizationId: org.id,
        userId: null,
        action: 'DOCUMENT_PROCESSED',
        target: 'Williams_Estate_Plan_vFINAL.pdf',
        details: 'AI processed 214-page estate plan. Key risk extracted: Unfunded Schedule A. 5 action items generated.',
        aiInvolved: true,
        severity: 'INFO',
        timestamp: new Date(Date.now() - 2 * 86400000),
      },
      {
        organizationId: org.id,
        userId: advisor.id,
        action: 'MEETING_BRIEF_GENERATED',
        target: `Meeting:${m1.id}`,
        details: 'Pre-meeting brief generated for Williams Trust Q4 Review. 7 sections, 3 action items.',
        aiInvolved: true,
        severity: 'INFO',
        timestamp: new Date(Date.now() - 2 * 3600000),
      },
      {
        organizationId: org.id,
        userId: advisor.id,
        action: 'ONBOARDING_STAGE_UPDATED',
        target: `Client:${nguyenClient.id}`,
        details: 'Nguyen Partnership LLC advanced to ACCOUNT_SETUP stage. All documents received.',
        aiInvolved: false,
        severity: 'INFO',
        timestamp: new Date(Date.now() - 2 * 86400000),
      },
      {
        organizationId: org.id,
        userId: null,
        action: 'AI_LIFE_EVENT_DETECTED',
        target: `Client:${c5.id}`,
        details: 'Relocation to Florida detected via custodian address change. Estate plan update opportunity created.',
        aiInvolved: true,
        severity: 'WARNING',
        timestamp: new Date(Date.now() - 3 * 86400000),
      },
      {
        organizationId: org.id,
        userId: advisor.id,
        action: 'LOGIN_SUCCESS',
        target: `User:${advisor.id}`,
        details: 'MFA verified. Session started.',
        aiInvolved: false,
        severity: 'INFO',
        timestamp: new Date(Date.now() - 8 * 3600000),
      },
    ],
  })

  await prisma.notification.createMany({
    data: [
      {
        organizationId: org.id,
        userId: advisor.id,
        type: 'TASK',
        title: 'High churn follow-up needed',
        body: 'Sarah Jenkins has a churn score of 82 and no recent contact on file.',
        link: '/clients',
        status: 'UNREAD',
      },
      {
        organizationId: org.id,
        userId: advisor.id,
        type: 'MEETING',
        title: 'Meeting brief ready',
        body: 'The Williams Trust Q4 review brief has been generated from stored client data.',
        link: '/meetings',
        status: 'UNREAD',
      },
      {
        organizationId: org.id,
        userId: seniorAdvisor.id,
        type: 'REVIEW',
        title: 'Opportunity awaiting review',
        body: 'A high-value opportunity remains in pending review and needs senior approval.',
        link: '/opportunities',
        status: 'UNREAD',
      },
      {
        organizationId: org.id,
        userId: compliance.id,
        type: 'COMPLIANCE',
        title: 'Draft communications pending',
        body: 'Communications awaiting compliance approval are ready in the queue.',
        link: '/communications',
        status: 'UNREAD',
      },
    ],
  })

  const petersonAccount = await prisma.financialAccount.create({
    data: {
      clientId: c1.id,
      accountName: 'Peterson Household Taxable',
      accountType: 'JOINT_BROKERAGE',
      custodian: 'Schwab',
      taxTreatment: 'TAXABLE',
      currentValue: 4200000,
      cashBalance: 725000,
      targetEquities: 55,
      targetFixedIncome: 30,
      targetCash: 10,
      targetAlternatives: 5,
    },
  })

  await prisma.holding.createMany({
    data: [
      { accountId: petersonAccount.id, symbol: 'VMFXX', name: 'Vanguard Federal Money Market', assetClass: 'CASH', quantity: 725000, marketValue: 725000, costBasis: 725000, weightPercent: 17.26 },
      { accountId: petersonAccount.id, symbol: 'AGG', name: 'iShares Core US Aggregate Bond ETF', assetClass: 'FIXED_INCOME', quantity: 9500, marketValue: 915000, costBasis: 935000, weightPercent: 21.79 },
      { accountId: petersonAccount.id, symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', assetClass: 'EQUITY', quantity: 6400, marketValue: 1750000, costBasis: 1820000, weightPercent: 41.67 },
      { accountId: petersonAccount.id, symbol: 'VXUS', name: 'Vanguard Total International Stock ETF', assetClass: 'EQUITY', quantity: 5300, marketValue: 510000, costBasis: 620000, weightPercent: 12.14 },
      { accountId: petersonAccount.id, symbol: 'VNQ', name: 'Vanguard Real Estate ETF', assetClass: 'ALTERNATIVES', quantity: 3800, marketValue: 300000, costBasis: 340000, weightPercent: 7.14 },
    ],
  })

  const williamsAccount = await prisma.financialAccount.create({
    data: {
      clientId: c4.id,
      accountName: 'Williams Trust Core Portfolio',
      accountType: 'TRUST',
      custodian: 'Schwab',
      taxTreatment: 'TRUST',
      currentValue: 12400000,
      cashBalance: 540000,
      targetEquities: 45,
      targetFixedIncome: 35,
      targetCash: 10,
      targetAlternatives: 10,
    },
  })

  await prisma.holding.createMany({
    data: [
      { accountId: williamsAccount.id, symbol: 'AAPL', name: 'Apple Inc.', assetClass: 'EQUITY', quantity: 24000, marketValue: 2400000, costBasis: 1680000, weightPercent: 19.35 },
      { accountId: williamsAccount.id, symbol: 'NVDA', name: 'NVIDIA Corp.', assetClass: 'EQUITY', quantity: 11000, marketValue: 2100000, costBasis: 2850000, weightPercent: 16.94 },
      { accountId: williamsAccount.id, symbol: 'MSFT', name: 'Microsoft Corp.', assetClass: 'EQUITY', quantity: 9500, marketValue: 1620000, costBasis: 2100000, weightPercent: 13.06 },
      { accountId: williamsAccount.id, symbol: 'BND', name: 'Vanguard Total Bond Market ETF', assetClass: 'FIXED_INCOME', quantity: 42000, marketValue: 2980000, costBasis: 3050000, weightPercent: 24.03 },
      { accountId: williamsAccount.id, symbol: 'SCHP', name: 'Schwab US TIPS ETF', assetClass: 'FIXED_INCOME', quantity: 21000, marketValue: 1290000, costBasis: 1380000, weightPercent: 10.40 },
      { accountId: williamsAccount.id, symbol: 'HQL', name: 'Health Care Equity Fund', assetClass: 'ALTERNATIVES', quantity: 9800, marketValue: 1470000, costBasis: 1320000, weightPercent: 11.85 },
      { accountId: williamsAccount.id, symbol: 'SWVXX', name: 'Schwab Value Advantage Money Fund', assetClass: 'CASH', quantity: 540000, marketValue: 540000, costBasis: 540000, weightPercent: 4.35 },
    ],
  })

  const harrisonAccount = await prisma.financialAccount.create({
    data: {
      clientId: c5.id,
      accountName: 'Harrison Family Liquidity Reserve',
      accountType: 'FAMILY_OFFICE',
      custodian: 'Fidelity',
      taxTreatment: 'TAXABLE',
      currentValue: 21500000,
      cashBalance: 4200000,
      targetEquities: 50,
      targetFixedIncome: 20,
      targetCash: 15,
      targetAlternatives: 15,
    },
  })

  await prisma.holding.createMany({
    data: [
      { accountId: harrisonAccount.id, symbol: 'SPY', name: 'SPDR S&P 500 ETF', assetClass: 'EQUITY', quantity: 16500, marketValue: 9200000, costBasis: 7800000, weightPercent: 42.79 },
      { accountId: harrisonAccount.id, symbol: 'MUB', name: 'iShares National Muni Bond ETF', assetClass: 'FIXED_INCOME', quantity: 54000, marketValue: 3650000, costBasis: 3720000, weightPercent: 16.98 },
      { accountId: harrisonAccount.id, symbol: 'CASH', name: 'Insured Deposit Sweep', assetClass: 'CASH', quantity: 4200000, marketValue: 4200000, costBasis: 4200000, weightPercent: 19.53 },
      { accountId: harrisonAccount.id, symbol: 'BREIT', name: 'Blackstone Real Estate Income Trust', assetClass: 'ALTERNATIVES', quantity: 18500, marketValue: 2850000, costBasis: 2500000, weightPercent: 13.26 },
      { accountId: harrisonAccount.id, symbol: 'DBC', name: 'Invesco DB Commodity Index Tracking Fund', assetClass: 'ALTERNATIVES', quantity: 12000, marketValue: 1600000, costBasis: 1950000, weightPercent: 7.44 },
    ],
  })

  const reyesAccount = await prisma.financialAccount.create({
    data: {
      clientId: c2.id,
      accountName: 'Reyes Taxable Brokerage',
      accountType: 'INDIVIDUAL',
      custodian: 'Fidelity',
      taxTreatment: 'TAXABLE',
      currentValue: 6800000,
      cashBalance: 320000,
      targetEquities: 70,
      targetFixedIncome: 15,
      targetCash: 5,
      targetAlternatives: 10,
    },
  })

  await prisma.holding.createMany({
    data: [
      { accountId: reyesAccount.id, symbol: 'QQQ', name: 'Invesco QQQ Trust', assetClass: 'EQUITY', quantity: 14000, marketValue: 3200000, costBasis: 4100000, weightPercent: 47.06 },
      { accountId: reyesAccount.id, symbol: 'VUG', name: 'Vanguard Growth ETF', assetClass: 'EQUITY', quantity: 8200, marketValue: 1850000, costBasis: 1720000, weightPercent: 27.21 },
      { accountId: reyesAccount.id, symbol: 'VWO', name: 'Vanguard FTSE Emerging Markets ETF', assetClass: 'EQUITY', quantity: 4800, marketValue: 280000, costBasis: 420000, weightPercent: 4.12 },
      { accountId: reyesAccount.id, symbol: 'LQD', name: 'iShares Investment Grade Corporate Bond ETF', assetClass: 'FIXED_INCOME', quantity: 6200, marketValue: 680000, costBasis: 710000, weightPercent: 10.00 },
      { accountId: reyesAccount.id, symbol: 'PFF', name: 'iShares Preferred & Income Securities ETF', assetClass: 'FIXED_INCOME', quantity: 3500, marketValue: 370000, costBasis: 380000, weightPercent: 5.44 },
      { accountId: reyesAccount.id, symbol: 'BREIT', name: 'Blackstone Real Estate Income Trust', assetClass: 'ALTERNATIVES', quantity: 5200, marketValue: 1000000, costBasis: 850000, weightPercent: 14.71 },
      { accountId: reyesAccount.id, symbol: 'SWVXX', name: 'Schwab Value Advantage Money Fund', assetClass: 'CASH', quantity: 320000, marketValue: 320000, costBasis: 320000, weightPercent: 4.71 },
    ],
  })

  const jenkinsAccount = await prisma.financialAccount.create({
    data: {
      clientId: c3.id,
      accountName: 'Jenkins Individual IRA',
      accountType: 'IRA',
      custodian: 'Schwab',
      taxTreatment: 'TAX_DEFERRED',
      currentValue: 850000,
      cashBalance: 45000,
      targetEquities: 30,
      targetFixedIncome: 50,
      targetCash: 15,
      targetAlternatives: 5,
    },
  })

  await prisma.holding.createMany({
    data: [
      { accountId: jenkinsAccount.id, symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', assetClass: 'EQUITY', quantity: 1200, marketValue: 340000, costBasis: 380000, weightPercent: 40.00 },
      { accountId: jenkinsAccount.id, symbol: 'BND', name: 'Vanguard Total Bond Market ETF', assetClass: 'FIXED_INCOME', quantity: 6800, marketValue: 380000, costBasis: 400000, weightPercent: 44.71 },
      { accountId: jenkinsAccount.id, symbol: 'SWVXX', name: 'Schwab Value Advantage Money Fund', assetClass: 'CASH', quantity: 45000, marketValue: 45000, costBasis: 45000, weightPercent: 5.29 },
      { accountId: jenkinsAccount.id, symbol: 'SCHP', name: 'Schwab US TIPS ETF', assetClass: 'FIXED_INCOME', quantity: 1200, marketValue: 85000, costBasis: 92000, weightPercent: 10.00 },
    ],
  })

  const changAccount = await prisma.financialAccount.create({
    data: {
      clientId: c6.id,
      accountName: 'Chang Joint Brokerage',
      accountType: 'JOINT_BROKERAGE',
      custodian: 'Fidelity',
      taxTreatment: 'TAXABLE',
      currentValue: 2100000,
      cashBalance: 180000,
      targetEquities: 40,
      targetFixedIncome: 45,
      targetCash: 10,
      targetAlternatives: 5,
    },
  })

  await prisma.holding.createMany({
    data: [
      { accountId: changAccount.id, symbol: 'VTI', name: 'Vanguard Total Stock Market ETF', assetClass: 'EQUITY', quantity: 2200, marketValue: 620000, costBasis: 580000, weightPercent: 29.52 },
      { accountId: changAccount.id, symbol: 'VXUS', name: 'Vanguard Total International Stock ETF', assetClass: 'EQUITY', quantity: 1800, marketValue: 180000, costBasis: 240000, weightPercent: 8.57 },
      { accountId: changAccount.id, symbol: 'AGG', name: 'iShares Core US Aggregate Bond ETF', assetClass: 'FIXED_INCOME', quantity: 8500, marketValue: 820000, costBasis: 860000, weightPercent: 39.05 },
      { accountId: changAccount.id, symbol: 'BND', name: 'Vanguard Total Bond Market ETF', assetClass: 'FIXED_INCOME', quantity: 3200, marketValue: 300000, costBasis: 320000, weightPercent: 14.29 },
      { accountId: changAccount.id, symbol: 'SWVXX', name: 'Schwab Value Advantage Money Fund', assetClass: 'CASH', quantity: 180000, marketValue: 180000, costBasis: 180000, weightPercent: 8.57 },
    ],
  })

  // ── 10. Agents ────────────────────────────────────────────────────────────
  const agents = await prisma.agentDefinition.createMany({
    data: [
      {
        organizationId: org.id,
        name: 'Sales Agent',
        purpose: 'Identifies and progresses qualified prospects, scores leads, and drafts outreach.',
        type: 'AUTONOMOUS',
        status: 'RUNNING',
        successRate: 92,
        confidenceLevel: 87,
        icon: 'Zap',
        colorClass: 'text-amber-400',
      },
      {
        organizationId: org.id,
        name: 'Client Intelligence Agent',
        purpose: 'Builds deep client profiles, detects behavioral shifts, and surfaces relationship risks.',
        type: 'AUTONOMOUS',
        status: 'IDLE',
        successRate: 96,
        confidenceLevel: 91,
        icon: 'Users',
        colorClass: 'text-blue-400',
      },
      {
        organizationId: org.id,
        name: 'Meeting Brief Agent',
        purpose: 'Generates pre-meeting intelligence packages for advisor meetings.',
        type: 'EVENT_TRIGGERED',
        status: 'RUNNING',
        successRate: 98,
        confidenceLevel: 94,
        icon: 'Briefcase',
        colorClass: 'text-emerald-400',
      },
      {
        organizationId: org.id,
        name: 'Tax Agent',
        purpose: 'Scans portfolios for tax loss harvesting, Roth conversion windows, and CPA workflow items.',
        type: 'SCHEDULED',
        status: 'IDLE',
        successRate: 90,
        confidenceLevel: 88,
        icon: 'Landmark',
        colorClass: 'text-orange-400',
      },
      {
        organizationId: org.id,
        name: 'Investment Research Agent',
        purpose: 'Monitors markets, generates investment memos, and identifies portfolio drift.',
        type: 'AUTONOMOUS',
        status: 'RUNNING',
        successRate: 88,
        confidenceLevel: 82,
        icon: 'LineChart',
        colorClass: 'text-purple-400',
      },
      {
        organizationId: org.id,
        name: 'Document Intelligence Agent',
        purpose: 'Extracts, summarizes, and routes key information from uploaded financial documents.',
        type: 'EVENT_TRIGGERED',
        status: 'IDLE',
        successRate: 95,
        confidenceLevel: 90,
        icon: 'FileText',
        colorClass: 'text-cyan-400',
      },
      {
        organizationId: org.id,
        name: 'Relationship Agent',
        purpose: 'Tracks relationship cadence, detects engagement gaps, and triggers timely outreach.',
        type: 'AUTONOMOUS',
        status: 'REVIEW_NEEDED',
        successRate: 94,
        confidenceLevel: 89,
        icon: 'Heart',
        colorClass: 'text-rose-400',
      },
      {
        organizationId: org.id,
        name: 'Compliance Review Agent',
        purpose: 'Monitors all advisor actions and outputs for regulatory compliance and suitability.',
        type: 'AUTONOMOUS',
        status: 'RUNNING',
        successRate: 99,
        confidenceLevel: 97,
        icon: 'ShieldCheck',
        colorClass: 'text-green-400',
      },
      {
        organizationId: org.id,
        name: 'Workflow Orchestrator',
        purpose: 'Coordinates cross-agent tasks, detects bottlenecks, and prioritizes the daily work queue.',
        type: 'AUTONOMOUS',
        status: 'RUNNING',
        successRate: 97,
        confidenceLevel: 95,
        icon: 'Network',
        colorClass: 'text-indigo-400',
      },
    ],
  })

  console.log('✅ Seed complete — Drift AI demo data loaded successfully.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
