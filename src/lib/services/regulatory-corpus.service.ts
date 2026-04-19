import "server-only"

import { Prisma } from "@prisma/client"
import prisma from "@/lib/db"
import { callClaudeJSON } from "@/lib/services/ai.service"
import { semanticChunkText, sha256 } from "@/lib/corpus/semantic-chunker"
import { PUBLIC_SOURCE_MANIFEST } from "@/lib/corpus/public-source-manifest"
import { CORPUS_SOURCE_REGISTRY } from "@/lib/corpus/source-registry"
import { STATE_REGULATOR_DISCOVERY_MANIFEST } from "@/lib/corpus/state-regulators"
import type {
  CitationAnswer,
  CorpusChunkMetadata,
  CorpusDocumentSeed,
  CorpusSourceDefinition,
  IngestionRunStats,
  RetrievalResult,
} from "@/lib/corpus/types"
import { cosineSimilarity, hashedEmbedding } from "@/lib/corpus/hashed-embedding"

export interface CorpusRetrievalFilters {
  authorityTiers?: string[]
  jurisdictions?: string[]
  sourceTypes?: string[]
  effectiveBefore?: Date
  effectiveAfter?: Date
}
const SEC_HEADERS = {
  "User-Agent": "Drift AI compliance research (support@driftai.app)",
  "Accept-Encoding": "gzip, deflate",
  Accept: "application/json, text/html, text/plain;q=0.9,*/*;q=0.8",
}

function asJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue
}

type SecSubmission = {
  name: string
  cik: string
  filings?: {
    recent?: {
      accessionNumber?: string[]
      filingDate?: string[]
      form?: string[]
      primaryDocument?: string[]
      primaryDocDescription?: string[]
    }
  }
}

type FederalRegisterAgencyResult = {
  raw_name?: string
  name?: string
  slug?: string
}

type FederalRegisterDocumentResult = {
  document_number: string
  title: string
  type: string
  abstract?: string
  html_url?: string
  pdf_url?: string
  publication_date?: string
  agencies?: FederalRegisterAgencyResult[]
}

type FederalRegisterResponse = {
  results?: FederalRegisterDocumentResult[]
}

function normalizeText(input: string): string {
  return input
    .replace(/\r/g, "\n")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#160;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

function toIsoDate(value?: string | null): string | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function parseDate(value?: string | null): Date | undefined {
  if (!value) return undefined
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function buildMetadata(seed: CorpusDocumentSeed, sourceName: string): CorpusChunkMetadata {
  return {
    source_name: sourceName,
    source_type: seed.sourceType,
    authority_tier: seed.authorityTier,
    jurisdiction: seed.jurisdiction,
    agency: seed.agency,
    effective_date: seed.effectiveDate?.toISOString() ?? null,
    publication_date: seed.publicationDate?.toISOString() ?? null,
    filing_date: seed.filingDate?.toISOString() ?? null,
    form_type: seed.formType ?? null,
    firm_name: seed.firmName ?? null,
    cik: seed.cik ?? null,
    crd: seed.crd ?? null,
    citation: seed.citation ?? null,
    source_url: seed.sourceUrl,
    state: seed.state ?? null,
    accession_number: seed.accessionNumber ?? null,
    sec_number: seed.secNumber ?? null,
    comment_status: seed.commentStatus ?? null,
    amendment_type: seed.amendmentType ?? null,
    document_type: seed.documentType ?? null,
  }
}

function authorityWeight(authorityTier: string): number {
  switch (authorityTier) {
    case "statute":
      return 1
    case "regulation":
      return 0.9
    case "IRS guidance":
      return 0.75
    case "firm disclosure":
      return 0.55
    case "enforcement example":
      return 0.45
    default:
      return 0.35
  }
}

function freshnessWeight(date?: Date | null): number {
  if (!date) return 0.2
  const ageDays = Math.max(0, (Date.now() - date.getTime()) / 86_400_000)
  return Math.max(0.1, 1 - ageDays / 3650)
}

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status}`)
  }
  return response.text()
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status}`)
  }
  return response.json() as Promise<T>
}

async function ensureSource(definition: CorpusSourceDefinition) {
  return prisma.corpusSource.upsert({
    where: { slug: definition.slug },
    create: definition,
    update: definition,
  })
}

