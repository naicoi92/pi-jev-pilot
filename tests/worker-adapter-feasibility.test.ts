import { afterEach, expect, test } from "bun:test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { WorkerEvidence, reapWorkerCli } from "./fixtures/worker-evidence.ts";

// Feasibility fixtures only: this is not the production worker adapter.
const root = resolve(import.meta.dir, "..");
let process: ChildProcessWithoutNullStreams | undefined;
let closed: Promise<void> | undefined;
let server: ReturnType<typeof Bun.serve> | undefined;
let evidence: WorkerEvidence | undefined;
afterEach(async () => {
  if (process && closed) await reapWorkerCli(process, closed);
  closed = undefined;
  process = undefined;
  server?.stop(true);
  server = undefined;
  await evidence?.finish();
  evidence = undefined;
});

for (const mode of [
  "direct",
  "async",
  "machine-gap",
  "runtime-gap",
  "effort-max",
  "effort-low",
] as const)
  test(
    mode === "machine-gap"
      ? "WORKER-13-machine public preflight omits configured machine that real execution rejects"
      : mode === "runtime-gap"
        ? "WORKER-13-runtime installed owner can execute a registered agent missing from public preflight"
        : mode.startsWith("effort-")
          ? `WORKER-06-runtime-${mode.slice(7)}-baseline actual child thinking is distinct from parent thinking`
          : `WORKER-21-${mode} public tool mutation reaches an installed real native worker`,
    async () => {
      const background = mode === "async";
      const effortProbe = mode === "effort-max" || mode === "effort-low";
      const runtimeProbe = mode === "runtime-gap" || effortProbe;
      const baseline = mode === "effort-max" ? "max" : "low";
      const directory = await mkdtemp(join(tmpdir(), "pi-jev-worker-feasibility-"));
      evidence = new WorkerEvidence(directory);
      await evidence.checkCapacity();
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
            "pi-subagents":
              "git+https://github.com/naicoi92/pi-subagents.git#161501e1a609096bfeb6b49049e671280c31979b",
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
      const installCode = await install.exited;
      evidence.commands.push({
        command: ["bun", "install"],
        exitCode: installCode,
        output: installLog,
      });
      expect(installCode, installLog).toBe(0);
      const requests: Record<string, unknown>[] = [];
      const original = {
        agent: runtimeProbe ? "runtime-receipt" : "receipt-worker",
        ...(effortProbe ? { model: "local/selected" } : {}),
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
                ...(effortProbe
                  ? {
                      thinkingLevelMap: {
                        off: "none",
                        minimal: "minimal",
                        low: "low",
                        medium: "medium",
                        high: "high",
                        xhigh: "xhigh",
                        max: "max",
                      },
                    }
                  : {}),
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
      await writeFile(
        required,
        `import { appendFileSync } from "node:fs";
export default function (pi) {
 pi.on("before_provider_request", (_event, ctx) => {
  appendFileSync(${JSON.stringify(join(directory, "child-baseline.jsonl"))}, JSON.stringify({model:ctx.model?.provider+"/"+ctx.model?.id,thinking:ctx.thinkingLevel})+"\\n");
 });
}\n`,
      );
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
  if (${runtimeProbe}) {
   const registration = {version:1,name:"runtime-receipt",definition:{description:"Runtime test subject",systemPrompt:"Return CHILD_RECEIPT_OK without tools.",tools:["read"],...(${effortProbe} ? {thinking:${JSON.stringify(baseline)}} : {})}};
   pi.events.emit("pi-subagents:runtime-agent-register:v1", registration);
   if (!registration.result?.ok) throw new Error("Runtime registration failed");
   runtimeAgent = registration.result.registration;
  }
  if (${mode === "machine-gap" || effortProbe}) required = registerRequiredChildExtensions({sessionId: ctx.sessionManager.getSessionId(), extensions: [{id:"fixture-child-baseline",path:${JSON.stringify(required)}}], ...(${mode === "machine-gap"} ? {requireForAllRunners:true} : {})});
 });
 pi.on("session_shutdown", () => { required?.dispose(); runtimeAgent?.dispose(); });
 pi.on("tool_call", async (event, ctx) => {
  if(event.toolName !== "subagent" || event.input.action) return;
  const preflight = await resolveSubagentLaunchContract({ agent: event.input.agent, task: event.input.task, cwd: ctx.cwd, parentModel: ctx.model, availableModels: ctx.modelRegistry.getAvailable(), parentSessionId: ctx.sessionManager.getSessionId(), projectTrusted: ctx.isProjectTrusted(), context: "fresh", runtimeSnapshotHost: pi, intercomBridge: {mode:"off"} });
  appendFileSync(${JSON.stringify(join(directory, "preflight.jsonl"))}, JSON.stringify(preflight)+"\\n");
  if(!preflight.ok && ${!runtimeProbe}) return {block:true, reason:preflight.message};
  if (!${effortProbe}) event.input.model = "local/selected:high";
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
        JEV_WORKER_ROUTING_ENABLED: "false",
        JEV_EFFORT_ENABLED: "false",
        JEV_SKILLS_ENABLED: "false",
        JEV_STRATEGY_ENABLED: "false",
        JEV_QUALITY_ENABLED: "false",
        JEV_DESIGN_ENABLED: "false",
      };
      const commands: string[][] = [];
      const installReceipts: { command: string[]; output: string; exitCode: number }[] = [];
      const packed = join(directory, "pi-jev-pilot.tgz");
      const extract = join(directory, "packed");
      await mkdir(extract);
      for (const command of [
        [Bun.which("bun")!, "pm", "pack", "--filename", packed],
        ["tar", "-xzf", packed, "-C", extract],
      ]) {
        const packing = Bun.spawn(command, { cwd: root, env, stdout: "pipe", stderr: "pipe" });
        const output =
          (await new Response(packing.stdout).text()) + (await new Response(packing.stderr).text());
        const exitCode = await packing.exited;
        evidence.commands.push({ command, exitCode, output });
        expect(exitCode, output).toBe(0);
      }
      for (const source of [
        join(extract, "package"),
        join(directory, "node_modules/pi-subagents"),
        adapter,
      ]) {
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
      closed = new Promise<void>((done) => process!.once("close", () => done()));
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
        if (runtimeProbe) expect(preflight[0]).toMatchObject({ ok: false, code: "missing_agent" });
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
        if (effortProbe) {
          const observed = (await Bun.file(join(directory, "child-baseline.jsonl")).text())
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line));
          expect(observed).toMatchObject([{ model: "local/selected", thinking: baseline }]);
          expect(requests.find((request) => request.model === "selected")).toMatchObject({
            model: "selected",
            reasoning_effort: baseline,
          });
          expect(JSON.parse(result.trim()).details.results).toMatchObject([
            {
              model: `local/selected:${baseline}`,
              thinking: baseline,
              exitCode: 0,
              finalOutput: "CHILD_RECEIPT_OK",
              usage: { input: 10, output: 4 },
            },
          ]);
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
                executionPackage: "naicoi92/pi-subagents@161501e1a609096bfeb6b49049e671280c31979b",
                preflight: "naicoi92/pi-subagents@161501e1a609096bfeb6b49049e671280c31979b",
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
