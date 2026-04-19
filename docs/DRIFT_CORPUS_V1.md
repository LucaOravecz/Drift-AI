# Drift Corpus v1

Drift corpus v1 is a citation-first regulatory corpus for RIA workflows built from free and public sources.

## Scope

- SEC EDGAR filings from `data.sec.gov` plus filing text from SEC archives
- IRS / tax-law authority with explicit authority tiers for statute, regulation, and IRS guidance
- FINRA rulebook, guidance, and enforcement pages from public web sources
- Form ADV / IAPD public records and SEC historical Form ADV datasets
- State RIA discovery layer using NASAA for discovery only
- Federal Register regulatory-comment layer
- Curated official-source manifest for repeatable free/public ingestion

## Data model

The corpus foundation adds:

- `corpus_sources`
- `corpus_documents`
- `corpus_chunks`
- `corpus_ingestion_runs`

Every chunk stores:

- `source_name`
- `source_type`
- `authority_tier`
- `jurisdiction`
- `agency`
- `effective_date`
- `publication_date`
- `filing_date`
- `form_type`
- `firm_name`
- `cik`
- `crd`
- `citation`
- `source_url`

## Retrieval behavior

- Lexical retrieval uses PostgreSQL full-text ranking
- Dense retrieval uses a local hashing-vector embedding so v1 does not require a paid embedding vendor
- Reranking blends lexical score, vector similarity, authority tier, and document freshness
- Answers are generated only from retrieved chunks and must cite chunk IDs inline

## Build commands

Seed sources and bootstrap discovery:

```bash
npm run corpus:build
```

Bootstrap currently includes:

- curated public-source manifest entries
- Federal Register pulls for SEC, IRS, Treasury, and Labor
- NASAA-based state discovery records
- optional SEC EDGAR filings when `--ciks` are provided

Bootstrap plus selected SEC issuers:

```bash
npm run corpus:build -- --mode=bootstrap --ciks=0000320193,0000789019 --max-filings=6
```

Ingest SEC filings only:

```bash
npm run corpus:build -- --mode=sec --ciks=0000320193
```

Ingest any official public web document into the corpus:

```bash
npm run corpus:build -- --mode=web \
  --source=irs-guidance \
  --url=https://www.irs.gov/privacy-disclosure/tax-code-regulations-and-official-guidance \
  --title="Tax code, regulations and official guidance" \
  --authority-tier="IRS guidance" \
  --agency=IRS \
  --source-type=guidance \
  --citation="IRS official guidance page"
```

Ingest the curated public-source manifest only:

```bash
npm run corpus:build -- --mode=manifest
```

Ingest a subset of manifest entries:

```bash
npm run corpus:build -- --mode=manifest --ids=irs-guidance-index,finra-rulebooks,sec-form-adv-data
```

Ingest Federal Register regulatory material for target agencies:

```bash
npm run corpus:build -- --mode=federal-register --agencies=securities-and-exchange-commission,internal-revenue-service,treasury-department,labor-department --types=RULE,PRORULE,NOTICE --per-agency=20
```

## Current constraints

- State rules are seeded as discovery records only until regulator-owned URLs are verified and ingested
- The service now includes curated IRS, FINRA, SEC Form ADV/IAPD, Federal Register, and discovery manifests, but broader historical depth still needs more manifests and bulk import jobs
- FederalRegister.gov content is useful for retrieval and comment context, but the official electronic edition remains the linked `govinfo.gov` PDF
- Current IAPD firm-level coverage still expands best from SEC historical datasets plus selected firm summary/brochure pulls
- The answering layer will refuse unsupported claims instead of inferring conclusions when no authority is retrieved