async function upsertDocumentWithChunks(sourceSlug: string, seed: CorpusDocumentSeed): Promise<IngestionRunStats> {
  const source = await prisma.corpusSource.findUnique({ where: { slug: sourceSlug } })
  if (!source) {
    throw new Error(`Corpus source "${sourceSlug}" is not registered`)
  }

  const sourceHash = sha256(seed.sourceUrl)
  const contentHash = sha256(seed.rawText)

  const document = await prisma.corpusDocument.upsert({
    where: { sourceHash },
    create: {
      sourceId: source.id,
      externalId: seed.externalId,
      title: seed.title,
      subtitle: seed.subtitle,
      sourceType: seed.sourceType,
      authorityTier: seed.authorityTier,
      jurisdiction: seed.jurisdiction,
      agency: seed.agency,
      state: seed.state,
      documentType: seed.documentType,
      formType: seed.formType,
      filerName: seed.filerName,
      firmName: seed.firmName,
      cik: seed.cik,
      crd: seed.crd,
      secNumber: seed.secNumber,
      accessionNumber: seed.accessionNumber,
      amendmentType: seed.amendmentType,
      citation: seed.citation,
      sourceUrl: seed.sourceUrl,
      sourceHash,
      commentStatus: seed.commentStatus,
      publicationDate: seed.publicationDate,
      effectiveDate: seed.effectiveDate,
      filingDate: seed.filingDate,
      headings: asJsonValue(seed.headings ?? []),
      metadata: asJsonValue(seed.metadata ?? {}),
      rawText: seed.rawText,
      contentHash,
    },
    update: {
      title: seed.title,
      subtitle: seed.subtitle,
      sourceType: seed.sourceType,
      authorityTier: seed.authorityTier,
      jurisdiction: seed.jurisdiction,
      agency: seed.agency,
      state: seed.state,
      documentType: seed.documentType,
      formType: seed.formType,
      filerName: seed.filerName,
      firmName: seed.firmName,
      cik: seed.cik,
      crd: seed.crd,
      secNumber: seed.secNumber,
      accessionNumber: seed.accessionNumber,
      amendmentType: seed.amendmentType,
      citation: seed.citation,
      sourceUrl: seed.sourceUrl,
      commentStatus: seed.commentStatus,
      publicationDate: seed.publicationDate,
      effectiveDate: seed.effectiveDate,
      filingDate: seed.filingDate,
      headings: asJsonValue(seed.headings ?? []),
      metadata: asJsonValue(seed.metadata ?? {}),
      rawText: seed.rawText,
      contentHash,
    },
  })

  await prisma.corpusChunk.deleteMany({ where: { documentId: document.id } })

  if (seed.chunks.length > 0) {
    await prisma.corpusChunk.createMany({
      data: seed.chunks.map((chunk, index) => ({
        documentId: document.id,
        ordinal: index,
        headingPath: chunk.headingPath,
        headingTitle: chunk.headingTitle,
        content: chunk.content,
        contentHash: sha256(chunk.content),
        citation: chunk.metadata.citation,
        sourceUrl: chunk.metadata.source_url,
        sourceName: chunk.metadata.source_name,
        sourceType: chunk.metadata.source_type,
        authorityTier: chunk.metadata.authority_tier,
        jurisdiction: chunk.metadata.jurisdiction,
        agency: chunk.metadata.agency,
        state: chunk.metadata.state ?? undefined,
        effectiveDate: parseDate(chunk.metadata.effective_date),
        publicationDate: parseDate(chunk.metadata.publication_date),
        filingDate: parseDate(chunk.metadata.filing_date),
        formType: chunk.metadata.form_type ?? undefined,
        firmName: chunk.metadata.firm_name ?? undefined,
        cik: chunk.metadata.cik ?? undefined,
        crd: chunk.metadata.crd ?? undefined,
        metadata: asJsonValue(chunk.metadata),
        embeddingModel: "hashing-v1",
        embedding: asJsonValue(hashedEmbedding(`${chunk.headingTitle ?? ""}\n${chunk.content}`)),
      })),
    })
  }

  return {
    documentsSeen: 1,
    documentsUpserted: 1,
    chunksUpserted: seed.chunks.length,
  }
}

export class RegulatoryCorpusService {
  static async seedSourceRegistry() {
    await Promise.all(CORPUS_SOURCE_REGISTRY.map((source) => ensureSource(source)))
  }

