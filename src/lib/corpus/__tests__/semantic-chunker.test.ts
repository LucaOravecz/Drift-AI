import { describe, expect, it } from "vitest"
import { semanticChunkText } from "@/lib/corpus/semantic-chunker"

describe("semanticChunkText", () => {
  it("chunks content on section-style headings and preserves metadata", () => {
    const chunks = semanticChunkText(
      `TITLE 26
Section 1091 Wash sales
Loss from wash sale transactions shall be disallowed.

Section 7701 Definitions
The term person shall be construed broadly.`,
      {
        source_name: "Internal Revenue Code",
        source_type: "statute",
        authority_tier: "statute",
        jurisdiction: "US",
        agency: "Congress / IRS",
        source_url: "https://example.gov/26",
        citation: "26 U.S.C.",
      },
    )

    expect(chunks).toHaveLength(2)
    expect(chunks[0]?.headingTitle).toContain("Section 1091")
    expect(chunks[0]?.metadata.authority_tier).toBe("statute")
    expect(chunks[1]?.content).toContain("The term person")
  })
})
