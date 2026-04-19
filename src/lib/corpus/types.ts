export type CorpusAuthorityTier =
  | "statute"
  | "regulation"
  | "IRS guidance"
  | "firm disclosure"
  | "enforcement example"
  | "public discovery"

export interface CorpusChunkMetadata {
  source_name: string
  source_type: string
  authority_tier: CorpusAuthorityTier
  jurisdiction: string
  agency: string
  effective_date?: string | null
  publication_date?: string | null
  filing_date?: string | null
  form_type?: string | null
  firm_name?: string | null
  cik?: string | null
  crd?: string | null
  citation?: string | null
  source_url: string
  state?: string | null
  accession_number?: string | null
  sec_number?: string | null
  comment_status?: string | null
  amendment_type?: string | null
  document_type?: string | null
}

export interface ChunkSeed {
  headingPath?: string
  headingTitle?: string
  content: string
  metadata: CorpusChunkMetadata
}

export interface CorpusDocumentSeed {
  externalId: string
  title: string
  subtitle?: string
  sourceType: string
  authorityTier: CorpusAuthorityTier
  jurisdiction: string
  agency: string
  state?: string
  documentType?: string
  formType?: string
  filerName?: string
  firmName?: string
  cik?: string
  crd?: string
  secNumber?: string
  accessionNumber?: string
  amendmentType?: string
  citation?: string
  sourceUrl: string
  commentStatus?: string
  publicationDate?: Date
  effectiveDate?: Date
  filingDate?: Date
  headings?: string[]
  metadata?: Record<string, unknown>
  rawText: string
  chunks: ChunkSeed[]
}

export interface CorpusSourceDefinition {
  slug: string
  name: string
  sourceType: string
  authorityTier?: CorpusAuthorityTier
  jurisdiction: string
  agency: string
  baseUrl: string
  discoveryOnly?: boolean
}

export interface IngestionRunStats {
  documentsSeen: number
  documentsUpserted: number
  chunksUpserted: number
}

export interface RetrievalResult {
  id: string
  documentId: string
  content: string
  headingTitle: string | null
  headingPath: string | null
  lexicalScore: number
  vectorScore: number
  authorityScore: number
  freshnessScore: number
  finalScore: number
  metadata: CorpusChunkMetadata
}

export interface CitationAnswer {
  answer: string
  findings: string[]
  warnings: string[]
  citationsUsed: string[]
}