  static async ingestSecSubmissions(params: { ciks: string[]; maxFilingsPerCompany?: number }) {
    await this.seedSourceRegistry()
    const source = await prisma.corpusSource.findUnique({ where: { slug: "sec-edgar" } })
    if (!source) throw new Error("SEC EDGAR source missing")

    const run = await prisma.corpusIngestionRun.create({
      data: { sourceId: source.id, mode: "SEC_SUBMISSIONS" },
    })

    try {
      let stats: IngestionRunStats = { documentsSeen: 0, documentsUpserted: 0, chunksUpserted: 0 }
      const maxFilings = params.maxFilingsPerCompany ?? 10
      const priorityForms = new Set(["10-K", "10-Q", "8-K", "S-1", "DEF 14A", "ADV", "ADV-W", "ADV-E"])

      for (const rawCik of params.ciks) {
        const cik = rawCik.padStart(10, "0")
        const json = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
          headers: SEC_HEADERS,
          cache: "no-store",
        }).then((response) => {
          if (!response.ok) throw new Error(`SEC submissions unavailable for CIK ${cik}`)
          return response.json() as Promise<SecSubmission>
        })

        const recent = json.filings?.recent
        if (!recent?.accessionNumber?.length) continue

        for (let i = 0; i < recent.accessionNumber.length && stats.documentsSeen < params.ciks.length * maxFilings; i++) {
          const form = recent.form?.[i]
          const accessionNumber = recent.accessionNumber?.[i]
          const filingDate = recent.filingDate?.[i]
          const primaryDocument = recent.primaryDocument?.[i]

          if (!form || !accessionNumber || !primaryDocument || !priorityForms.has(form)) continue

          const accessionNoDashes = accessionNumber.replace(/-/g, "")
          const archiveCik = String(Number(cik))
          const sourceUrl = `https://www.sec.gov/Archives/edgar/data/${archiveCik}/${accessionNoDashes}/${primaryDocument}`
          const rawText = normalizeText(await fetchText(sourceUrl, { headers: SEC_HEADERS, cache: "no-store" }))
          const metadata = buildMetadata({
            externalId: `${cik}:${accessionNumber}`,
            title: `${json.name} ${form}`,
            sourceType: "sec_filing",
            authorityTier: "firm disclosure",
            jurisdiction: "US",
            agency: "SEC",
            formType: form,
            filerName: json.name,
            firmName: json.name,
            cik,
            accessionNumber,
            citation: `${json.name} ${form} filed ${filingDate}`,
            sourceUrl,
            filingDate: parseDate(filingDate),
            rawText,
            chunks: [],
          }, "SEC EDGAR")
          const chunks = semanticChunkText(rawText, metadata)

          const delta = await upsertDocumentWithChunks("sec-edgar", {
            externalId: `${cik}:${accessionNumber}`,
            title: `${json.name} ${form}`,
            subtitle: recent.primaryDocDescription?.[i],
            sourceType: "sec_filing",
            authorityTier: "firm disclosure",
            jurisdiction: "US",
            agency: "SEC",
            documentType: "filing",
            formType: form,
            filerName: json.name,
            firmName: json.name,
            cik,
            accessionNumber,
            citation: `${json.name} ${form} filed ${filingDate}`,
            sourceUrl,
            filingDate: parseDate(filingDate),
            rawText,
            headings: chunks.map((chunk) => chunk.headingTitle).filter((value): value is string => Boolean(value)),
            metadata: { primaryDocument, filingDate, accessionNumber },
            chunks,
          })

          stats = {
            documentsSeen: stats.documentsSeen + delta.documentsSeen,
            documentsUpserted: stats.documentsUpserted + delta.documentsUpserted,
            chunksUpserted: stats.chunksUpserted + delta.chunksUpserted,
          }
        }
      }

