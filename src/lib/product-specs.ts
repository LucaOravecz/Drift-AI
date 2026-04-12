export interface FeatureSpec {
  key: string;
  name: string;
  exactInputs: string[];
  deterministicLogic: string[];
  aiAssistedLogic: string[];
  outputSchema: string[];
  stateTransitions: string[];
  errorHandling: string[];
  auditLogging: string[];
}

export const PRODUCT_FEATURE_SPECS: FeatureSpec[] = [
  {
    key: "client_memory",
    name: "Client Memory Engine",
    exactInputs: [
      "Client core fields",
      "Intelligence profile",
      "Meetings",
      "Communications",
      "Tasks",
      "Life events",
      "Documents",
      "Open opportunities",
      "Tax insights",
    ],
    deterministicLogic: [
      "Build grounded claims directly from stored records",
      "Compute activity counts and missing-data list",
      "Assign overall data quality based on known missing fields",
      "Persist a snapshot record for reuse in UI and workflows",
    ],
    aiAssistedLogic: [
      "None required for the persisted memory snapshot",
      "Optional downstream AI may summarize only from the stored snapshot payload",
    ],
    outputSchema: [
      "clientId",
      "generatedBy",
      "dataQuality",
      "summary",
      "payload",
      "missingData",
      "createdAt",
    ],
    stateTransitions: [
      "No snapshot -> snapshot created",
      "Existing snapshot -> replaced by newer snapshot",
    ],
    errorHandling: [
      "Missing client returns not found error",
      "Missing fields remain explicit in payload and summary",
    ],
    auditLogging: [
      "Snapshot creation writes an audit event with data quality and missing-data metadata",
    ],
  },
  {
    key: "opportunity_engine",
    name: "Opportunity Engine",
    exactInputs: [
      "Client last contact date",
      "Meeting completion history",
      "Onboarding step statuses",
      "Churn score",
      "Open task due dates",
      "Life event records",
      "Existing opportunity records",
    ],
    deterministicLogic: [
      "Run explicit rule checks per client",
      "Deduplicate against existing active opportunities",
      "Persist only triggered opportunities",
    ],
    aiAssistedLogic: [
      "Optional outreach drafting after deterministic opportunity creation",
    ],
    outputSchema: [
      "type",
      "description",
      "evidence",
      "reasoning",
      "suggestedAction",
      "status",
      "riskLevel",
      "confidence",
    ],
    stateTransitions: [
      "No active opportunity -> DRAFT",
      "DRAFT -> PENDING_REVIEW / APPROVED / REJECTED / EXECUTED",
    ],
    errorHandling: [
      "No rule fire returns zero created records",
      "Duplicate opportunities are skipped instead of reinserted",
    ],
    auditLogging: [
      "Each scan writes a deterministic scan audit event",
    ],
  },
  {
    key: "meeting_brief",
    name: "Pre-Meeting Brief Generator",
    exactInputs: [
      "Meeting record",
      "Client memory data",
      "Open opportunities",
      "Tax insights",
      "Investment insights",
      "Tasks",
      "Life events",
      "Communication preferences",
    ],
    deterministicLogic: [
      "Build grounded brief sections from stored data only",
      "Mark missing sections as unavailable",
      "Persist brief JSON into the meeting record",
    ],
    aiAssistedLogic: [
      "Optionally generate talking points and follow-up questions only from grounded sections",
    ],
    outputSchema: [
      "generatedAt",
      "generatedBy",
      "dataQuality",
      "sections",
      "missingData",
      "disclaimer",
    ],
    stateTransitions: [
      "Meeting with no brief -> briefGenerated true with briefText saved",
    ],
    errorHandling: [
      "Missing meeting returns not found error",
      "AI failure falls back to deterministic-only brief",
    ],
    auditLogging: [
      "Brief generation writes audit metadata and user notification",
    ],
  },
  {
    key: "outreach_draft",
    name: "Outreach Draft Generator",
    exactInputs: [
      "Client record",
      "Persisted client memory snapshot",
      "Open opportunities",
      "Tax insights",
      "Open tasks",
      "Requested draft type",
      "Current advisor identity",
    ],
    deterministicLogic: [
      "Assemble a stored-data-only drafting context",
      "Decide whether enough data exists for an informed draft",
      "Persist the draft communication as PENDING_APPROVAL",
    ],
    aiAssistedLogic: [
      "Generate subject/body from the deterministic context only",
      "Fall back to an honest template when AI is unavailable or data is insufficient",
    ],
    outputSchema: [
      "communicationId",
      "subject",
      "body",
      "status",
      "generationMethod",
    ],
    stateTransitions: [
      "New draft -> PENDING_APPROVAL",
      "PENDING_APPROVAL -> APPROVED / REJECTED / SENT",
    ],
    errorHandling: [
      "Missing client returns access/not-found error",
      "Insufficient data creates an explicit minimal draft rather than invented copy",
    ],
    auditLogging: [
      "Draft creation writes audit log, compliance flag, and user notification",
    ],
  },
];
