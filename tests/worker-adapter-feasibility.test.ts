import { afterEach, expect, test } from "bun:test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Feasibility fixtures only: this is not the production worker adapter.
const root = resolve(import.meta.dir, "..");
let process: ChildProcessWithoutNullStreams | undefined;
let server: ReturnType<typeof Bun.serve> | undefined;
afterEach(async () => {
  if (process && process.exitCode === null) {
    process.stdin.end();
    await new Promise<void>((done) => {
      const timer = setTimeout(() => process?.kill("SIGTERM"), 5000);
      process!.once("close", () => {
        clearTimeout(timer);
        done();
      });
    });
  }
  process = undefined;
  server?.stop(true);
  server = undefined;
});

for (const mode of ["direct", "async", "machine-gap", "runtime-gap"] as const)
  test(
    mode === "machine-gap"
      ? "WORKER-13-machine public preflight omits configured machine that real execution rejects"
      : mode === "runtime-gap"
        ? "WORKER-13-runtime installed owner can execute a registered agent missing from public preflight"
        : `WORKER-21-${mode} public tool mutation reaches an installed real native worker`,
    async () => {
      const background = mode === "async";
      const directory = await mkdtemp(join(tmpdir(), "pi-jev-worker-feasibility-"));
      const agentDir = join(directory, "agent");
      await mkdir(join(agentDir, "agents"), { recursive: true });
      await writeFile(
        join(directory, "package.json"),
        JSON.stringify({
          private: true,
          type: "module",
          dependencies: {
            "@earendil-works/pi-coding-agent": "1.4.0",
            "@earendil-works/pi-ai": "1.4.0",
            "pi-subagents": "0.80.0",
          },
        }),
      );
      const install = Bun.spawn([Bun.which("bun")!, "install"], {
        cwd: directory,
        env: { PATH: Bun.env.PATH, HOME: directory },
        stdout: "pipe",
        stderr: "pipe",
      });
      const installLog =
        (await new Response(install.stdout).text()) + (await new Response(install.stderr).text());
      expect(await install.exited, installLog).toBe(0);
      const requests: Record<string, unknown>[] = [];
      const original = {
        agent: mode === "runtime-gap" ? "runtime-receipt" : "receipt-worker",
        task: "Return CHILD_RECEIPT_OK.",
        async: background,
        options: { context: "fresh", acceptance: false },
      };
      server = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        async fetch(request) {
          const body = (await request.json()) as Record<string, unknown>;
          requests.push(body);
          const delta =
            requests.length === 1
              ? {
                  role: "assistant",
                  tool_calls: [
                    {
                      index: 0,
                      id: "worker-probe",
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
            choices: [
              { index: 0, delta: {}, finish_reason: requests.length === 1 ? "tool_calls" : "stop" },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
          };
          return new Response(
            `data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(end)}\n\ndata: [DONE]\n\n`,
            { headers: { "content-type": "text/event-stream" } },
          );
        },
      });
      await writeFile(
        join(agentDir, "models.json"),
        JSON.stringify({
          providers: {
            local: {
              baseUrl: `${server.url}v1`,
              api: "openai-completions",
              apiKey: "fixture-not-a-credential",
              models: ["parent", "configured", "selected"].map((id) => ({
                id,
                reasoning: true,
                input: ["text"],
                contextWindow: 32000,
                maxTokens: 512,
              })),
            },
          },
        }),
      );
      await writeFile(
        join(agentDir, "agents/receipt-worker.md"),
        "---\nname: receipt-worker\ndescription: Deterministic receipt test subject\ntools: read\nextensions:\nmodel: local/configured\nthinking: low\n---\nReturn CHILD_RECEIPT_OK. Do not use tools.\n",
      );
      if (mode === "machine-gap")
        await writeFile(
          join(agentDir, "settings.json"),
          JSON.stringify({
            subagents: {
              agentOverrides: { "receipt-worker": { machine: "checkpoint-machine-never-connect" } },
            },
          }),
        );
      const required = join(directory, "required.ts");
      await writeFile(required, "export default function () {}\n");
      const adapter = join(directory, "adapter.ts");
      await writeFile(
        adapter,
        `import { resolveSubagentLaunchContract } from "pi-subagents/preflight";
import { registerRequiredChildExtensions } from "pi-subagents/required-child-extensions";
import { appendFileSync } from "node:fs";
export default function(pi) {
 let required;
 let runtimeAgent;
 pi.on("session_start", (_event, ctx) => {
  if (${mode === "runtime-gap"}) {
   const registration = {version:1,name:"runtime-receipt",definition:{description:"Runtime test subject",systemPrompt:"Return CHILD_RECEIPT_OK without tools.",tools:["read"]}};
   pi.events.emit("pi-subagents:runtime-agent-register:v1", registration);
   if (!registration.result?.ok) throw new Error("Runtime registration failed");
   runtimeAgent = registration.result.registration;
  }
  if (${mode === "machine-gap"}) required = registerRequiredChildExtensions({sessionId: ctx.sessionManager.getSessionId(), extensions: [{id:"local-only-safety-guard",path:${JSON.stringify(required)}}], requireForAllRunners:true});
 });
 pi.on("session_shutdown", () => { required?.dispose(); runtimeAgent?.dispose(); });
 pi.on("tool_call", async (event, ctx) => {
  if(event.toolName !== "subagent" || event.input.action) return;
  const preflight = await resolveSubagentLaunchContract({ agent: event.input.agent, task: event.input.task, cwd: ctx.cwd, parentModel: ctx.model, availableModels: ctx.modelRegistry.getAvailable(), parentSessionId: ctx.sessionManager.getSessionId(), projectTrusted: ctx.isProjectTrusted(), context: "fresh", runtimeSnapshotHost: pi, intercomBridge: {mode:"off"} });
  appendFileSync(${JSON.stringify(join(directory, "preflight.jsonl"))}, JSON.stringify(preflight)+"\\n");
  if(!preflight.ok && ${mode !== "runtime-gap"}) return {block:true, reason:preflight.message};
  event.input.model = "local/selected:high";
 });
 pi.on("tool_result", event => { if(event.toolName === "subagent") appendFileSync(${JSON.stringify(join(directory, "result.jsonl"))}, JSON.stringify(event)+"\\n"); });
}`,
      );
      const cli = join(
        directory,
        "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js",
      );
      const env = {
        PATH: Bun.env.PATH,
        HOME: directory,
        PI_CODING_AGENT_DIR: agentDir,
        PI_OFFLINE: "1",
        PI_TELEMETRY: "0",
        PI_SUBAGENTS_TEMP_ROOT: join(directory, "runtime"),
        JEV_EFFORT_ENABLED: "false",
        JEV_SKILLS_ENABLED: "false",
        JEV_STRATEGY_ENABLED: "false",
        JEV_QUALITY_ENABLED: "false",
        JEV_DESIGN_ENABLED: "false",
      };
      const commands: string[][] = [];
      const installReceipts: { command: string[]; output: string; exitCode: number }[] = [];
      for (const source of [root, join(directory, "node_modules/pi-subagents"), adapter]) {
        const args = [Bun.which("node")!, cli, "install", source];
        commands.push(args);
        const child = Bun.spawn(args, { cwd: directory, env, stdout: "pipe", stderr: "pipe" });
        const output =
          (await new Response(child.stdout).text()) + (await new Response(child.stderr).text());
        const exitCode = await child.exited;
        installReceipts.push({ command: args, output, exitCode });
        expect(exitCode, output).toBe(0);
      }
      const args = [
        cli,
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
      commands.push([Bun.which("node")!, ...args]);
      process = spawn(Bun.which("node")!, args, { cwd: directory, env });
      const records: Record<string, unknown>[] = [];
      let stderr = "";
      let pending = "";
      process.stderr.on("data", (data) => {
        stderr += data.toString();
      });
      process.stdout.on("data", (data) => {
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
        const deadline = Date.now() + 30000;
        while (!predicate()) {
          if (process!.exitCode !== null || Date.now() > deadline)
            throw new Error(
              `directory=${directory}; stderr=${stderr}; records=${JSON.stringify(records.slice(-5))}`,
            );
          await Bun.sleep(20);
        }
      };
      try {
        process.stdin.write(JSON.stringify({ id: "ready", type: "get_state" }) + "\n");
        await wait(() => records.some((record) => record.id === "ready"));
        process.stdin.write(
          JSON.stringify({
            id: "start",
            type: "prompt",
            message: "Run the deterministic native child test subject.",
          }) + "\n",
        );
        await wait(() => records.some((record) => record.type === "agent_settled"));
        const preflight = (await Bun.file(join(directory, "preflight.jsonl")).text())
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        if (mode === "runtime-gap")
          expect(preflight[0]).toMatchObject({ ok: false, code: "missing_agent" });
        else
          expect(preflight[0]).toMatchObject({
            ok: true,
            contract: { model: "local/configured:low", thinking: "low" },
          });
        const result = await Bun.file(join(directory, "result.jsonl")).text();
        if (mode === "machine-gap") {
          expect(preflight[0].contract).not.toHaveProperty("machine");
          expect(preflight[0].contract.agent).not.toHaveProperty("machine");
          expect(preflight[0].contract.agent).not.toHaveProperty("runner");
          expect(result).toContain("checkpoint-machine-never-connect");
          expect(result).toContain("the host requires child extensions");
          expect(requests.some((request) => request.model === "selected")).toBe(false);
          return;
        }
        if (background) await wait(() => requests.some((request) => request.model === "selected"));
        expect(requests.find((request) => request.model === "selected")).toMatchObject({
          model: "selected",
          reasoning_effort: "high",
        });
        if (!background) {
          expect(JSON.parse(result.trim()).details.results).toMatchObject([
            {
              model: "local/selected:high",
              thinking: "high",
              exitCode: 0,
              finalOutput: "CHILD_RECEIPT_OK",
              usage: { input: 10, output: 4, turns: 1 },
            },
          ]);
        } else {
          await wait(() =>
            records.some(
              (record) =>
                record.type === "message_end" && JSON.stringify(record).includes("subagent-notify"),
            ),
          );
          const launched = JSON.parse(result.trim());
          const status = await Bun.file(join(launched.details.asyncDir, "status.json")).json();
          expect(status).toMatchObject({
            state: "complete",
            processTerminal: { state: "observed" },
            steps: [
              {
                model: "local/selected",
                thinking: "high",
                status: "complete",
                exitCode: 0,
                tokens: { input: 10, output: 4 },
                recentOutput: ["CHILD_RECEIPT_OK"],
              },
            ],
          });
          await writeFile(
            join(directory, "terminal-receipt.json"),
            JSON.stringify(status, null, 2),
          );
        }
      } finally {
        await writeFile(
          join(directory, "trace.json"),
          JSON.stringify(
            {
              mode,
              versions: {
                pi: "1.4.0",
                executionPackage: "0.80.0",
                preflight: "0.80.0",
                node: Bun.spawnSync([Bun.which("node")!, "--version"])
                  .stdout.toString()
                  .trim(),
                bun: Bun.version,
              },
              installLog,
              installReceipts,
              commands,
              requests,
              records,
              stderr,
            },
            null,
            2,
          ),
        );
        console.log(`WORKER-${mode} artifacts: ${directory}`);
      }
    },
    120000,
  );
