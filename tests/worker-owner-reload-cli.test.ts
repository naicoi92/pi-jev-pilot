import { expect, test } from "bun:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PiFixture, root } from "./fixtures/pi-cli.ts";

// AC-1 / AC-3 / AC-5: native host lifecycle, real executor admission and fake loopback transport.
// JEV_OWNER_CLI selects Pi-Bolt; executor may be a distinct installed copy to prove registry sharing.
test("owner reload restores native fresh dispatch without bypassing missing or stale fences", async () => {
  const executor = process.env.JEV_OWNER_EXECUTOR ?? join(root, "node_modules/pi-subagents");
  const cli =
    process.env.JEV_OWNER_CLI ??
    join(root, "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js");
  const fixture = new PiFixture([
    ...(cli.endsWith(".js") ? [process.execPath, "run", cli] : [cli]),
    "--no-extensions",
    "-e",
    join(root, "tests/fixtures/worker-owner-lifecycle.ts"),
    "-e",
    join(executor, "index.ts"),
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
  fixture.settings = {
    jevPilot: { tiers: { balanced: "fixture/fixture-model" } },
    subagents: { intercomBridge: { mode: "off" } },
  };
  const log = join(process.env.JEV_OWNER_EVIDENCE ?? "/tmp", `owner-${crypto.randomUUID()}.jsonl`);
  fixture.response = {
    answers: {
      effort: { choice: "low", confidence: 0 },
      risky: { noul: 0 },
      tier: { choice: "balanced", confidence: 1 },
    },
  };
  try {
    await fixture.start({
      JEV_OWNER_EXECUTOR_API: join(executor, "src/api/worker-decision-authority.ts"),
      JEV_OWNER_LOG: log,
      JEV_WORKER_ROUTING_ENABLED: "true",
      JEV_SKILLS_ENABLED: "false",
      JEV_EFFORT_ENABLED: "false",
      JEV_TIMEOUT_MS: "5000",
      PI_SUBAGENTS_TEMP_ROOT: join("/tmp", `owner-runtime-${crypto.randomUUID()}`),
    });
    await mkdir(join(fixture.directory, "agent/agents"), { recursive: true });
    await writeFile(
      join(fixture.directory, "agent/agents/owner-worker.md"),
      "---\nname: owner-worker\ndescription: Bounded local worker\nmodel: fixture/fixture-model\nthinking: high\ndefaultContext: fresh\ntools: read\ntimeout: 10000\n---\nReturn fixture answer without tools.\n",
    );
    const status = async () => {
      await fixture.command("prompt", { message: "/owner-status" });
      await fixture.command("get_state");
      return JSON.parse((await readFile(log, "utf8")).trim().split("\n").at(-1)!);
    };
    const dispatch = async () => {
      const offset = fixture.records.length;
      const generations = fixture.generations.length;
      fixture.toolCalls.push({
        name: "subagent",
        input: {
          agent: "owner-worker",
          task: "Return local result without tools.",
          async: false,
          options: { context: "fresh", acceptance: false, artifacts: false, timeoutMs: 10000 },
        },
      });
      await fixture.prompt("Run bounded local worker.");
      const results = fixture.records
        .slice(offset)
        .filter((entry) => entry.type === "tool_execution_end" && entry.toolName === "subagent");
      expect(results.length, JSON.stringify({ results, stderr: fixture.stderr })).toBe(1);
      return { result: results[0]!, requests: fixture.generations.slice(generations) };
    };
    const startup = await status();
    await fixture.command("prompt", { message: "/owner-reload" });
    await fixture.command("get_state");
    const reloaded = await status();
    const launched = await dispatch();
    console.log(
      "native owner evidence",
      JSON.stringify({
        startup,
        reloaded,
        result: launched.result,
        efforts: launched.requests.map((request) => request.reasoning_effort),
      }),
    );
    // First assertion intentionally exposes exact incident error on baseline, before metadata checks.
    expect(launched.result.isError, JSON.stringify(launched.result)).toBe(false);
    expect(JSON.stringify(launched.result)).not.toContain("owner-missing");
    expect(launched.requests.length).toBe(3); // parent call, actual child provider, parent completion
    expect(launched.requests[1]!.reasoning_effort).toBe("low");
    expect(startup.dependency.kind).toBe("active");
    expect(startup.executor).toEqual(startup.dependency);
    expect(reloaded.executor).toEqual(reloaded.dependency);
    expect(reloaded.executor.kind).toBe("active");
    expect(reloaded.executor.generation).not.toBe(startup.executor.generation);
    expect(reloaded.sessionId).toBe(startup.sessionId);
    expect(reloaded.sessionId).not.toBe(reloaded.uuid);

    await fixture.command("prompt", { message: "/owner-missing" });
    const missing = await dispatch();
    expect(missing.result.isError).toBe(true);
    expect(JSON.stringify(missing.result)).toContain(
      "Worker decision authority blocked: owner-missing.",
    );
    expect(missing.requests.length).toBe(2); // no child provider request

    await fixture.command("prompt", { message: "/owner-reload" });
    await fixture.command("get_state");
    await fixture.command("prompt", { message: "/owner-mismatch" });
    const stale = await dispatch();
    expect(stale.result.isError).toBe(true);
    expect(JSON.stringify(stale.result)).toContain(
      "Worker decision authority blocked: stale-owner.",
    );
    expect(stale.requests.length).toBe(2);
    await fixture.stop();
    expect(fixture.process.exitCode).toBe(0);
  } finally {
    if (process.env.JEV_OWNER_EVIDENCE)
      await writeFile(
        join(process.env.JEV_OWNER_EVIDENCE, "native-records.json"),
        JSON.stringify(
          {
            records: fixture.records,
            classifications: fixture.classifications,
            generations: fixture.generations,
            stderr: fixture.stderr,
          },
          null,
          2,
        ),
      );
    await fixture.close();
  }
}, 30000);
