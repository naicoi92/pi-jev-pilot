import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { cp, mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { WorkerEvidence } from "./fixtures/worker-evidence.ts";

const root = resolve(import.meta.dir, "..");
// Same deterministic provider, native receipts and evidence gate as worker-routing-cli.
for (const name of ["direct", "async", "clamp", "error", "timeout", "schema", "disabled"] as const)
  test(`CLI-WV-${name} exposes worker decision through official UI protocol`, async () => {
    const directory = await mkdtemp(join(tmpdir(), `pi-jev-worker-visibility-${name}-`));
    const evidence = new WorkerEvidence(directory);
    await cp(join(root, "src"), join(directory, "source/src"), { recursive: true });
    for (const args of [
      ["rev-parse", "HEAD"],
      ["status", "--short"],
      ["diff", "--", "src/worker-adapter.ts"],
    ]) {
      const git = Bun.spawn(["git", ...args], { cwd: root, stdout: "pipe", stderr: "pipe" });
      evidence.commands.push({
        command: ["git", ...args],
        exitCode: await git.exited,
        output: (await new Response(git.stdout).text()) + (await new Response(git.stderr).text()),
      });
    }
    const agent = join(directory, "agent");
    await mkdir(join(agent, "agents"), { recursive: true });
    const records: Record<string, unknown>[] = [];
    const requests: Record<string, unknown>[] = [];
    const classifications: unknown[] = [];
    let sent = false;
    const background = name === "async";
    const preserved = ["error", "timeout", "schema", "disabled"].includes(name);
    const original = {
      agent: "receipt-worker",
      model: "local/configured",
      task: "PRIVATE_WORKER_TASK: Implement specified change with tests.",
      async: background,
      options: { context: "fresh", acceptance: false, mission: false },
    };
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const body = (await request.json()) as Record<string, unknown>;
        if (new URL(request.url).pathname === "/classify") {
          classifications.push(body);
          if (name === "timeout") await Bun.sleep(500);
          if (name === "error") return new Response("PRIVATE_PROVIDER_ERROR", { status: 503 });
          if (name === "schema") return Response.json({});
          return Response.json({
            answers: {
              tier: { choice: "balanced", confidence: 0.95 },
              effort: { choice: "medium", confidence: 0.95 },
              risky: { noul: 0 },
            },
          });
        }
        requests.push(body);
        const launch = body.model === "parent" && !sent;
        if (launch) sent = true;
        const delta = launch
          ? {
              role: "assistant",
              tool_calls: [
                {
                  index: 0,
                  id: "visibility-call-1",
                  type: "function",
                  function: { name: "subagent", arguments: JSON.stringify(original) },
                },
              ],
            }
          : { role: "assistant", content: "CHILD_RECEIPT_OK" };
        const chunk = {
          id: "fixture",
          object: "chat.completion.chunk",
          created: 1,
          model: body.model,
          choices: [{ index: 0, delta, finish_reason: null }],
        };
        const end = {
          ...chunk,
          choices: [{ index: 0, delta: {}, finish_reason: launch ? "tool_calls" : "stop" }],
          usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
        };
        return new Response(
          `data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(end)}\n\ndata: [DONE]\n\n`,
          { headers: { "content-type": "text/event-stream" } },
        );
      },
    });
    await writeFile(
      join(agent, "models.json"),
      JSON.stringify({
        providers: {
          local: {
            baseUrl: `${server.url}v1`,
            api: "openai-completions",
            apiKey: "fixture-not-a-credential",
            models: ["parent", "configured", "selected"].map((id) => ({
              id,
              reasoning: !(name === "clamp" && id === "selected"),
              input: ["text"],
              contextWindow: 32000,
              maxTokens: 512,
              thinkingLevelMap: { off: "none", low: "low", medium: "medium", high: "high" },
            })),
          },
        },
      }),
    );
    await writeFile(
      join(agent, "settings.json"),
      JSON.stringify({
        retry: { enabled: false },
        compaction: { enabled: false },
        jevPilot: {
          tiers: { fast: "local/parent", balanced: "local/selected", deep: "local/configured" },
        },
      }),
    );
    await writeFile(
      join(agent, "agents/receipt-worker.md"),
      "---\nname: receipt-worker\ndescription: Deterministic receipt worker\nmodel: local/configured\nthinking: low\ndefaultContext: fresh\ntools: read\n---\nReturn CHILD_RECEIPT_OK without tools.\n",
    );
    const cli = join(root, "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js");
    const args = [
      cli,
      "-e",
      root,
      "-e",
      join(root, "node_modules/pi-subagents/index.ts"),
      "--session-dir",
      join(directory, "sessions"),
      "--mode",
      "rpc",
      "--offline",
      "--no-approve",
      "--no-mcp",
      "--no-skills",
      "--no-context-files",
      "--no-prompt-templates",
      "--no-themes",
      "--model",
      "local/parent",
      "--thinking",
      "medium",
    ];
    const env = {
      PATH: process.env.PATH,
      HOME: directory,
      PI_CODING_AGENT_DIR: agent,
      PI_OFFLINE: "1",
      PI_TELEMETRY: "0",
      PI_SUBAGENTS_TEMP_ROOT: join(directory, "runtime"),
      JEV_EFFORT_ENABLED: "false",
      JEV_SKILLS_ENABLED: "false",
      JEV_STRATEGY_ENABLED: "false",
      JEV_QUALITY_ENABLED: "false",
      JEV_DESIGN_ENABLED: "false",
      JEV_WORKER_ROUTING_ENABLED: name === "disabled" ? "false" : "true",
      JEV_SYSTEM_ONE_URL: `${server.url}classify`,
      JEV_SYSTEM_ONE_API_KEY: "fixture-not-a-credential",
      JEV_TIMEOUT_MS: name === "timeout" ? "100" : "5000",
    };
    const child = spawn(Bun.which("node")!, args, { cwd: directory, env });
    const command = {
      command: [Bun.which("node")!, ...args],
      exitCode: -1,
      output: "See trace.json",
    };
    evidence.commands.push(command);
    let stderr = "",
      pending = "";
    const closed = new Promise<void>((done) =>
      child.once("close", (code) => {
        command.exitCode = code ?? -1;
        done();
      }),
    );
    child.stderr.on("data", (data) => (stderr += data.toString()));
    child.stdout.on("data", (data) => {
      pending += data.toString();
      let index: number;
      while ((index = pending.indexOf("\n")) !== -1) {
        const line = pending.slice(0, index);
        pending = pending.slice(index + 1);
        try {
          records.push(JSON.parse(line));
        } catch {
          stderr += line;
        }
      }
    });
    const wait = async (predicate: () => boolean) => {
      const until = Date.now() + 30000;
      while (!predicate()) {
        if (child.exitCode !== null || Date.now() > until)
          throw new Error(`deadline ${directory}; ${stderr}; ${JSON.stringify(records.slice(-5))}`);
        await Bun.sleep(20);
      }
    };
    try {
      child.stdin.write(JSON.stringify({ id: "ready", type: "get_state" }) + "\n");
      await wait(() => records.some((r) => r.id === "ready"));
      child.stdin.write(
        JSON.stringify({
          id: "start",
          type: "prompt",
          message: "PRIVATE_PARENT_HISTORY: Run deterministic worker.",
        }) + "\n",
      );
      await wait(() => records.some((r) => r.type === "tool_execution_end"));
      const terminal = records.find((r) => r.type === "tool_execution_end")!;
      expect(terminal.isError).not.toBe(true);
      const result = terminal.result as {
        details: {
          results: { model: string; thinking: string; exitCode: number; usage: unknown }[];
          asyncId: string;
          asyncDir: string;
        };
      };
      const model = preserved ? "configured" : "selected";
      const thinking = preserved ? "low" : name === "clamp" ? "off" : "medium";
      if (background) {
        await wait(() =>
          records.some(
            (r) =>
              r.type === "message_end" &&
              (r.message as { customType?: string })?.customType === "subagent-notify",
          ),
        );
        const file = Bun.file(join(result.details.asyncDir, "status.json"));
        let receipt = await file.json();
        const until = Date.now() + 10000;
        while (receipt.processTerminal?.state !== "observed" && Date.now() < until) {
          await Bun.sleep(50);
          receipt = await file.json();
        }
        expect(receipt).toMatchObject({
          state: "complete",
          processTerminal: { state: "observed" },
          steps: [
            {
              model: "local/selected",
              thinking: "medium",
              exitCode: 0,
              tokens: { input: 10, output: 4 },
            },
          ],
        });
        await writeFile(join(directory, "receipt.json"), JSON.stringify(receipt, null, 2));
      } else {
        expect(result.details.results).toMatchObject([
          {
            model: preserved ? "local/configured:low" : `local/selected:${thinking}`,
            thinking,
            exitCode: 0,
            usage: { input: 10, output: 4 },
          },
        ]);
      }
      expect(requests.find((r) => r.model !== "parent")).toMatchObject({
        model,
        ...(thinking !== "off" ? { reasoning_effort: thinking } : {}),
      });
      expect(classifications).toHaveLength(name === "disabled" ? 0 : 1);
      const widgets = records.filter(
        (r) => r.method === "setWidget" && r.widgetKey === "jev-pilot-workers",
      );
      const ui = JSON.stringify(
        records.filter(
          (r) =>
            ["setWidget", "setStatus"].includes(String(r.method)) &&
            (r.widgetKey ?? r.statusKey) === "jev-pilot-workers",
        ),
      );
      expect(widgets.length).toBeGreaterThan(0);
      if (name !== "disabled") expect(ui).toContain("choosing model + effort");
      if (background) {
        expect(ui).toContain("executor accepted async · launch unconfirmed");
        expect(ui).toContain("executor complete · model/effort unconfirmed");
      } else expect(ui).toContain("executor receipt · target");
      expect(ui).not.toContain("running");
      if (name === "disabled") expect(ui).toContain("unchanged · routing disabled");
      else expect(ui).toContain("executor authority · decision pending · launch unconfirmed");
      // Selection and fallback are proven by committed native receipts/provider requests above,
      // never by obsolete tool-envelope plan text.
      expect(ui).not.toContain("Jev plan · selected");
      expect(ui).not.toContain("PRIVATE_");
      expect(ui).not.toContain("fixture-not-a-credential");
    } finally {
      child.stdin.end();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const reaped = await Promise.race([
        closed.then(() => true),
        new Promise<false>((done) => {
          timer = setTimeout(() => done(false), 10000);
        }),
      ]);
      clearTimeout(timer);
      await writeFile(
        join(directory, "trace.json"),
        JSON.stringify(
          {
            name,
            sourceBase: "57ba3d4d0d32462674fe6c5a38f070707b14ad23",
            original,
            classifications,
            requests,
            records,
            stderr,
            reaped,
          },
          null,
          2,
        ),
      );
      await evidence.save();
      server.stop(true);
      expect(reaped, `CLI must close natively; retained ${directory}`).toBe(true);
      expect(command.exitCode).toBe(0);
      await evidence.finish();
      console.log(`CLI-WV-${name} evidence: ${evidence.destination}`);
    }
  }, 60000);
