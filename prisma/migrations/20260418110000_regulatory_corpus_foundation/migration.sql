CREATE TABLE "corpus_sources" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "authorityTier" TEXT,
    "jurisdiction" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "discoveryOnly" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corpus_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "corpus_documents" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "sourceType" TEXT NOT NULL,
    "authorityTier" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "state" TEXT,
    "documentType" TEXT,
    "formType" TEXT,
    "filerName" TEXT,
    "firmName" TEXT,
    "cik" TEXT,
    "crd" TEXT,
    "secNumber" TEXT,
    "accessionNumber" TEXT,
    "amendmentType" TEXT,
    "citation" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "commentStatus" TEXT,
    "publicationDate" TIMESTAMP(3),
    "effectiveDate" TIMESTAMP(3),
    "filingDate" TIMESTAMP(3),
    "headings" JSONB,
    "metadata" JSONB,
    "rawText" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corpus_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "corpus_chunks" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "headingPath" TEXT,
    "headingTitle" TEXT,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "citation" TEXT,
    "sourceUrl" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "authorityTier" TEXT NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "agency" TEXT NOT NULL,
    "state" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "publicationDate" TIMESTAMP(3),
    "filingDate" TIMESTAMP(3),
    "formType" TEXT,
    "firmName" TEXT,
    "cik" TEXT,
    "crd" TEXT,
    "metadata" JSONB,
    "embeddingModel" TEXT,
    "embedding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "corpus_chunks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "corpus_ingestion_runs" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "mode" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "documentsSeen" INTEGER NOT NULL DEFAULT 0,
    "documentsUpserted" INTEGER NOT NULL DEFAULT 0,
    "chunksUpserted" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "notes" JSONB,

    CONSTRAINT "corpus_ingestion_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "corpus_sources_slug_key" ON "corpus_sources"("slug");
CREATE INDEX "corpus_sources_jurisdiction_agency_idx" ON "corpus_sources"("jurisdiction", "agency");

CREATE UNIQUE INDEX "corpus_documents_sourceId_externalId_key" ON "corpus_documents"("sourceId", "externalId");
CREATE UNIQUE INDEX "corpus_documents_sourceHash_key" ON "corpus_documents"("sourceHash");
CREATE INDEX "corpus_documents_authorityTier_agency_jurisdiction_idx" ON "corpus_documents"("authorityTier", "agency", "jurisdiction");
CREATE INDEX "corpus_documents_publicationDate_idx" ON "corpus_documents"("publicationDate");
CREATE INDEX "corpus_documents_effectiveDate_idx" ON "corpus_documents"("effectiveDate");
CREATE INDEX "corpus_documents_filingDate_idx" ON "corpus_documents"("filingDate");
CREATE INDEX "corpus_documents_formType_idx" ON "corpus_documents"("formType");
CREATE INDEX "corpus_documents_cik_idx" ON "corpus_documents"("cik");
CREATE INDEX "corpus_documents_crd_idx" ON "corpus_documents"("crd");

CREATE UNIQUE INDEX "corpus_chunks_documentId_ordinal_key" ON "corpus_chunks"("documentId", "ordinal");
CREATE INDEX "corpus_chunks_authorityTier_agency_jurisdiction_idx" ON "corpus_chunks"("authorityTier", "agency", "jurisdiction");
CREATE INDEX "corpus_chunks_publicationDate_idx" ON "corpus_chunks"("publicationDate");
CREATE INDEX "corpus_chunks_effectiveDate_idx" ON "corpus_chunks"("effectiveDate");
CREATE INDEX "corpus_chunks_filingDate_idx" ON "corpus_chunks"("filingDate");
CREATE INDEX "corpus_chunks_formType_idx" ON "corpus_chunks"("formType");
CREATE INDEX "corpus_chunks_cik_idx" ON "corpus_chunks"("cik");
CREATE INDEX "corpus_chunks_crd_idx" ON "corpus_chunks"("crd");
CREATE INDEX "corpus_chunks_fulltext_idx" ON "corpus_chunks" USING GIN (to_tsvector('english', COALESCE("headingTitle", '') || ' ' || "content"));

CREATE INDEX "corpus_ingestion_runs_sourceId_startedAt_idx" ON "corpus_ingestion_runs"("sourceId", "startedAt");
CREATE INDEX "corpus_ingestion_runs_status_idx" ON "corpus_ingestion_runs"("status");

ALTER TABLE "corpus_documents" ADD CONSTRAINT "corpus_documents_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "corpus_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "corpus_chunks" ADD CONSTRAINT "corpus_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "corpus_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "corpus_ingestion_runs" ADD CONSTRAINT "corpus_ingestion_runs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "corpus_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
