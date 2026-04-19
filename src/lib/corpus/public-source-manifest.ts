import type { CorpusAuthorityTier } from "@/lib/corpus/types"

export interface PublicSourceManifestEntry {
  id: string
  sourceSlug: string
  title: string
  sourceUrl: string
  sourceType: string
  authorityTier: CorpusAuthorityTier
  agency: string
  jurisdiction: string
  documentType: string
  citation?: string
  publicationDate?: string
  effectiveDate?: string
  metadata?: Record<string, unknown>
}

export const PUBLIC_SOURCE_MANIFEST: PublicSourceManifestEntry[] = [
  {
    id: "irs-guidance-index",
    sourceSlug: "irs-guidance",
    title: "IRS guidance",
    sourceUrl: "https://www.irs.gov/newsroom/irs-guidance",
    sourceType: "guidance_index",
    authorityTier: "IRS guidance",
    agency: "IRS",
    jurisdiction: "US",
    documentType: "guidance_index",
    citation: "IRS guidance page",
    publicationDate: "2026-01-15",
  },
  {
    id: "irs-irb-index",
    sourceSlug: "irs-guidance",
    title: "Internal Revenue Bulletins",
    sourceUrl: "https://www.irs.gov/internal-revenue-bulletins",
    sourceType: "internal_revenue_bulletin_index",
    authorityTier: "IRS guidance",
    agency: "IRS",
    jurisdiction: "US",
    documentType: "internal_revenue_bulletin_index",
    citation: "Internal Revenue Bulletin index",
  },
  {
    id: "irs-tax-law-overview",
    sourceSlug: "irs-guidance",
    title: "Tax code, regulations and official guidance",
    sourceUrl: "https://www.irs.gov/privacy-disclosure/tax-code-regulations-and-official-guidance",
    sourceType: "guidance_overview",
    authorityTier: "IRS guidance",
    agency: "IRS",
    jurisdiction: "US",
    documentType: "guidance_overview",
    citation: "IRS tax code, regulations and official guidance overview",
  },
  {
    id: "finra-rulebooks",
    sourceSlug: "finra-rules",
    title: "FINRA Manual",
    sourceUrl: "https://www.finra.org/rules-guidance/rulebooks",
    sourceType: "rulebook_index",
    authorityTier: "regulation",
    agency: "FINRA",
    jurisdiction: "US",
    documentType: "rulebook_index",
    citation: "FINRA Manual",
  },
  {
    id: "finra-rules-guidance",
    sourceSlug: "finra-rules",
    title: "FINRA Rules & Guidance",
    sourceUrl: "https://www.finra.org/rules-guidance",
    sourceType: "guidance_index",
    authorityTier: "regulation",
    agency: "FINRA",
    jurisdiction: "US",
    documentType: "guidance_index",
    citation: "FINRA Rules & Guidance",
  },
  {
    id: "finra-disciplinary-actions",
    sourceSlug: "finra-enforcement",
    title: "Monthly Disciplinary Actions",
    sourceUrl: "https://www.finra.org/rules-guidance/oversight-enforcement/disciplinary-actions",
    sourceType: "disciplinary_actions_index",
    authorityTier: "enforcement example",
    agency: "FINRA",
    jurisdiction: "US",
    documentType: "disciplinary_actions_index",
    citation: "FINRA Monthly Disciplinary Actions",
  },
  {
    id: "sec-form-adv-data",
    sourceSlug: "form-adv-iapd",
    title: "Form ADV Data",
    sourceUrl: "https://www.sec.gov/foia-services/frequently-requested-documents/form-adv-data",
    sourceType: "form_adv_data_index",
    authorityTier: "firm disclosure",
    agency: "SEC",
    jurisdiction: "US",
    documentType: "form_adv_data_index",
    citation: "SEC Form ADV Data",
  },
  {
    id: "sec-adviser-info-report",
    sourceSlug: "form-adv-iapd",
    title: "Information About Registered Investment Advisers and Exempt Reporting Advisers",
    sourceUrl: "https://www.sec.gov/data-research/sec-markets-data/information-about-registered-investment-advisers-exempt-reporting-advisers",
    sourceType: "adviser_data_index",
    authorityTier: "firm disclosure",
    agency: "SEC",
    jurisdiction: "US",
    documentType: "adviser_data_index",
    citation: "SEC registered investment adviser and exempt reporting adviser information page",
  },
  {
    id: "iapd-home",
    sourceSlug: "form-adv-iapd",
    title: "IAPD Homepage",
    sourceUrl: "https://adviserinfo.sec.gov/adv",
    sourceType: "iapd_index",
    authorityTier: "firm disclosure",
    agency: "SEC / FINRA",
    jurisdiction: "US",
    documentType: "iapd_index",
    citation: "Investment Adviser Public Disclosure website",
  },
  {
    id: "sec-edgar-api-docs",
    sourceSlug: "sec-edgar",
    title: "EDGAR Application Programming Interfaces",
    sourceUrl: "https://www.sec.gov/edgar/sec-api-documentation",
    sourceType: "developer_reference",
    authorityTier: "firm disclosure",
    agency: "SEC",
    jurisdiction: "US",
    documentType: "developer_reference",
    citation: "SEC EDGAR API documentation",
  },
  {
    id: "federal-register-api-docs",
    sourceSlug: "federal-register",
    title: "Federal Register API Documentation",
    sourceUrl: "https://www.federalregister.gov/developers/api/v1",
    sourceType: "developer_reference",
    authorityTier: "public discovery",
    agency: "Federal Register",
    jurisdiction: "US",
    documentType: "developer_reference",
    citation: "Federal Register API documentation",
    metadata: {
      warning: "FederalRegister.gov is an unofficial informational layer; use linked govinfo PDFs for official electronic editions.",
    },
  },
  {
    id: "nasaa-state-registration",
    sourceSlug: "state-ria-regulators",
    title: "State Investment Adviser Registration Information",
    sourceUrl: "https://www.nasaa.org/industry-resources/investment-advisers/state-investment-adviser-registration-information/",
    sourceType: "state_discovery_index",
    authorityTier: "public discovery",
    agency: "NASAA",
    jurisdiction: "US",
    documentType: "state_discovery_index",
    citation: "NASAA state investment adviser registration information",
    metadata: {
      warning: "Use only for discovery; ingest regulator-owned rules and notices for substantive authority.",
    },
  },
]
