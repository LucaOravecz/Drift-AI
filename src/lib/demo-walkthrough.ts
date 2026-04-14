export type DemoTrackId = "advisor" | "admin" | "compliance";

export type DemoWalkthroughStep = {
  id: string;
  path: string;
  title: string;
  eyebrow: string;
  summary: string;
  presenterNote: string;
  talkingPoints: string[];
  ctaLabel: string;
  rehearsalWeight: number;
};

export type DemoPersonaPreset = {
  id: string;
  label: string;
  featuredClient: string;
  scenario: string;
  whyItWins: string;
  proofPoints: string[];
};

export type DemoScenarioObjection = {
  question: string;
  answer: string;
};

export type DemoScenarioPreset = {
  id: string;
  label: string;
  hook: string;
  operatorFocus: string;
  successSignal: string;
  mustShow: string[];
  pinnedKpis: string[];
  followUpSubject: string;
  followUpBody: string;
  objections: DemoScenarioObjection[];
};

export type DemoWalkthroughTrack = {
  id: DemoTrackId;
  label: string;
  audience: string;
  description: string;
  personas: DemoPersonaPreset[];
  scenarios: DemoScenarioPreset[];
  steps: DemoWalkthroughStep[];
};

export const demoWalkthroughTracks: Record<DemoTrackId, DemoWalkthroughTrack> = {
  advisor: {
    id: "advisor",
    label: "Advisor",
    audience: "Relationship and planning teams",
    description: "Lead with advisor workflow value: what changed, which households need attention, and how the team acts next.",
    personas: [
      {
        id: "peterson-retirement-window",
        label: "Retirement Window",
        featuredClient: "Peterson Household",
        scenario: "A pre-retirement household with $4.2M AUM, idle cash, and a time-sensitive tax-loss harvesting opportunity.",
        whyItWins: "This persona shows how Drift turns stored client context into immediate planning and outreach opportunities.",
        proofPoints: [
          "12-day no-contact alert already exists in seed data.",
          "Detected $1.2M idle cash opportunity with drafted outreach.",
          "Annual review meeting is already on the calendar.",
        ],
      },
      {
        id: "williams-legacy-planning",
        label: "Legacy Planning",
        featuredClient: "Williams Trust",
        scenario: "A multi-generational trust after a business sale, balancing distributions, estate structure, and a Q4 rebalance memo.",
        whyItWins: "This persona makes the prep, trust, and advisory workflow feel high-value and relationship-specific.",
        proofPoints: [
          "Q4 portfolio review brief is seeded.",
          "Estate planning documents and rebalance memo are already in the vault.",
          "Relationship moments and trust distribution topics are visible in meetings and insights.",
        ],
      },
    ],
    scenarios: [
      {
        id: "tax-alpha-week",
        label: "Tax Alpha Week",
        hook: "The advisor needs to prove the platform can turn fresh client data into tax-aware action before a narrow planning window closes.",
        operatorFocus: "Keep the story centered on timing, advisor confidence, and concrete next actions rather than generic analytics.",
        successSignal: "The buyer leaves convinced the team can spot and act on time-sensitive opportunities faster.",
        mustShow: ["Morning brief", "Client coverage", "Meeting prep", "Readiness close"],
        pinnedKpis: ["$45k harvestable losses", "12-day contact gap", "1 review-ready brief"],
        followUpSubject: "Drift demo recap: Tax Alpha Week workflow",
        followUpBody: "Thanks for the time today. The strongest story in the demo was how Drift surfaced a time-sensitive tax opportunity, grounded it in client context, and moved the advisor toward a reviewed next action. Happy to send a deeper workflow map next.",
        objections: [
          {
            question: "How do we know this is more than a flashy dashboard?",
            answer: "The value is in the workflow handoff: the system connects signals, highlights the right household, and gives the advisor a prepared next move rather than stopping at analytics.",
          },
          {
            question: "What if the underlying data is stale?",
            answer: "That is why the trust layer is part of the demo. We show freshness, connector readiness, and demo-safe mode before making any live-data claims.",
          },
        ],
      },
      {
        id: "relationship-recovery",
        label: "Relationship Recovery",
        hook: "A key household is at risk and the advisor needs the system to surface the issue, prep the right outreach, and regain trust quickly.",
        operatorFocus: "Lean on last-contact, sentiment, and relationship context so the story feels empathetic, not just operational.",
        successSignal: "The buyer believes the product helps retain households before dissatisfaction turns into attrition.",
        mustShow: ["Morning brief", "Client coverage", "Meeting prep"],
        pinnedKpis: ["At-risk household surfaced", "Sentiment context available", "Prepared outreach path"],
        followUpSubject: "Drift demo recap: Relationship recovery workflow",
        followUpBody: "Today’s walkthrough focused on how Drift helps advisors catch relationship risk early, understand why a client may be drifting, and move into the next conversation with context instead of guesswork.",
        objections: [
          {
            question: "Is this really proactive, or does the team still need to hunt for issues?",
            answer: "The workflow is built to make risk visible in the morning brief and client coverage surfaces, so the advisor starts from prioritization rather than discovery.",
          },
          {
            question: "Can it capture nuance, not just score churn?",
            answer: "Yes. The relationship context, communication style, and recent-touch patterns are meant to give the advisor a more human path back into the relationship.",
          },
        ],
      },
    ],
    steps: [
      {
        id: "command-center",
        path: "/",
        title: "Open with the advisor command center",
        eyebrow: "Step 1 of 5",
        summary: "Start with the morning brief so the client immediately sees what changed, why it matters, and what the team should do next.",
        presenterNote: "Frame this as the operating screen an advisor checks before the first call of the day.",
        talkingPoints: [
          "Highlight the trust layer first so the room understands data freshness and action safety.",
          "Use the morning brief to explain how Drift prioritizes the handful of moments that matter instead of flooding the team.",
          "Point to the revenue engine as a reviewed draft queue, not an autonomous action machine.",
        ],
        ctaLabel: "Show client coverage",
        rehearsalWeight: 3,
      },
      {
        id: "client-coverage",
        path: "/clients",
        title: "Move into client coverage",
        eyebrow: "Step 2 of 5",
        summary: "Show that the client book is searchable, segmented, and organized around real household context instead of raw records.",
        presenterNote: "This is where you prove the data model is usable, not just comprehensive.",
        talkingPoints: [
          "Use search and type filters to show how quickly an advisor can narrow to the right household.",
          "Call out the AUM, risk, and last-contact signals as the inputs that make downstream workflows feel grounded.",
          "Tie the page back to the import and onboarding story if someone asks how data gets in.",
        ],
        ctaLabel: "Open prep workflows",
        rehearsalWeight: 2,
      },
      {
        id: "meeting-prep",
        path: "/meetings",
        title: "Show preparation workflows",
        eyebrow: "Step 3 of 5",
        summary: "Use the meeting brief surface to demonstrate how stored data becomes a concrete advisor action plan.",
        presenterNote: "The goal here is to make the intelligence feel operational, not theoretical.",
        talkingPoints: [
          "Position meeting prep as the fastest path from connected data to advisor confidence.",
          "Explain that briefs combine relationship context, likely agenda items, and current pressure points.",
          "Mention that this page is where teams feel the value of CRM and calendar syncs together.",
        ],
        ctaLabel: "Introduce the agent layer",
        rehearsalWeight: 2,
      },
      {
        id: "agent-layer",
        path: "/agents",
        title: "Introduce the agent layer",
        eyebrow: "Step 4 of 5",
        summary: "Show how the agent command center turns repeatable internal work into a governed review queue.",
        presenterNote: "Keep this framed as controlled automation with visible workload and outputs.",
        talkingPoints: [
          "Use the workforce analytics and command center framing to show there is orchestration, not hidden magic.",
          "Describe agent runs as durable work items that can be reviewed rather than background promises.",
          "If the client is skeptical of AI, emphasize human approval points and auditability.",
        ],
        ctaLabel: "Close on readiness",
        rehearsalWeight: 1,
      },
      {
        id: "readiness-close",
        path: "/integrations",
        title: "Close on integration readiness",
        eyebrow: "Step 5 of 5",
        summary: "Finish with the trust layer and implementation snapshot so the client leaves with a realistic sense of what is live today.",
        presenterNote: "End by being specific. Confidence comes from honest boundaries, not inflated claims.",
        talkingPoints: [
          "Use the trust panel to call out freshness, live coverage, and whether the environment is in demo-safe mode.",
          "Differentiate live, partial, and planned connectors clearly so the roadmap feels credible.",
          "Close by connecting readiness back to the workflows you already showed on the dashboard and meetings pages.",
        ],
        ctaLabel: "Finish walkthrough",
        rehearsalWeight: 2,
      },
    ],
  },
  admin: {
    id: "admin",
    label: "Admin",
    audience: "Firm operators and leadership",
    description: "Lead with firm-wide visibility, team governance, and how administrators control readiness across the workspace.",
    personas: [
      {
        id: "expanding-ria",
        label: "Expanding RIA",
        featuredClient: "Drift Financial Partners",
        scenario: "A five-seat professional firm growing headcount, tightening workflows, and needing stronger role and readiness visibility.",
        whyItWins: "This persona makes user governance, auditability, and operating discipline the hero of the story.",
        proofPoints: [
          "Active subscription and team roles are seeded.",
          "Admin, senior advisor, compliance, and analyst users are already in the environment.",
          "Notification and audit streams already show operational activity.",
        ],
      },
      {
        id: "uhnw-operator",
        label: "UHNW Operator",
        featuredClient: "The Harrison Family",
        scenario: "A leadership team supporting a $21.5M household with business-owner complexity, relocation issues, and referral upside.",
        whyItWins: "This persona shows why operators need visibility across approvals, integrations, and cross-team follow-up.",
        proofPoints: [
          "Florida relocation opportunity is seeded.",
          "Business concentration and estate update risk show up across records.",
          "The family has enough complexity to justify a firm-wide operating layer, not just advisor notes.",
        ],
      },
    ],
    scenarios: [
      {
        id: "multi-team-scale-up",
        label: "Multi-Team Scale-Up",
        hook: "The firm is adding users, workflows, and connected systems quickly and leadership needs proof that the operating layer will stay organized.",
        operatorFocus: "Tell a control-and-visibility story: permissions, auditability, and readiness across the firm.",
        successSignal: "The buyer believes the product can scale with the team without becoming chaotic.",
        mustShow: ["Firm command center", "User governance", "Audit ledger", "Operational readiness"],
        pinnedKpis: ["5 active seats", "Role-based access live", "Audit activity visible"],
        followUpSubject: "Drift demo recap: Multi-team scale-up story",
        followUpBody: "Today’s walkthrough focused on how Drift helps a growing firm keep governance, team coordination, and operational readiness intact as more people and workflows come online.",
        objections: [
          {
            question: "What stops this from becoming another tool that only one power user understands?",
            answer: "The admin story is built around firm-wide visibility, role structure, and shared operating surfaces, so the system scales through coordination rather than individual heroics.",
          },
          {
            question: "How do we know controls will keep up as we grow?",
            answer: "That is why the walkthrough emphasizes user governance, auditability, and readiness status together instead of treating them as separate concerns.",
          },
        ],
      },
      {
        id: "uhnw-service-model",
        label: "UHNW Service Model",
        hook: "Leadership wants to deliver a family-office-style experience without adding operational drag or losing control.",
        operatorFocus: "Connect high-complexity client service back to team coordination, approvals, and stack readiness.",
        successSignal: "The buyer sees the platform as an operating system for premium service, not just another dashboard.",
        mustShow: ["Firm command center", "Team governance", "Compliance oversight", "Operational readiness"],
        pinnedKpis: ["$21.5M household context", "Cross-team visibility", "Readiness surfaced"],
        followUpSubject: "Drift demo recap: UHNW service model",
        followUpBody: "The strongest part of today’s walkthrough was how Drift supports premium, high-complexity service without making the operating model heavier or less controlled.",
        objections: [
          {
            question: "Can this really support white-glove service, not just mid-market workflow?",
            answer: "The point of the admin story is that high-complexity households require stronger coordination, not just more notes, and the product gives the team that operating layer.",
          },
          {
            question: "Will the team trust automation in a high-touch environment?",
            answer: "Only because it stays reviewable, role-aware, and connected to the same governance surfaces leadership already expects.",
          },
        ],
      },
    ],
    steps: [
      {
        id: "ops-overview",
        path: "/",
        title: "Start with the firm command center",
        eyebrow: "Step 1 of 5",
        summary: "Open on the command center to show leadership what changed across clients, work queues, and connected systems.",
        presenterNote: "Frame this as the operating view for leadership, not just a personal dashboard.",
        talkingPoints: [
          "Use the trust layer to establish data freshness and safe operating mode immediately.",
          "Point to aggregate client, task, and opportunity signals as the firm's shared morning picture.",
          "Call out that the dashboard is designed to drive prioritization across the team, not just report metrics.",
        ],
        ctaLabel: "Show the team layer",
        rehearsalWeight: 2,
      },
      {
        id: "user-governance",
        path: "/admin/users",
        title: "Show team governance",
        eyebrow: "Step 2 of 5",
        summary: "Demonstrate how administrators manage access, invites, and role structure without leaving the workspace.",
        presenterNote: "This is where you reassure buyers that control and accountability exist alongside automation.",
        talkingPoints: [
          "Explain role-based access as a firm safety feature, not an implementation detail.",
          "Use invites and user management to show how new team members are brought in cleanly.",
          "Mention that admin controls shape what different users can approve, send, or configure elsewhere in the product.",
        ],
        ctaLabel: "Move into compliance",
        rehearsalWeight: 2,
      },
      {
        id: "compliance-surface",
        path: "/compliance",
        title: "Move into compliance oversight",
        eyebrow: "Step 3 of 5",
        summary: "Show how the firm can review sensitive outputs, resolve flagged items, and keep human governance visible.",
        presenterNote: "Keep this grounded in control, reviewability, and audit preparedness.",
        talkingPoints: [
          "Frame compliance as embedded in the workflow rather than bolted on after the fact.",
          "Show that reviewed items and escalation paths are visible, not hidden in a back office.",
          "Use this step to calm any concern that AI actions bypass governance.",
        ],
        ctaLabel: "Open the audit trail",
        rehearsalWeight: 2,
      },
      {
        id: "audit-ledger",
        path: "/audit",
        title: "Open the audit ledger",
        eyebrow: "Step 4 of 5",
        summary: "Use the audit trail to prove that system activity, approvals, and sensitive actions are traceable.",
        presenterNote: "This is one of the most trust-building moments in an enterprise conversation.",
        talkingPoints: [
          "Explain that the ledger turns operational activity into a reviewable record.",
          "Call out that auditability is part of the product design, not a future add-on.",
          "Tie the ledger back to approvals, communications, and team permissions the buyer already saw.",
        ],
        ctaLabel: "Close on operations readiness",
        rehearsalWeight: 2,
      },
      {
        id: "integration-close",
        path: "/integrations",
        title: "Close on operational readiness",
        eyebrow: "Step 5 of 5",
        summary: "Finish by showing the current health and readiness of the connected stack so the buyer leaves with realistic confidence.",
        presenterNote: "End with operational clarity: what is healthy, what is partial, and what still needs work.",
        talkingPoints: [
          "Use the trust panel to explain how current the data is and whether the environment is locked for a safe walkthrough.",
          "Show live versus partial versus planned connectors so implementation scope feels honest.",
          "Connect integration readiness back to the admin and compliance surfaces you already showed.",
        ],
        ctaLabel: "Finish walkthrough",
        rehearsalWeight: 2,
      },
    ],
  },
  compliance: {
    id: "compliance",
    label: "Compliance",
    audience: "Risk, supervision, and audit stakeholders",
    description: "Lead with review controls, auditability, and clear proof that automation still stays inside governed workflows.",
    personas: [
      {
        id: "comms-review",
        label: "Communications Review",
        featuredClient: "Williams Trust",
        scenario: "A communications and rebalance workflow where AI-assisted materials still need licensed review and countersignature.",
        whyItWins: "This persona proves the product keeps communications and advice inside supervised lanes.",
        proofPoints: [
          "Williams rebalance communication is already seeded.",
          "A compliance flag exists for advisor countersignature.",
          "Audit events show reviewed communication activity.",
        ],
      },
      {
        id: "family-office-risk",
        label: "Family Office Risk",
        featuredClient: "The Harrison Family",
        scenario: "A high-complexity family with domicile, estate, and business-owner risks where automation needs strong oversight boundaries.",
        whyItWins: "This persona makes risk reviewers comfortable by showing exactly where governance lives.",
        proofPoints: [
          "Estate plan update opportunity is seeded after the Florida move.",
          "Multiple operational and planning implications are visible across insights.",
          "The trust layer and audit ledger help frame what is live versus what still needs human review.",
        ],
      },
    ],
    scenarios: [
      {
        id: "compliance-escalation",
        label: "Compliance Escalation",
        hook: "A sensitive workflow has already produced AI-assisted output, and the reviewer needs to show how the system keeps it inside supervised lanes.",
        operatorFocus: "Anchor everything in review states, evidence trails, and clear human checkpoints.",
        successSignal: "The reviewer trusts that high-risk work is visible, interruptible, and auditable.",
        mustShow: ["Compliance review", "Audit ledger", "Communications governance", "Governed automation"],
        pinnedKpis: ["Flagged items visible", "Audit trail live", "Review states preserved"],
        followUpSubject: "Drift demo recap: Compliance escalation workflow",
        followUpBody: "The walkthrough today focused on how Drift keeps AI-assisted work inside reviewable, supervised, and auditable workflows so risk teams stay in control.",
        objections: [
          {
            question: "How do we know automation will not bypass supervision?",
            answer: "The product story is intentionally built around visible review states, audit records, and explicit approval boundaries rather than hidden background action.",
          },
          {
            question: "What happens when something is only partially implemented?",
            answer: "That is exactly why the trust and readiness layer matters. We make those limits visible instead of hiding them, which is a stronger governance posture.",
          },
        ],
      },
      {
        id: "readiness-boundaries",
        label: "Readiness Boundaries",
        hook: "Risk leaders want an honest view of what the system can do today versus where oversight must still account for partial implementation.",
        operatorFocus: "Use trust and integration readiness to make boundaries explicit instead of glossing over them.",
        successSignal: "The buyer sees strong governance because the product states its own limits clearly.",
        mustShow: ["Compliance review", "Integration boundaries", "Governed automation"],
        pinnedKpis: ["Freshness surfaced", "Live vs partial visible", "Human checkpoints clear"],
        followUpSubject: "Drift demo recap: Readiness boundaries",
        followUpBody: "A key theme in the demo was that governance improves when the product is explicit about freshness, implementation status, and where human review still matters.",
        objections: [
          {
            question: "Wouldn’t visible limitations weaken the product story?",
            answer: "For risk stakeholders, honest boundaries actually strengthen trust because they show the team will know when to lean in and when to supervise more closely.",
          },
          {
            question: "Can we rely on this across different workflows?",
            answer: "That is why the scenario ties compliance, integrations, and agents together instead of evaluating each surface in isolation.",
          },
        ],
      },
    ],
    steps: [
      {
        id: "compliance-open",
        path: "/compliance",
        title: "Open with the compliance review surface",
        eyebrow: "Step 1 of 5",
        summary: "Start where risk reviewers live so the conversation begins with control, queue clarity, and issue resolution.",
        presenterNote: "Lead with supervision, not AI cleverness.",
        talkingPoints: [
          "Frame this as the place where sensitive work becomes reviewable and actionable.",
          "Explain how flagged items surface with enough context for a human reviewer to act.",
          "Use the page to show that the system expects oversight rather than bypassing it.",
        ],
        ctaLabel: "Show the audit trail",
        rehearsalWeight: 2,
      },
      {
        id: "audit-ledger",
        path: "/audit",
        title: "Show the audit ledger",
        eyebrow: "Step 2 of 5",
        summary: "Move directly into the audit record to prove that approvals, escalations, and workflow actions are traceable.",
        presenterNote: "This is where skeptics usually start relaxing.",
        talkingPoints: [
          "Stress that key actions leave a record the firm can inspect later.",
          "Connect the ledger back to reviewed content, user actions, and escalation events.",
          "Position this as supporting supervision and post-event analysis, not just forensics.",
        ],
        ctaLabel: "Show communications governance",
        rehearsalWeight: 2,
      },
      {
        id: "communications",
        path: "/communications",
        title: "Show communications governance",
        eyebrow: "Step 3 of 5",
        summary: "Demonstrate that outbound communication still moves through reviewed workflow states before it reaches a client.",
        presenterNote: "This step is about policy control and safe execution.",
        talkingPoints: [
          "Explain approval states and why they matter for regulated communications.",
          "Use the workflow framing to show that drafts, approvals, and sends are distinct stages.",
          "Tie the page back to compliance review rather than treating it like a simple messaging screen.",
        ],
        ctaLabel: "Show integration boundaries",
        rehearsalWeight: 2,
      },
      {
        id: "integrations",
        path: "/integrations",
        title: "Show integration boundaries",
        eyebrow: "Step 4 of 5",
        summary: "Use the readiness and trust layer to explain what inputs are live, what is partial, and where supervision should expect limitations.",
        presenterNote: "Honest boundaries increase trust with risk stakeholders.",
        talkingPoints: [
          "Point to data freshness and mode safety before talking about live provider coverage.",
          "Make it clear which providers are fully active versus partially wired or planned.",
          "Use this to reinforce that oversight should always reflect current implementation reality.",
        ],
        ctaLabel: "Close on governed automation",
        rehearsalWeight: 2,
      },
      {
        id: "agents-close",
        path: "/agents",
        title: "Close on governed automation",
        eyebrow: "Step 5 of 5",
        summary: "Finish on the agent layer to show that automation runs inside visible queues and reviewable outputs rather than opaque background actions.",
        presenterNote: "End on the idea that automation is governed work, not unmanaged autonomy.",
        talkingPoints: [
          "Describe agent runs as durable work items with human visibility.",
          "Connect approvals and auditability back to what the reviewer already saw in compliance and audit.",
          "Close by emphasizing that the product is designed to keep AI inside accountable operating lanes.",
        ],
        ctaLabel: "Finish walkthrough",
        rehearsalWeight: 2,
      },
    ],
  },
};

