import { describe, expect, it } from "vitest"
import { PUBLIC_SOURCE_MANIFEST } from "@/lib/corpus/public-source-manifest"

describe("PUBLIC_SOURCE_MANIFEST", () => {
  it("uses unique ids and official https urls", () => {
    const ids = PUBLIC_SOURCE_MANIFEST.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const entry of PUBLIC_SOURCE_MANIFEST) {
      expect(entry.sourceUrl.startsWith("https://")).toBe(true)
      expect(entry.jurisdiction).toBe("US")
    }
  })
})
