import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { root } from "./fixtures/pi-cli.ts";

// F5: enabled executor and acceptance fixtures must match mandatory authority dependency.
test("F5 documented enabled executor and active fixture pins match mandatory authority dependency", async () => {
  const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const sha = manifest.dependencies["pi-subagents"].split("#")[1];
  expect(sha).toBe("d9f8f8c9a709a23adf5f323bb046f3fa91517d4c");
  const readme = await readFile(join(root, "README.md"), "utf8");
  expect(readme).toContain(`pi install git:github.com/naicoi92/pi-subagents@${sha}`);
  for (const file of [
    "package-acceptance.test.ts",
    "worker-routing-cli.test.ts",
    "worker-adapter-feasibility.test.ts",
    "junior-required-denied-cli.test.ts",
    "junior-turn-bound-cli.test.ts",
  ]) {
    const source = await readFile(join(root, "tests", file), "utf8");
    expect(source, file).toContain(sha);
    expect(source, file).not.toContain("5f8adccb235f1a45858c84b5110c105108947de2");
  }
});