      await prisma.corpusIngestionRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          documentsSeen: stats.documentsSeen,
          documentsUpserted: stats.documentsUpserted,
          chunksUpserted: stats.chunksUpserted,
        },
      })

      return stats
    } catch (error) {
      await prisma.corpusIngestionRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      })
      throw error
    }
  }

  static async ingestPublicWebDocument(sourceSlug: string, params: Omit<CorpusDocumentSeed, "rawText" | "chunks"> & { rawText?: string }) {
    await this.seedSourceRegistry()
    const source = await prisma.corpusSource.findUnique({ where: { slug: sourceSlug } })
    if (!source) throw new Error(`Unknown source slug: ${sourceSlug}`)

    const run = await prisma.corpusIngestionRun.create({
      data: { sourceId: source.id, mode: "PUBLIC_WEB_DOCUMENT" },
    })

    try {
      const fetchedRawText = params.rawText ?? normalizeText(await fetchText(params.sourceUrl, { headers: SEC_HEADERS, cache: "no-store" }))
      const metadata = buildMetadata(
        {
          ...params,
          rawText: fetchedRawText,
          chunks: [],
        },
        source.name,
      )
      const chunks = semanticChunkText(fetchedRawText, metadata)
      const stats = await upsertDocumentWithChunks(sourceSlug, {
        ...params,
        rawText: fetchedRawText,
        headings: chunks.map((chunk) => chunk.headingTitle).filter((value): value is string => Boolean(value)),
        chunks,
      })

      await prisma.corpusIngestionRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          documentsSeen: stats.documentsSeen,
          documentsUpserted: stats.documentsUpserted,
          chunksUpserted: stats.chunksUpserted,
        },
      })

      return stats
    } catch (error) {
      await prisma.corpusIngestionRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      })
      throw error
    }
  }

  static async ingestPublicSourceManifest(entryIds?: string[]) {
    await this.seedSourceRegistry()
    const entries = entryIds && entryIds.length > 0
      ? PUBLIC_SOURCE_MANIFEST.filter((entry) => entryIds.includes(entry.id))
      : PUBLIC_SOURCE_MANIFEST

    let stats: IngestionRunStats = { documentsSeen: 0, documentsUpserted: 0, chunksUpserted: 0 }

    for (const entry of entries) {
      const delta = await this.ingestPublicWebDocument(entry.sourceSlug, {
        externalId: entry.id,
        title: entry.title,
        sourceType: entry.sourceType,
        authorityTier: entry.authorityTier,
        jurisdiction: entry.jurisdiction,
        agency: entry.agency,
        documentType: entry.documentType,
        citation: entry.citation,
        sourceUrl: entry.sourceUrl,
        publicationDate: parseDate(entry.publicationDate),
        effectiveDate: parseDate(entry.effectiveDate),
        metadata: entry.metadata ?? {},
      })
      stats = {
        documentsSeen: stats.documentsSeen + delta.documentsSeen,
        documentsUpserted: stats.documentsUpserted + delta.documentsUpserted,
        chunksUpserted: stats.chunksUpserted + delta.chunksUpserted,
      }
    }

    return stats
  }

  static async ingestFederalRegister(params?: {
    agencies?: string[]
    types?: Array<"RULE" | "PRORULE" | "NOTICE">
    perAgency?: number
  }) {
    await this.seedSourceRegistry()
    const source = await prisma.corpusSource.findUnique({ where: { slug: "federal-register" } })
    if (!source) throw new Error("Federal Register source missing")

    const run = await prisma.corpusIngestionRun.create({
      data: { sourceId: source.id, mode: "FEDERAL_REGISTER_API" },
    })

    try {
      const agencies = params?.agencies ?? [
        "securities-and-exchange-commission",
        "internal-revenue-service",
        "treasury-department",
        "labor-department",
      ]
      const types = params?.types ?? ["RULE", "PRORULE", "NOTICE"]
      const perAgency = params?.perAgency ?? 15

      let stats: IngestionRunStats = { documentsSeen: 0, documentsUpserted: 0, chunksUpserted: 0 }

      for (const agencySlug of agencies) {
        const searchUrl =
          `https://www.federalregister.gov/api/v1/documents.json?per_page=${perAgency}` +
          `&order=newest&conditions[agencies][]=${encodeURIComponent(agencySlug)}` +
          types.map((type) => `&conditions[type][]=${encodeURIComponent(type)}`).join("")

        const payload = await fetchJson<FederalRegisterResponse>(searchUrl, {
          headers: { Accept: "application/json" },
          cache: "no-store",
        })

        for (const item of payload.results ?? []) {
          const sourceUrl = item.html_url ?? item.pdf_url
          if (!sourceUrl) continue

          const sourceText = item.html_url
            ? normalizeText(await fetchText(item.html_url, { headers: SEC_HEADERS, cache: "no-store" }))
            : `Federal Register PDF reference\n${item.pdf_url ?? ""}\n${item.abstract ?? ""}`.trim()

          const agenciesLabel = (item.agencies ?? [])
            .map((agency) => agency.name ?? agency.raw_name ?? agency.slug)
            .filter((value): value is string => Boolean(value))
            .join("; ")

          const documentType =
            item.type === "Rule" ? "final_rule" :
            item.type === "Proposed Rule" ? "proposed_rule" :
            "notice"

          const commentStatus =
            item.type === "Proposed Rule" || item.type === "Notice" ? "comment_context_available" : "published"

          const metadata = buildMetadata({
            externalId: item.document_number,
            title: item.title,
            sourceType: "federal_register",
            authorityTier: "public discovery",
            jurisdiction: "US",
            agency: agenciesLabel || agencySlug,
            documentType,
            citation: item.document_number,
            sourceUrl,
            publicationDate: parseDate(item.publication_date),
            commentStatus,
            rawText: sourceText,
            chunks: [],
          }, "Federal Register")

          const chunks = semanticChunkText(sourceText, metadata)
          const delta = await upsertDocumentWithChunks("federal-register", {
            externalId: item.document_number,
            title: item.title,
            sourceType: "federal_register",
            authorityTier: "public discovery",
            jurisdiction: "US",
            agency: agenciesLabel || agencySlug,
            documentType,
            citation: item.document_number,
            sourceUrl,
            commentStatus,
            publicationDate: parseDate(item.publication_date),
            metadata: {
              federalRegisterType: item.type,
              pdfUrl: item.pdf_url ?? null,
              abstract: item.abstract ?? null,
              agencies: item.agencies ?? [],
            },
            rawText: sourceText,
            chunks,
          })

          stats = {
            documentsSeen: stats.documentsSeen + delta.documentsSeen,
            documentsUpserted: stats.documentsUpserted + delta.documentsUpserted,
            chunksUpserted: stats.chunksUpserted + delta.chunksUpserted,
          }
        }
      }

      await prisma.corpusIngestionRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          documentsSeen: stats.documentsSeen,
          documentsUpserted: stats.documentsUpserted,
          chunksUpserted: stats.chunksUpserted,
        },
      })

      return stats
    } catch (error) {
      await prisma.corpusIngestionRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      })
      throw error
    }
  }

  static async ingestStateDiscoveryLayer() {
    await this.seedSourceRegistry()
    const source = await prisma.corpusSource.findUnique({ where: { slug: "state-ria-regulators" } })
    if (!source) throw new Error("State regulator source missing")

    const run = await prisma.corpusIngestionRun.create({
      data: { sourceId: source.id, mode: "STATE_DISCOVERY" },
    })

    try {
      let stats: IngestionRunStats = { documentsSeen: 0, documentsUpserted: 0, chunksUpserted: 0 }
      for (const entry of STATE_REGULATOR_DISCOVERY_MANIFEST) {
        const rawText = `${entry.state}\n${entry.regulator}\nDiscovery source: ${entry.discoveryUrl}\nThis record is for discovery only. Ingest the regulator-owned rules, forms, and notices before using it as substantive authority.`
        const metadata: CorpusChunkMetadata = {
          source_name: "State RIA Regulators",
          source_type: "state_regulator",
          authority_tier: "public discovery",
          jurisdiction: "US",
          agency: "State Securities Regulators",
          source_url: entry.discoveryUrl,
          citation: `${entry.state} regulator discovery record`,
          state: entry.state,
        }
        const delta = await upsertDocumentWithChunks("state-ria-regulators", {
          externalId: `state-discovery:${entry.state.toLowerCase().replace(/\s+/g, "-")}`,
          title: `${entry.state} adviser registration discovery`,
          sourceType: "state_regulator",
          authorityTier: "public discovery",
          jurisdiction: "US",
          agency: "State Securities Regulators",
          state: entry.state,
          documentType: "state_discovery",
          citation: `${entry.state} discovery record`,
          sourceUrl: entry.discoveryUrl,
          rawText,
          metadata: { regulator: entry.regulator, regulatorUrl: entry.regulatorUrl ?? null, discoveryOnly: true },
          chunks: semanticChunkText(rawText, metadata),
        })
        stats = {
          documentsSeen: stats.documentsSeen + delta.documentsSeen,
          documentsUpserted: stats.documentsUpserted + delta.documentsUpserted,
          chunksUpserted: stats.chunksUpserted + delta.chunksUpserted,
        }
      }

      await prisma.corpusIngestionRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          documentsSeen: stats.documentsSeen,
          documentsUpserted: stats.documentsUpserted,
          chunksUpserted: stats.chunksUpserted,
        },
      })

      return stats
    } catch (error) {
      await prisma.corpusIngestionRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      })
      throw error
    }
  }

  static async retrieve(query: string, limit = 8, filters?: CorpusRetrievalFilters): Promise<RetrievalResult[]> {
    const candidateLimit = Math.max(limit * 8, 40)
    const matchSql = Prisma.sql`
      to_tsvector('english', COALESCE(c."headingTitle", '') || ' ' || c.content)
      @@ websearch_to_tsquery('english', ${query})
    `
    const filterParts: Prisma.Sql[] = []
    if (filters?.authorityTiers?.length) {
      filterParts.push(Prisma.sql`c."authorityTier" IN (${Prisma.join(filters.authorityTiers)})`)
    }
    if (filters?.jurisdictions?.length) {
      filterParts.push(Prisma.sql`c.jurisdiction IN (${Prisma.join(filters.jurisdictions)})`)
    }
    if (filters?.sourceTypes?.length) {
      filterParts.push(Prisma.sql`c."sourceType" IN (${Prisma.join(filters.sourceTypes)})`)
    }
    if (filters?.effectiveBefore) {
      filterParts.push(Prisma.sql`(c."effectiveDate" IS NOT NULL AND c."effectiveDate" <= ${filters.effectiveBefore})`)
    }
    if (filters?.effectiveAfter) {
      filterParts.push(
        Prisma.sql`(c."effectiveDate" IS NOT NULL AND c."effectiveDate" >= ${filters.effectiveAfter})`,
      )
    }

    const whereClause =
      filterParts.length > 0 ? Prisma.join([matchSql, ...filterParts], " AND ") : matchSql

    const lexicalRows = await prisma.$queryRaw<Array<{
      id: string
      documentId: string
      content: string
      headingTitle: string | null
      headingPath: string | null
      authorityTier: string
      publicationDate: Date | null
      effectiveDate: Date | null
      filingDate: Date | null
      metadata: unknown
      lexicalScore: number | null
      embedding: unknown
    }>>`
      SELECT
        c.id,
        c."documentId",
        c.content,
        c."headingTitle",
        c."headingPath",
        c."authorityTier",
        c."publicationDate",
        c."effectiveDate",
        c."filingDate",
        c.metadata,
        ts_rank_cd(
          to_tsvector('english', COALESCE(c."headingTitle", '') || ' ' || c.content),
          websearch_to_tsquery('english', ${query})
        ) AS "lexicalScore",
        c.embedding
      FROM "corpus_chunks" c
      WHERE ${whereClause}
      ORDER BY "lexicalScore" DESC
      LIMIT ${candidateLimit}
    `

    const queryVector = hashedEmbedding(query)

    return lexicalRows
      .map((row) => {
        const metadata = (row.metadata ?? {}) as CorpusChunkMetadata
        const vector = Array.isArray(row.embedding) ? (row.embedding as number[]) : []
        const vectorScore = vector.length > 0 ? cosineSimilarity(queryVector, vector) : 0
        const authoritativeDate = row.effectiveDate ?? row.publicationDate ?? row.filingDate
        const authorityScore = authorityWeight(row.authorityTier)
        const freshnessScore = freshnessWeight(authoritativeDate)
        const lexicalScore = Number(row.lexicalScore ?? 0)
        const finalScore = lexicalScore * 0.45 + vectorScore * 0.3 + authorityScore * 0.2 + freshnessScore * 0.05

        return {
          id: row.id,
          documentId: row.documentId,
          content: row.content,
          headingTitle: row.headingTitle,
          headingPath: row.headingPath,
          lexicalScore,
          vectorScore,
          authorityScore,
          freshnessScore,
          finalScore,
          metadata,
        }
      })
      .sort((left, right) => right.finalScore - left.finalScore)
      .slice(0, limit)
  }

  static async answerQuestion(query: string, organizationId: string): Promise<CitationAnswer & { retrieval: RetrievalResult[] }> {
    const retrieval = await this.retrieve(query, 8)
    if (retrieval.length === 0) {
      return {
        answer: "I could not find authoritative corpus support for that question in the current public-source dataset, so I’m not going to guess.",
        findings: [],
        warnings: ["No supporting source chunks were retrieved from the v1 public corpus."],
        citationsUsed: [],
        retrieval,
      }
    }

    const evidenceBlock = retrieval
      .map((chunk, index) => {
        const citationId = `C${index + 1}`
        const title = chunk.headingTitle ?? chunk.metadata.citation ?? chunk.metadata.source_name
        return `${citationId}
Source: ${chunk.metadata.source_name}
Authority: ${chunk.metadata.authority_tier}
Agency: ${chunk.metadata.agency}
Citation: ${chunk.metadata.citation ?? "Not stated"}
URL: ${chunk.metadata.source_url}
Date: ${chunk.metadata.effective_date ?? chunk.metadata.publication_date ?? chunk.metadata.filing_date ?? "Not stated"}
Excerpt:
${chunk.content.slice(0, 1800)}`
      })
      .join("\n\n")

    try {
      const result = await callClaudeJSON<CitationAnswer>(
        `You answer finance/compliance questions for RIAs using only retrieved public-source authority.

Rules:
1. Every factual sentence must end with one or more citation IDs like [C1] or [C2][C3].
2. Prefer official authority over summaries.
3. Prefer statute over regulation, regulation over guidance, and guidance over firm disclosures or enforcement examples.
4. If the sources are ambiguous, outdated, or not authoritative enough, say that plainly and cite the source that shows the limitation.
5. Do not fabricate compliance conclusions.
6. Distinguish statute, regulation, agency guidance, firm disclosure, and enforcement examples when relevant.
7. Return JSON only.`,
        `Question: ${query}

Retrieved evidence:
${evidenceBlock}

Return JSON:
{
  "answer": "Short answer with citations in every sentence.",
  "findings": ["Bullet-length factual findings with citations in every item."],
  "warnings": ["Any ambiguity or authority caveat with citations."],
  "citationsUsed": ["C1", "C2"]
}`,
        {
          organizationId,
          feature: "RESEARCH_MEMO",
          maxTokens: 1800,
          schema: {
            type: "object",
            properties: {
              answer: { type: "string" },
              findings: { type: "array", items: { type: "string" } },
              warnings: { type: "array", items: { type: "string" } },
              citationsUsed: { type: "array", items: { type: "string" } },
            },
            required: ["answer", "findings", "warnings", "citationsUsed"],
          },
        },
      )

      return { ...result, retrieval }
    } catch {
      const citationsUsed = retrieval.slice(0, 3).map((_, index) => `C${index + 1}`)
      return {
        answer: `Relevant authority was retrieved, but synthesis failed. Review the cited chunks directly before relying on any conclusion. [${citationsUsed.join("][")}]`,
        findings: retrieval.slice(0, 3).map((chunk, index) => {
          const citationId = `C${index + 1}`
          return `${chunk.metadata.authority_tier.toUpperCase()}: ${chunk.headingTitle ?? chunk.metadata.citation ?? chunk.metadata.source_name}. [${citationId}]`
        }),
        warnings: ["This fallback did not synthesize a legal/compliance conclusion; it only surfaces the strongest retrieved authority. [C1]"],
        citationsUsed,
        retrieval,
      }
    }
  }

  static isRegulatoryQuestion(prompt: string): boolean {
    return /\b(finra|sec|adv|form crs|ria|investment adviser|compliance|regulation|rule|reg bi|fiduciary|custody|disclosure|tax code|irs|treasury regulation|federal register)\b/i.test(prompt)
  }

  static formatRetrievalForUi(results: RetrievalResult[]) {
    return results.map((result, index) => {
      const citationId = `C${index + 1}`
      const date = result.metadata.effective_date ?? result.metadata.publication_date ?? result.metadata.filing_date
      return `${citationId} — ${result.metadata.source_name} | ${result.metadata.authority_tier} | ${result.metadata.citation ?? "No formal citation"} | ${date ?? "No date"} | ${result.metadata.source_url}`
    })
  }
}
