import "server-only"

import { RegulatoryCorpusService } from "@/lib/services/regulatory-corpus.service"

function getArg(flag: string): string | undefined {
  const entry = process.argv.find((value) => value.startsWith(`${flag}=`))
  return entry?.slice(flag.length + 1)
}

function getCsv(flag: string): string[] {
  const value = getArg(flag)
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : []
}

async function main() {
  const mode = getArg("--mode") ?? "bootstrap"

  await RegulatoryCorpusService.seedSourceRegistry()

  if (mode === "bootstrap") {
    await RegulatoryCorpusService.ingestPublicSourceManifest()
    await RegulatoryCorpusService.ingestFederalRegister()
    await RegulatoryCorpusService.ingestStateDiscoveryLayer()
    const ciks = getCsv("--ciks")
    if (ciks.length > 0) {
      await RegulatoryCorpusService.ingestSecSubmissions({ ciks, maxFilingsPerCompany: Number(getArg("--max-filings") ?? 8) })
    }
    console.log("Bootstrap complete.")
    return
  }

  if (mode === "sec") {
    const ciks = getCsv("--ciks")
    if (ciks.length === 0) {
      throw new Error("Pass one or more CIKs with --ciks=0000320193,0000789019")
    }
    const stats = await RegulatoryCorpusService.ingestSecSubmissions({
      ciks,
      maxFilingsPerCompany: Number(getArg("--max-filings") ?? 8),
    })
    console.log(JSON.stringify(stats, null, 2))
    return
  }

  if (mode === "web") {
    const sourceSlug = getArg("--source")
    const sourceUrl = getArg("--url")
    const title = getArg("--title")
    const authorityTier = getArg("--authority-tier") as
      | "statute"
      | "regulation"
      | "IRS guidance"
      | "firm disclosure"
      | "enforcement example"
      | "public discovery"
      | undefined

    if (!sourceSlug || !sourceUrl || !title || !authorityTier) {
      throw new Error("Web mode requires --source, --url, --title, and --authority-tier")
    }

    const stats = await RegulatoryCorpusService.ingestPublicWebDocument(sourceSlug, {
      externalId: getArg("--external-id") ?? sourceUrl,
      title,
      subtitle: getArg("--subtitle"),
      sourceType: getArg("--source-type") ?? "web_document",
      authorityTier,
      jurisdiction: getArg("--jurisdiction") ?? "US",
      agency: getArg("--agency") ?? "Unknown",
      state: getArg("--state"),
      documentType: getArg("--document-type"),
      formType: getArg("--form-type"),
      filerName: getArg("--filer-name"),
      firmName: getArg("--firm-name"),
      cik: getArg("--cik"),
      crd: getArg("--crd"),
      secNumber: getArg("--sec-number"),
      accessionNumber: getArg("--accession-number"),
      amendmentType: getArg("--amendment-type"),
      citation: getArg("--citation"),
      sourceUrl,
      commentStatus: getArg("--comment-status"),
      publicationDate: getArg("--publication-date") ? new Date(getArg("--publication-date")!) : undefined,
      effectiveDate: getArg("--effective-date") ? new Date(getArg("--effective-date")!) : undefined,
      filingDate: getArg("--filing-date") ? new Date(getArg("--filing-date")!) : undefined,
      metadata: {},
    })
    console.log(JSON.stringify(stats, null, 2))
    return
  }

  if (mode === "state-discovery") {
    const stats = await RegulatoryCorpusService.ingestStateDiscoveryLayer()
    console.log(JSON.stringify(stats, null, 2))
    return
  }

  if (mode === "manifest") {
    const stats = await RegulatoryCorpusService.ingestPublicSourceManifest(getCsv("--ids"))
    console.log(JSON.stringify(stats, null, 2))
    return
  }

  if (mode === "federal-register") {
    const stats = await RegulatoryCorpusService.ingestFederalRegister({
      agencies: getCsv("--agencies"),
      types: (getCsv("--types") as Array<"RULE" | "PRORULE" | "NOTICE">),
      perAgency: Number(getArg("--per-agency") ?? 15),
    })
    console.log(JSON.stringify(stats, null, 2))
    return
  }

  throw new Error(`Unknown mode: ${mode}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
