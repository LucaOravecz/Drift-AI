import { describe, expect, it } from "vitest";

import { normalizeQuery } from "@/lib/meeting-prep/meeting-prep-retrieval";
import { scoreMeetingPrepOutput } from "../../../../evals/meeting-prep/scoring";

describe("normalizeQuery", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeQuery("  tax\t\nplanning  ")).toBe("tax planning");
  });
});

describe("scoreMeetingPrepOutput", () => {
  it("passes when fixture meets expectations", () => {
    const md = [
      "## Agenda",
      "Concentrated equity position and donor-advised fund contribution.",
      "",
      "- Details [meeting:sample]",
    ].join("\n");

    const result = scoreMeetingPrepOutput(md, {
      mustMention: ["concentrated equity", "donor-advised fund"],
      prohibitedErrors: ["guaranteed returns"],
      expectedCitations: ["meeting:sample"],
    });

    expect(result.failures).toHaveLength(0);
    expect(result.pass).toBe(true);
  });
});
