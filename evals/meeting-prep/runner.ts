import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { scoreMeetingPrepOutput, type EvalExpected } from "./scoring";

interface EvalCase {
  id: string;
  expected: EvalExpected;
  /** Optional fixture body to score when not calling the live pipeline */
  fixtureMarkdown?: string;
}

async function loadCases(root: string) {
  const entries = await readdir(root);
  const cases: EvalCase[] = [];

  for (const entry of entries) {
    if (!entry.endsWith(".json") || entry === "case-schema.json") continue;
    const filePath = path.join(root, entry);
    const contents = await readFile(filePath, "utf8");
    cases.push(JSON.parse(contents) as EvalCase);
  }

  return cases;
}

async function main() {
  const root = path.resolve(process.cwd(), "evals/meeting-prep");
  const runsDir = path.join(root, "runs");
  await mkdir(runsDir, { recursive: true });

  const cases = await loadCases(root);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

  const results: Array<{
    id: string;
    pass: boolean;
    scores: ReturnType<typeof scoreMeetingPrepOutput>["scores"];
    failures: string[];
  }> = [];

  for (const evalCase of cases) {
    const markdown =
      evalCase.fixtureMarkdown ??
      [
        "## Prior context",
        "Client asked to revisit concentrated equity position and finalize donor-advised fund contribution.",
        "",
        "- Follow prior notes [meeting:sample]",
      ].join("\n");

    const scored = scoreMeetingPrepOutput(markdown, evalCase.expected);
    results.push({
      id: evalCase.id,
      pass: scored.pass,
      scores: scored.scores,
      failures: scored.failures,
    });
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    caseCount: cases.length,
    passed: results.filter((item) => item.pass).length,
    results,
  };

  const outPath = path.join(runsDir, `run-${timestamp}.json`);
  await writeFile(outPath, JSON.stringify(summary, null, 2), "utf8");

  console.log(
    JSON.stringify(
      {
        written: outPath,
        passRate: summary.caseCount ? summary.passed / summary.caseCount : 0,
        ...summary,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