export function getDefaultDemoTrackForRole(role: string | null | undefined): DemoTrackId {
  if (role === "ADMIN" || role === "SENIOR_ADVISOR") return "admin";
  if (role === "COMPLIANCE_OFFICER") return "compliance";
  return "advisor";
}

export function getWalkthroughStepIndex(pathname: string, trackId: DemoTrackId) {
  return demoWalkthroughTracks[trackId].steps.findIndex((step) => step.path === pathname);
}

export function getDefaultPersonaIdForTrack(trackId: DemoTrackId) {
  return demoWalkthroughTracks[trackId].personas[0]?.id ?? "";
}

export function getDefaultScenarioIdForTrack(trackId: DemoTrackId) {
  return demoWalkthroughTracks[trackId].scenarios[0]?.id ?? "";
}

export function getTrackWeightTotal(trackId: DemoTrackId) {
  return demoWalkthroughTracks[trackId].steps.reduce((sum, step) => sum + step.rehearsalWeight, 0);
}

export function getStepTargetSeconds(trackId: DemoTrackId, totalSeconds: number, stepIndex: number) {
  const track = demoWalkthroughTracks[trackId];
  const totalWeight = getTrackWeightTotal(trackId);
  const step = track.steps[stepIndex];
  if (!step || totalWeight === 0) return 0;
  return Math.round((totalSeconds * step.rehearsalWeight) / totalWeight);
}

export function getExpectedElapsedSeconds(trackId: DemoTrackId, totalSeconds: number, stepIndex: number) {
  const track = demoWalkthroughTracks[trackId];
  const totalWeight = getTrackWeightTotal(trackId);
  if (totalWeight === 0) return 0;
  const weightSoFar = track.steps.slice(0, stepIndex + 1).reduce((sum, step) => sum + step.rehearsalWeight, 0);
  return Math.round((totalSeconds * weightSoFar) / totalWeight);
}
