-- Phase 1: trust-oriented meeting prep foundation

CREATE TABLE "households" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "advisorOwnerId" TEXT,
  "displayName" TEXT NOT NULL,
  "riskProfile" TEXT,
  "taxStatus" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "households"
  ADD CONSTRAINT "households_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "households"
  ADD CONSTRAINT "households_advisorOwnerId_fkey"
  FOREIGN KEY ("advisorOwnerId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "clients"
  ADD CONSTRAINT "clients_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "households"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "documents"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "householdId" TEXT,
  ADD COLUMN "title" TEXT,
  ADD COLUMN "sourceType" TEXT,
  ADD COLUMN "authorityLevel" TEXT,
  ADD COLUMN "effectiveDate" TIMESTAMP(3),
  ADD COLUMN "jurisdiction" TEXT,
  ADD COLUMN "tags" JSONB,
  ADD COLUMN "rawText" TEXT,
  ADD COLUMN "parsedSections" JSONB,
  ADD COLUMN "metadataJson" JSONB;

ALTER TABLE "documents"
  ADD CONSTRAINT "documents_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "households"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "meetings"
  ADD COLUMN "householdId" TEXT,
  ADD COLUMN "rawCalendarContext" TEXT;

ALTER TABLE "meetings"
  ADD CONSTRAINT "meetings_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "households"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "document_chunks" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "householdId" TEXT,
  "sectionPath" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "tokenCount" INTEGER NOT NULL DEFAULT 0,
  "embeddingVectorRef" TEXT,
  "keywordText" TEXT NOT NULL,
  "citationLabel" TEXT NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "document_chunks"
  ADD CONSTRAINT "document_chunks_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "documents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "meeting_briefs" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "householdId" TEXT,
  "meetingId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "schemaJson" JSONB NOT NULL,
  "renderedMarkdown" TEXT,
  "overallConfidence" TEXT,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "pipelineTrace" JSONB,
  CONSTRAINT "meeting_briefs_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "meeting_briefs"
  ADD CONSTRAINT "meeting_briefs_householdId_fkey"
  FOREIGN KEY ("householdId") REFERENCES "households"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "meeting_briefs"
  ADD CONSTRAINT "meeting_briefs_meetingId_fkey"
  FOREIGN KEY ("meetingId") REFERENCES "meetings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "claim_verifications" (
  "id" TEXT NOT NULL,
  "meetingBriefId" TEXT NOT NULL,
  "claimText" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "supportingChunkIds" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "claim_verifications_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "claim_verifications"
  ADD CONSTRAINT "claim_verifications_meetingBriefId_fkey"
  FOREIGN KEY ("meetingBriefId") REFERENCES "meeting_briefs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "households_organizationId_idx" ON "households"("organizationId");
CREATE INDEX "households_advisorOwnerId_idx" ON "households"("advisorOwnerId");
CREATE INDEX "documents_organizationId_idx" ON "documents"("organizationId");
CREATE INDEX "documents_householdId_idx" ON "documents"("householdId");
CREATE INDEX "meetings_householdId_idx" ON "meetings"("householdId");
CREATE INDEX "document_chunks_documentId_idx" ON "document_chunks"("documentId");
CREATE INDEX "document_chunks_organizationId_idx" ON "document_chunks"("organizationId");
CREATE INDEX "document_chunks_householdId_idx" ON "document_chunks"("householdId");
CREATE INDEX "document_chunks_citationLabel_idx" ON "document_chunks"("citationLabel");
CREATE INDEX "meeting_briefs_organizationId_idx" ON "meeting_briefs"("organizationId");
CREATE INDEX "meeting_briefs_householdId_idx" ON "meeting_briefs"("householdId");
CREATE INDEX "meeting_briefs_meetingId_idx" ON "meeting_briefs"("meetingId");
CREATE INDEX "meeting_briefs_status_idx" ON "meeting_briefs"("status");
CREATE INDEX "claim_verifications_meetingBriefId_idx" ON "claim_verifications"("meetingBriefId");
CREATE INDEX "claim_verifications_verified_idx" ON "claim_verifications"("verified");
