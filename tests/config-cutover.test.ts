import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

// CFG-03: no production fallback may select legacy classifier options or credentials.
test("CFG-03 System One requires a captured assessment and has no legacy option reader", async () => {
  const source = await readFile(new URL("../src/system-one.ts", import.meta.url), "utf8");
  expect(source).not.toMatch(
    /process\.env\.(JEV_EFFORT_ENABLED|JEV_SYSTEM_ONE_URL|JEV_SYSTEM_ONE_MODEL|JEV_SYSTEM_ONE_API_KEY|TYPESAFE_API_KEY)/,
  );
  expect(source).toContain("systemOneConfig(assessment: EffortAssessment)");
});
