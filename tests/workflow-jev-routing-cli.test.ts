import { expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PiFixture, root } from "./fixtures/pi-cli.ts";

for (const [background, confidence] of [
  [false, 1],
  [true, 1],
  [false, 0.09],
  [true, 0.26],
] as const)
  test(`parallel workflow fresh children receive Jev model and effort decisions (async=${background}, tier confidence=${confidence})`, async () => {
    const cli = join(root, "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js");
    const executor = join(root, "node_modules/pi-subagents/index.ts");
    const fixture = new PiFixture([
      process.execPath,
      "run",
      cli,
      "--no-extensions",
      "-e",
      executor,
      "-e",
      join(root, "src/extension.ts"),
      "--mode",
      "rpc",
      "--no-mcp",
      "--no-skills",
      "--no-context-files",
      "--no-prompt-templates",
      "--no-themes",
      "--offline",
      "--no-approve",
      "--model",
      "fixture/fixture-model",
      "--thinking",
      "high",
    ]);
    fixture.skipPackageInstall = true;
    fixture.settings = { subagents: { intercomBridge: { mode: "off" } } };
    fixture.jevConfig = {
      workerRoutingEnabled: true,
      effortEnabled: false,
      skillsEnabled: false,
      strategyEnabled: false,
      qualityEnabled: false,
      designEnabled: false,
      tiers: { deep: "fixture-deep/judgment" },
    };
    fixture.response = {
      answers: {
        tier: { choice: "deep", confidence },
        effort: { choice: "low", confidence: 1 },
        risky: { noul: 0 },
      },
    };
    fixture.prepare = async (_directory, agent) => {
      await mkdir(join(agent, "agents"), { recursive: true });
      await writeFile(
        join(agent, "agents/repro.md"),
        "---\nname: repro\ndescription: Local deterministic worker\nmodel: fixture/fixture-model\nthinking: high\ndefaultContext: fresh\ntools: read\n---\nReturn a short answer.\n",
      );
    };
    try {
      await fixture.start();
      fixture.toolCalls.push({
        name: "subagent",
        input: {
          workflow: "parallel",
          args: {
            tasks: [
              { agent: "repro", task: "First distinct task" },
              { agent: "repro", task: "Second distinct task" },
            ],
          },
          async: background,
          options: { acceptance: false },
        },
      });
      await fixture.prompt("Run the parallel workflow.");
      const toolResults = fixture.records.filter(
        (r) => r.type === "tool_execution_end" && r.toolName === "subagent",
      );
      expect(toolResults).toHaveLength(1);
      expect(toolResults[0]!.isError, JSON.stringify(toolResults[0])).toBe(false);
      if (background)
        await fixture
          .wait(() => fixture.generations.filter((r) => r.model === "judgment").length >= 2, 25000)
          .catch(() => undefined);
      const childRequests = fixture.generations.filter((r) => r.model === "judgment");
      expect(fixture.classifications.length, "one Jev classification per child").toBe(2);
      expect(childRequests, JSON.stringify(fixture.generations.map((r) => r.model))).toHaveLength(
        2,
      );
      expect(childRequests.map((r) => r.reasoning_effort)).toEqual(["low", "low"]);
    } finally {
      await fixture.close();
    }
  }, 40000);
