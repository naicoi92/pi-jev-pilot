import { afterEach, expect, test } from "bun:test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { WorkerEvidence, reapWorkerCli } from "./fixtures/worker-evidence.ts";

const root = resolve(import.meta.dir, "..");
let process: ChildProcessWithoutNullStreams | undefined;
let closed: Promise<void> | undefined;
let server: ReturnType<typeof Bun.serve> | undefined;
let evidence: WorkerEvidence | undefined;
interface StatusObservation {
  request: { requestId: string; params: { id: string } };
  reply: {
    requestId: string;
    success: boolean;
    data?: {
      details: {
        runId: string;
        lifecycleStatus?: {
          processTerminal: { state: string; runId: string; runnerProcessInstanceId: string };
        };
      };
    };
  };
}
// Cover the unchanged 7-second reap escalation and 10-second strict evidence gate, plus I/O.
afterEach(async () => {
  if (process && closed) await reapWorkerCli(process, closed);
  closed = undefined;
  process = undefined;
  server?.stop(true);
  server = undefined;
  await evidence?.finish();
  evidence = undefined;
}, 25000);

const cases = [
  { name: "json-only", baseline: "max", background: false },
  { name: "slot-standard", baseline: "max", background: false },
  { name: "slot-budget", baseline: "max", background: false },
  { name: "slot-async", baseline: "low", background: true },
  { name: "slot-risk", baseline: "max", background: false },
  { name: "slot-risk-omitted-direct", baseline: "max", background: false },
  { name: "slot-risk-omitted-async", baseline: "low", background: true },
  { name: "slot-risk-boundary", baseline: "max", background: false },
  { name: "slot-risk-disabled", baseline: "max", background: false },
  { name: "slot-risk-error", baseline: "low", background: false },
  { name: "junior-workflow-switch-cancel", baseline: "max", background: false },
  { name: "junior-workflow-fork-cancel", baseline: "max", background: false },
  { name: "junior-workflow-switch-accept", baseline: "max", background: false },
  { name: "junior-workflow-fork-accept", baseline: "max", background: false },
  { name: "junior-selected", baseline: "max", background: false },
  { name: "junior-first", baseline: "low", background: true },
  { name: "junior-selected-routing-off", baseline: "max", background: false },
  { name: "junior-first-routing-off", baseline: "low", background: true },
  { name: "junior-workflow-routing-off", baseline: "max", background: false },
  { name: "slot-workflow", baseline: "max", background: false },
  { name: "junior-collision", baseline: "max", background: false },
  { name: "direct-max", baseline: "max", background: false },
  { name: "direct-low", baseline: "low", background: false },
  { name: "async-max", baseline: "max", background: true },
  { name: "async-low", baseline: "low", background: true },
  { name: "same-identity", baseline: "max", background: false },
  { name: "clamp", baseline: "max", background: false },
  { name: "disabled", baseline: "max", background: false },
  { name: "error", baseline: "low", background: false },
  { name: "timeout", baseline: "max", background: false },
  { name: "classifier-cancel", baseline: "max", background: false },
  { name: "direct-cancel", baseline: "max", background: false },
  { name: "async-cancel", baseline: "low", background: true },
  { name: "coexistence", baseline: "max", background: false },
  { name: "async-error-cancel", baseline: "low", background: true },
  { name: "async-timeout-cancel", baseline: "max", background: true },
  { name: "async-rejected-cancel", baseline: "low", background: true },
  { name: "async-noop-cancel", baseline: "max", background: true },
  { name: "omitted-direct", baseline: "max", background: false },
  { name: "omitted-async", baseline: "low", background: true },
  { name: "rejected-tier", baseline: "max", background: false },
  { name: "retained-clamp", baseline: "low", background: true },
  { name: "omitted-upgrade", baseline: "max", background: false },
  { name: "top-fresh", baseline: "max", background: false },
  { name: "scope-user", baseline: "low", background: true },
  { name: "profile", baseline: "low", background: false },
  { name: "profile-executor", baseline: "max", background: false },
  { name: "runtime", baseline: "max", background: true },
  { name: "runtime-unknown", baseline: "max", background: false },
  { name: "coexistence-jev-first", baseline: "max", background: false },
  { name: "lifecycle", baseline: "max", background: true },
  { name: "resume", baseline: "max", background: true },
  { name: "workflow-guidance", baseline: "max", background: false },
  { name: "pending-model", baseline: "max", background: false },
  { name: "pending-thinking", baseline: "max", background: false },
  { name: "pending-session", baseline: "max", background: false },
] as const;
for (const scenario of cases)
  test(`WORKER-${scenario.name.startsWith("junior-workflow-") && !scenario.name.endsWith("routing-off") ? "26" : scenario.name.startsWith("slot-risk-") ? (scenario.name.endsWith("disabled") || scenario.name.endsWith("error") ? "20" : "03") : scenario.name.startsWith("slot-") ? "18" : scenario.name.startsWith("junior-") ? "19" : scenario.name.includes("clamp") ? "06" : scenario.name.includes("coexistence") || scenario.name === "profile" || scenario.name === "runtime-unknown" ? "13" : scenario.name.includes("cancel") ? "12" : scenario.name.startsWith("pending-") || ["lifecycle", "resume"].includes(scenario.name) ? "26" : scenario.name === "workflow-guidance" ? "21" : "20"}-${scenario.name} packed production adapter actual receipt`, async () => {
    const { name, baseline, background } = scenario;
    const junior = name.startsWith("junior-");
    const slot = name.startsWith("slot-");
    const routingOff = name.endsWith("routing-off");
    const juniorWorkflow = name.startsWith("junior-workflow-");
    const transition = juniorWorkflow && !routingOff;
    const riskOmitted = name.startsWith("slot-risk-");
    const parentModel = riskOmitted ? "local/deep" : "local/parent";
    let transitionReady = !transition;
    const directory = await mkdtemp(join(tmpdir(), "pi-jev-worker-production-"));
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
            "git+https://github.com/naicoi92/pi-subagents.git#5f8adccb235f1a45858c84b5110c105108947de2",
        },
      }),
    );
    const env: Record<string, string | undefined> = {
      PATH: Bun.env.PATH,
      HOME: directory,
      PI_CODING_AGENT_DIR: agentDir,
      PI_OFFLINE: "1",
      PI_TELEMETRY: "0",
      PI_SUBAGENTS_TEMP_ROOT: join(directory, "runtime"),
      JEV_EFFORT_ENABLED: "true",
      JEV_SKILLS_ENABLED: "false",
      JEV_STRATEGY_ENABLED:
        name === "workflow-guidance" || name === "slot-workflow" ? "true" : "false",
      JEV_QUALITY_ENABLED: "false",
      JEV_DESIGN_ENABLED: "false",
      JEV_WORKER_ROUTING_ENABLED:
        name === "disabled" ||
        name === "slot-risk-disabled" ||
        name === "profile-executor" ||
        routingOff
          ? "false"
          : "true",
      JEV_SYSTEM_ONE_API_KEY: "fixture-not-a-credential",
      JEV_TIMEOUT_MS: name.includes("timeout") ? "100" : "5000",
      ...(name === "json-only"
        ? {
            JEV_MAIN_ROUTING_ENABLED: "true",
            JEV_TIER_FAST: "invalid",
            JEV_TIER_BALANCED: "invalid",
            JEV_TIER_DEEP: "invalid",
          }
        : {}),
    };
    await writeFile(
      join(agentDir, "settings.json"),
      JSON.stringify({
        jevPilot: {
          tiers: {
            fast: "local/parent",
            balanced: "local/selected",
            deep: riskOmitted ? "local/deep" : "local/configured",
          },
        },
      }),
    );
    if (slot || junior) {
      env.JEV_CREW_CONFIG = join(directory, "crew.json");
      await writeFile(
        env.JEV_CREW_CONFIG,
        JSON.stringify({
          mode: name === "slot-standard" ? "standard" : junior ? "junior-lead" : "budget",
          slots: [
            { name: "deep", model: "local/selected" },
            { name: "alpha", model: "local/configured", when: "Read and report logs." },
          ],
          ...(name.startsWith("junior-selected") || juniorWorkflow ? { junior: "alpha" } : {}),
        }),
      );
    }
    const commands = evidence.commands;
    const run = async (args: string[], cwd = directory) => {
      const child = Bun.spawn(args, { cwd, env, stdout: "pipe", stderr: "pipe" });
      const output =
        (await new Response(child.stdout).text()) + (await new Response(child.stderr).text());
      const exitCode = await child.exited;
      commands.push({ command: args, exitCode, output });
      expect(exitCode, output).toBe(0);
      return output;
    };
    await run([Bun.which("bun")!, "install"]);
    const packed = join(directory, "pi-jev-pilot.tgz");
    await run([Bun.which("bun")!, "pm", "pack", "--filename", packed], root);
    await run(["shasum", "-a", "256", packed]);
    const extract = join(directory, "packed");
    await mkdir(extract);
    await run(["tar", "-xzf", packed, "-C", extract]);
    const installedPackage = join(extract, "package");
    const requests: Record<string, unknown>[] = [];
    const classifications: Record<string, unknown>[] = [];
    const allClassifications: Record<string, unknown>[] = [];
    let classifierAborts = 0;
    let childAborts = 0;
    let parentSent = false;
    let activationProbe = true;
    let childStarted = false;
    const pendingChange = name.startsWith("pending-");
    const classifierCancel = name === "classifier-cancel" || pendingChange;
    const childCancel = name.includes("cancel") && !classifierCancel && !transition;
    const preserve =
      name === "disabled" ||
      name === "slot-risk-disabled" ||
      name.includes("error") ||
      name.includes("timeout") ||
      name === "async-rejected-cancel" ||
      name === "async-noop-cancel" ||
      name === "profile-executor";
    const runtime = name === "runtime" || name === "runtime-unknown";
    const omitted =
      riskOmitted ||
      name.startsWith("omitted") ||
      name === "rejected-tier" ||
      name === "retained-clamp" ||
      name === "runtime-unknown" ||
      routingOff;
    const retained = omitted && !routingOff && !riskOmitted && name !== "omitted-upgrade";
    const clamped = name === "clamp" || name === "retained-clamp";
    const expectedIdentity =
      riskOmitted && !preserve
        ? name === "slot-risk-boundary"
          ? "configured"
          : "deep"
        : preserve ||
            retained ||
            name === "slot-risk" ||
            name.startsWith("junior-selected") ||
            juniorWorkflow
          ? "configured"
          : "selected";
    const expectedThinking = junior
      ? "medium"
      : name === "slot-risk" || (riskOmitted && !preserve && name !== "slot-risk-boundary")
        ? "high"
        : preserve
          ? baseline
          : clamped
            ? "off"
            : "medium";
    const caller = name === "same-identity" ? "local/selected" : "local/configured";
    const direct = {
      agent: junior ? "jev-pilot:junior" : "receipt-worker",
      ...(!omitted ? { model: caller } : {}),
      task: "Return CHILD_RECEIPT_OK after performing the specified local implementation and tests.",
      async: background,
      ...(name === "top-fresh" ? { context: "fresh" } : {}),
      options: {
        ...(name !== "top-fresh"
          ? { context: name.startsWith("profile") ? "profile" : "fresh" }
          : {}),
        ...(name === "scope-user" ? { agentScope: "user" } : {}),
        acceptance: false,
      },
    };
    const original = juniorWorkflow
      ? {
          workflow: "./junior-workflow.js",
          async: false,
          options: { context: "fresh", acceptance: false, mission: false },
        }
      : direct;
    if (juniorWorkflow)
      await writeFile(
        join(directory, "junior-workflow.js"),
        'const result = await runs.run("junior", { agent: "jev-pilot:junior", task: "Return CHILD_RECEIPT_OK without tools." }); return result;',
      );
    let dispatched: Record<string, unknown> = original;
    let launches = 0;
    let releaseNotificationWake: (() => void) | undefined;
    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const body = (await request.json()) as Record<string, unknown>;
        if (new URL(request.url).pathname === "/classify") {
          allClassifications.push(body);
          if ((body.state as Record<string, unknown>)?.agentType !== "receipt-worker")
            return Response.json({
              answers: {
                effort: { choice: "medium", confidence: 0.95 },
                risky: { noul: 0 },
                ...(name === "workflow-guidance" || name === "slot-workflow"
                  ? {
                      tier: { choice: "balanced", confidence: 0.95 },
                      strategy: { choice: "parallel", confidence: 0.95 },
                    }
                  : {}),
              },
            });
          classifications.push(body);
          request.signal.addEventListener("abort", () => classifierAborts++, { once: true });
          if (name.includes("timeout") || classifierCancel) await Bun.sleep(1000);
          if (name.includes("error"))
            return new Response("fixture classifier failure", { status: 503 });
          return Response.json({
            answers: {
              tier: {
                choice:
                  slot && name !== "slot-standard"
                    ? riskOmitted
                      ? "slot::alpha"
                      : "slot::deep"
                    : name === "async-noop-cancel"
                      ? "deep"
                      : retained && name !== "rejected-tier" && name !== "retained-clamp"
                        ? "fast"
                        : "balanced",
                confidence:
                  name === "rejected-tier" ||
                  name === "retained-clamp" ||
                  name === "async-rejected-cancel"
                    ? 0.1
                    : name === "omitted-upgrade"
                      ? 0.45
                      : riskOmitted
                        ? 0.9
                        : 0.95,
              },
              effort: {
                choice: "medium",
                confidence:
                  name === "async-noop-cancel" || name === "async-rejected-cancel" ? 0.1 : 0.95,
              },
              risky: {
                noul:
                  name === "slot-risk-boundary"
                    ? 0.7
                    : name === "slot-risk" || riskOmitted
                      ? 0.95
                      : 0,
              },
            },
          });
        }
        if (!activationProbe) requests.push(body);
        const isParent =
          (riskOmitted
            ? activationProbe || JSON.stringify(body.messages).includes("PRIVATE_PARENT_HISTORY")
            : body.model === "parent") ||
          (pendingChange && JSON.stringify(body.messages).includes("PRIVATE_PARENT_HISTORY"));
        if (
          background &&
          childCancel &&
          isParent &&
          parentSent &&
          requests.filter((request) => request.model === "parent").length >= 3
        )
          await Bun.sleep(10000);
        if (
          name === "lifecycle" &&
          isParent &&
          launches === 2 &&
          JSON.stringify((body.messages as unknown[] | undefined)?.at(-1)).includes(
            "Background task completed:",
          )
        )
          await new Promise<void>((done) => {
            releaseNotificationWake = done;
          });
        const launch = !activationProbe && transitionReady && isParent && !parentSent;
        if (launch) {
          parentSent = true;
          launches++;
        }
        if (!isParent) {
          childStarted = true;
          request.signal.addEventListener("abort", () => childAborts++, { once: true });
          if (childCancel) await Bun.sleep(10000);
        }
        const delta = launch
          ? {
              role: "assistant",
              tool_calls: [
                {
                  index: 0,
                  id: `worker-production-${launches}`,
                  type: "function",
                  function: { name: "subagent", arguments: JSON.stringify(dispatched) },
                },
              ],
            }
          : { role: "assistant", content: "CHILD_RECEIPT_OK" };
        if (activationProbe)
          expect(JSON.stringify(body.tools ?? [])).not.toContain('"name":"subagent"');
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
    env.JEV_SYSTEM_ONE_URL = `${server.url}classify`;
    await writeFile(
      join(agentDir, "models.json"),
      JSON.stringify({
        providers: {
          local: {
            baseUrl: `${server.url}v1`,
            api: "openai-completions",
            apiKey: "fixture-not-a-credential",
            models: ["parent", "configured", "selected", "deep"].map((id) => ({
              id,
              reasoning: !(clamped && id === expectedIdentity),
              input: ["text"],
              contextWindow: 32000,
              maxTokens: 512,
              thinkingLevelMap: {
                off: "none",
                minimal: "minimal",
                low: "low",
                medium: "medium",
                high: "high",
                xhigh: "xhigh",
                max: "max",
              },
            })),
          },
        },
      }),
    );
    if (!runtime)
      await writeFile(
        join(agentDir, "agents/receipt-worker.md"),
        `---\nname: receipt-worker\ndescription: Deterministic receipt test subject\ntools: read\nmodel: local/configured\ndefaultContext: ${name === "top-fresh" ? "fork" : "fresh"}\nthinking: ${baseline}\n---\nReturn CHILD_RECEIPT_OK. Do not use tools.\n`,
      );
    if (name === "scope-user") {
      await mkdir(join(directory, ".pi/agents"), { recursive: true });
      await writeFile(
        join(directory, ".pi/agents/receipt-worker.md"),
        "---\nname: receipt-worker\ndescription: Project fork profile\ndefaultContext: fork\nmodel: local/configured\n---\nDo not use tools.\n",
      );
    }
    if (name.startsWith("profile"))
      await writeFile(
        join(agentDir, "settings.json"),
        JSON.stringify({
          jevPilot: {
            tiers: { fast: "local/parent", balanced: "local/selected", deep: "local/configured" },
          },
          subagents: { defaultSubagentContext: "fork" },
        }),
      );
    if (name === "junior-collision")
      await writeFile(
        join(agentDir, "agents/jev-pilot:junior.md"),
        "---\nname: jev-pilot:junior\ndescription: User owned junior\nmodel: local/configured\n---\nUSER_OWNED_DO_NOT_REPLACE\n",
      );
    const observer = join(directory, "observer.ts");
    await writeFile(
      observer,
      `import { appendFileSync } from "node:fs";
import { registerRequiredChildExtensions } from "pi-subagents/required-child-extensions";
export default function(pi) {
 let registration;
 const lifecycle=(type,ctx,extra={})=>appendFileSync(${JSON.stringify(join(directory, "lifecycle.jsonl"))},JSON.stringify({type,pid:process.pid,sessionId:ctx.sessionManager.getSessionId(),at:Date.now(),...extra})+"\\n");
 if (${transition}) {
  pi.on("session_start",(event,ctx)=>lifecycle(event.type,ctx,{reason:event.reason}));
  pi.on("session_shutdown",(event,ctx)=>lifecycle(event.type,ctx,{reason:event.reason}));
  for(const type of ["session_before_switch","session_before_fork"]) pi.on(type,(event,ctx)=>{lifecycle(type,ctx);return {cancel:${name.endsWith("cancel")}};});
  pi.registerCommand("worker-transition",{handler:async(_args,ctx)=>{
   await ctx.waitForIdle();
   const before=ctx.sessionManager.getSessionId();
   const result=${name.includes("-fork-") ? 'await ctx.fork(ctx.sessionManager.getEntries().find(entry=>entry.type==="message" && entry.message.role==="user").id,{position:"at"})' : "await ctx.switchSession(ctx.sessionManager.getSessionFile())"};
   appendFileSync(${JSON.stringify(join(directory, "transition.jsonl"))},JSON.stringify({before,result})+"\\n");
  }});
 }
 pi.on("session_start", (_event,ctx) => {
  if (${runtime}) { const input={version:1,name:"receipt-worker",definition:{description:"Runtime worker",systemPrompt:"Return CHILD_RECEIPT_OK without tools.",tools:["read"],model:"local/configured",thinking:"max",defaultContext:"fresh"}};pi.events.emit("pi-subagents:runtime-agent-register:v1",input);if(!input.result?.ok)throw new Error("Runtime registration failed"); }
 });
 pi.on("session_start", (_event,ctx) => { if (${name === "coexistence"}) registration = registerRequiredChildExtensions({sessionId:ctx.sessionManager.getSessionId(),extensions:[{id:"existing-owner",path:${JSON.stringify(join(installedPackage, "src/worker-child.ts"))}}]}); });
 pi.on("session_shutdown",()=>registration?.dispose());
 pi.registerCommand("worker-reload", { handler: async (_args,ctx) => { await ctx.waitForIdle(); await ctx.reload(); } });
 pi.registerCommand("worker-status", {handler:async(id,ctx)=>{
  await ctx.waitForIdle();
  const requestAt=Date.now();
  const request={version:1,requestId:"worker-"+id+"-"+requestAt,method:"status",params:{id}};
  await new Promise((resolve,reject)=>{
   const channel="subagents:rpc:v1:reply:"+request.requestId;
   const off=pi.events.on(channel,reply=>{
    clearTimeout(timer);off();
    appendFileSync(${JSON.stringify(join(directory, "status-rpc.jsonl"))},JSON.stringify({requestAt,replyAt:Date.now(),request,reply})+"\\n");
    resolve();
   });
   const timer=setTimeout(()=>{off();reject(new Error("Public status RPC timed out: "+id));},3000);
   pi.events.emit("subagents:rpc:v1:request",request);
  });
 }});
 pi.on("tool_call", (event,ctx) => {
  if (${name === "coexistence-jev-first"} && event.toolName==="subagent") { try { registerRequiredChildExtensions({sessionId:ctx.sessionManager.getSessionId(),extensions:[{id:"late-host",path:${JSON.stringify(join(installedPackage, "src/worker-child.ts"))}}]});throw new Error("Expected singleton collision"); } catch(error) { appendFileSync(${JSON.stringify(join(directory, "host-conflict.log"))},String(error)); } }
  if (${transition} && event.toolName==="subagent") lifecycle("workflow_dispatch",ctx);
  if(event.toolName==="subagent") appendFileSync(${JSON.stringify(join(directory, "envelope.jsonl"))},JSON.stringify(event.input)+"\\n");});
 pi.on("tool_result", event => {if(event.toolName==="subagent") appendFileSync(${JSON.stringify(join(directory, "result.jsonl"))},JSON.stringify(event)+"\\n");});
 pi.events.on("subagents:rpc:v1:request", event => appendFileSync(${JSON.stringify(join(directory, "control.jsonl"))},JSON.stringify(event)+"\\n"));
}`,
    );
    const cli = join(directory, "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js");
    await run([Bun.which("node")!, cli, "install", installedPackage]);
    await run([
      Bun.which("node")!,
      cli,
      "--print",
      "--offline",
      "--no-approve",
      "--no-mcp",
      "--no-skills",
      "--no-context-files",
      "--no-prompt-templates",
      "--no-themes",
      "--model",
      parentModel,
      "Package dependency activation check.",
    ]);
    allClassifications.length = 0;
    activationProbe = false;
    for (const source of [join(directory, "node_modules/pi-subagents"), observer])
      await run([Bun.which("node")!, cli, "install", source]);
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
      parentModel,
      "--thinking",
      "medium",
    ];
    process = spawn(Bun.which("node")!, args, { cwd: directory, env });
    const parentCommand = {
      command: [Bun.which("node")!, ...args],
      exitCode: -1,
      output: "RPC records in trace.json; close timing in parent-close.json",
    };
    commands.push(parentCommand);
    closed = new Promise<void>((done, reject) =>
      process!.once("close", (exitCode, signal) => {
        parentCommand.exitCode = exitCode ?? -1;
        writeFile(
          join(directory, "parent-close.json"),
          JSON.stringify({ observedAt: Date.now(), exitCode, signal }),
        ).then(done, reject);
      }),
    );
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
    const wait = async (predicate: () => boolean, deadline = Date.now() + 40000) => {
      while (!predicate()) {
        if (process!.exitCode !== null || Date.now() > deadline)
          throw new Error(
            `directory=${directory};stderr=${stderr};records=${JSON.stringify(records.slice(-8))}`,
          );
        await Bun.sleep(20);
      }
    };
    const waitForPromptResponse = async (id: string, disposition: "started" | "handled") => {
      await wait(() => records.some((record) => record.type === "response" && record.id === id));
      const response = records.find((record) => record.type === "response" && record.id === id)!;
      expect(response.success, `RPC ${id}: ${response.error ?? JSON.stringify(response)}`).toBe(
        true,
      );
      expect(response.data).toMatchObject({ disposition });
    };
    const notificationIndex = (asyncId: string, offset = 0) =>
      records.findIndex((record, index) => {
        const message = record.message as
          | { customType?: string; details?: { runs?: { runId?: string }[] } }
          | undefined;
        return (
          index >= offset &&
          record.type === "message_end" &&
          message?.customType === "subagent-notify" &&
          message.details?.runs?.some((run) => run.runId === asyncId)
        );
      });
    const waitForNotificationSettled = async (asyncId: string, offset = 0) => {
      expect(asyncId).toBeString();
      expect(asyncId.length).toBeGreaterThan(0);
      await wait(() => notificationIndex(asyncId, offset) >= 0);
      const notified = notificationIndex(asyncId, offset);
      if (name === "lifecycle" && launches === 2) {
        await wait(() => releaseNotificationWake !== undefined);
        expect(
          records.slice(offset, notified).some((record) => record.type === "agent_settled"),
        ).toBe(true);
        expect(
          records.some((record, index) => index > notified && record.type === "agent_settled"),
        ).toBe(false);
        releaseNotificationWake!();
      }
      await wait(() =>
        records.some((record, index) => index > notified && record.type === "agent_settled"),
      );
      expect(
        records.findIndex((record, index) => index > notified && record.type === "agent_settled"),
      ).toBeGreaterThan(notified);
    };
    const readResults = async () =>
      JSON.parse((await Bun.file(join(directory, "result.jsonl")).text()).trim().split("\n")[0]!);
    const awaitWorkflowChildren = async (details: {
      mode: string;
      results: { runId: string }[];
      workflowChildren?: { inventoryComplete: boolean; children: { runId: string }[] };
    }) => {
      if (details.mode !== "workflow") return;
      const children = details.results.map((result) => result.runId);
      expect(children.length).toBeGreaterThan(0);
      for (const id of children) {
        expect(id).toBeString();
        expect(id).not.toBe("");
      }
      expect(new Set(children).size).toBe(children.length);
      expect(details.workflowChildren?.inventoryComplete).toBe(true);
      expect(details.workflowChildren!.children.map((child) => child.runId).sort()).toEqual(
        [...children].sort(),
      );
      // Logical results do not prove native close. Keep the parent observer and HTTP server alive.
      const deadline = Date.now() + 10000;
      const pending = new Set(children);
      const file = join(directory, "status-rpc.jsonl");
      await writeFile(file, "");
      let observations: StatusObservation[] = [];
      let sequence = 0;
      while (pending.size && Date.now() < deadline) {
        for (const id of pending) {
          const before = observations.length;
          const promptId = `status-${sequence++}`;
          process!.stdin.write(
            JSON.stringify({ id: promptId, type: "prompt", message: `/worker-status ${id}` }) +
              "\n",
          );
          await wait(
            () => records.some((record) => record.type === "response" && record.id === promptId),
            deadline,
          );
          expect(records.find((record) => record.id === promptId)!.success).toBe(true);
          await wait(() => {
            observations = readFileSync(file, "utf8")
              .trim()
              .split("\n")
              .filter(Boolean)
              .map((line) => JSON.parse(line));
            return observations.length > before;
          }, deadline);
          const { request, reply } = observations.at(-1)!;
          expect(request.params.id).toBe(id);
          expect(reply.requestId).toBe(request.requestId);
          expect(reply.success).toBe(true);
          expect(reply.data!.details.runId).toBe(id);
          const terminal = reply.data!.details.lifecycleStatus!.processTerminal;
          expect(terminal.runId).toBe(id);
          expect(terminal.runnerProcessInstanceId).toBeString();
          expect(terminal.runnerProcessInstanceId).not.toBe("");
          if (terminal.state === "observed") pending.delete(id);
        }
        if (pending.size) await Bun.sleep(50);
      }
      expect(
        [...pending],
        "All exact workflow children must be observed before parent close",
      ).toEqual([]);
      expect(process!.exitCode).toBeNull();
      await writeFile(
        join(directory, "workflow-barrier.json"),
        JSON.stringify({ children, observedAt: Date.now(), parentExitCode: process!.exitCode }),
      );
    };
    let receipt: unknown;
    try {
      process.stdin.write(JSON.stringify({ id: "ready", type: "get_state" }) + "\n");
      await wait(() => records.some((record) => record.id === "ready"));
      if (transition) {
        process.stdin.write(
          JSON.stringify({
            id: "seed",
            type: "prompt",
            message: "PRIVATE_PARENT_HISTORY: Seed the transition without delegation.",
          }) + "\n",
        );
        await waitForPromptResponse("seed", "started");
        await wait(() => records.some((record) => record.type === "agent_settled"));
        process.stdin.write(
          JSON.stringify({ id: "transition", type: "prompt", message: "/worker-transition" }) +
            "\n",
        );
        await waitForPromptResponse("transition", "handled");
        await wait(() => Bun.file(join(directory, "transition.jsonl")).size > 0);
        const completed = JSON.parse(
          (await Bun.file(join(directory, "transition.jsonl")).text()).trim(),
        );
        expect(completed.result.cancelled).toBe(name.endsWith("cancel"));
        const lifecycle = (await Bun.file(join(directory, "lifecycle.jsonl")).text())
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        const starts = lifecycle.filter((event) => event.type === "session_start");
        const shutdowns = lifecycle.filter((event) => event.type === "session_shutdown");
        expect(starts).toHaveLength(name.endsWith("cancel") ? 1 : 2);
        expect(shutdowns).toHaveLength(name.endsWith("cancel") ? 0 : 1);
        expect(starts[0].sessionId).toBe(completed.before);
        if (name.endsWith("accept")) {
          expect(shutdowns[0].sessionId).toBe(completed.before);
          expect(lifecycle.indexOf(shutdowns[0])).toBeLessThan(lifecycle.indexOf(starts[1]));
        }
        records.length = 0;
        transitionReady = true;
      }
      process.stdin.write(
        JSON.stringify({
          id: "start",
          type: "prompt",
          message: "PRIVATE_PARENT_HISTORY: Run the deterministic child test subject.",
        }) + "\n",
      );
      await waitForPromptResponse("start", "started");
      if (classifierCancel || childCancel) {
        await wait(() => (classifierCancel ? classifications.length === 1 : childStarted));
        if (pendingChange) {
          const change =
            name === "pending-model"
              ? { type: "set_model", provider: "local", modelId: "configured" }
              : name === "pending-thinking"
                ? { type: "set_thinking_level", level: "low" }
                : { type: "new_session" };
          process.stdin.write(JSON.stringify({ id: "change", ...change }) + "\n");
          await wait(() => records.some((record) => record.id === "change"));
        }
        if (background && childCancel) {
          await wait(() => records.some((record) => record.type === "agent_settled"));
          process.stdin.write(
            JSON.stringify({
              id: "cancel-turn",
              type: "prompt",
              message: "Wait for my cancellation.",
            }) + "\n",
          );
          await waitForPromptResponse("cancel-turn", "started");
          await wait(() => requests.filter((request) => request.model === "parent").length >= 3);
        }
        if (!pendingChange) {
          process.stdin.write(JSON.stringify({ id: "abort", type: "abort" }) + "\n");
          await wait(() => records.some((record) => record.id === "abort"));
        }
      }
      await wait(() => records.some((record) => record.type === "agent_settled"));
      if (name === "slot-workflow") {
        const visible = JSON.stringify(requests[0]!.messages);
        expect(visible).toContain("deep: local/selected");
        expect(visible).not.toContain("choose its configured fast model");
        expect(visible).toContain("Never for writing or changing code");
        expect(visible).toContain("not transparently intercepted");
        expect(visible).toContain("User and project delegation restrictions take precedence");
      }
      if (name === "junior-collision") {
        expect(childStarted).toBe(false);
        expect(classifications).toHaveLength(0);
        expect(JSON.stringify(records)).toMatch(/collides with configured agent|collision/);
        return;
      }
      if (name === "workflow-guidance") {
        const visible = JSON.stringify(requests[0]!.messages);
        expect(visible).toContain(
          "choose its configured fast model for searching, reading and reporting",
        );
        expect(visible).toContain("balanced for ordinary well-specified work");
        expect(visible).toContain("workflow default for judgment-heavy work");
        expect(visible).toContain("not transparently intercepted");
        expect(JSON.stringify(records)).not.toContain("use fast for mechanical work");
      }
      if (name === "profile" || name === "runtime-unknown") {
        expect(childStarted).toBe(false);
        expect(classifications).toHaveLength(name === "profile" ? 0 : 1);
        expect(JSON.stringify(records)).toContain(
          name === "profile"
            ? "Jev adapter cannot resolve context: profile through the public preflight API"
            : "Jev cannot resolve the retained worker target for an effort-only decision through public preflight",
        );
        return;
      }
      if (name === "coexistence") {
        expect(childStarted).toBe(false);
        expect(classifications).toHaveLength(0);
        expect(JSON.stringify(records)).toContain(
          "Jev child helper cannot register alongside an existing required-child-extension owner",
        );
        return;
      }
      if (classifierCancel) {
        await wait(() => classifierAborts > 0);
        expect(childStarted).toBe(false);
        expect(classifierAborts).toBe(1);
        const terminal = records.find((record) => record.type === "tool_execution_end");
        expect(terminal?.isError).toBe(true);
        expect(JSON.stringify(terminal?.result)).toMatch(
          /Operation aborted|Jev worker classification cancelled; no child launched\./,
        );
      } else {
        await wait(() => records.some((record) => record.type === "tool_execution_end"));
        const result = await readResults();
        await awaitWorkflowChildren(result.details);
        if (background) {
          await wait(() => childStarted);
          const statusFile = join(result.details.asyncDir, "status.json");
          await wait(
            () =>
              notificationIndex(result.details.asyncId) >= 0 || (childCancel && childAborts > 0),
          );
          const deadline = Date.now() + 30000;
          let status = await Bun.file(statusFile).json();
          while (status.processTerminal?.state !== "observed" && Date.now() < deadline) {
            await Bun.sleep(100);
            status = await Bun.file(statusFile).json();
          }
          receipt = status;
          expect(status.processTerminal).toMatchObject({ state: "observed" });
          expect(status.state).toBe(childCancel ? "stopped" : "complete");
          if (!childCancel)
            expect(status.steps).toMatchObject([
              {
                model: `local/${expectedIdentity}`,
                ...(!junior ? { thinking: expectedThinking } : {}),
                exitCode: 0,
                tokens: { input: 10, output: 4 },
                recentOutput: ["CHILD_RECEIPT_OK"],
              },
            ]);
          else
            expect(
              (await Bun.file(join(directory, "control.jsonl")).text()).match(/"method":"stop"/g)
                ?.length,
            ).toBe(1);
          if (childCancel) {
            const controls = (await Bun.file(join(directory, "control.jsonl")).text())
              .trim()
              .split("\n")
              .map((line) => JSON.parse(line));
            expect(
              controls.filter((entry) => entry.method === "stop").map((entry) => entry.params.id),
            ).toEqual([result.details.asyncId]);
          }
        } else {
          receipt = result;
          if (childCancel) {
            await wait(() => childAborts > 0);
            expect(result.isError).toBe(true);
            expect(JSON.stringify(result.content)).toContain("Request aborted");
          } else if (juniorWorkflow) {
            expect(result.isError).not.toBe(true);
            expect(JSON.stringify(result)).toContain("CHILD_RECEIPT_OK");
            if (transition) {
              expect(result.details.results).toMatchObject([
                { model: "local/configured", exitCode: 0 },
              ]);
              const lifecycle = (await Bun.file(join(directory, "lifecycle.jsonl")).text())
                .trim()
                .split("\n")
                .map((line) => JSON.parse(line))
                .filter((event) => event.pid === process!.pid);
              const starts = lifecycle.filter((event) => event.type === "session_start");
              const dispatches = lifecycle.filter((event) => event.type === "workflow_dispatch");
              expect(dispatches).toHaveLength(1);
              expect(dispatches[0].sessionId).toBe(starts.at(-1).sessionId);
              const childId = result.details.results[0].runId;
              const status = await Bun.file(
                join(env.PI_SUBAGENTS_TEMP_ROOT!, "async-subagent-runs", childId, "status.json"),
              ).json();
              expect(status.runId).toBe(childId);
              expect(status.processTerminal).toMatchObject({ state: "observed", runId: childId });
              expect(status.steps).toHaveLength(1);
              expect(status.steps[0].launchResolvedExtensions.required).toContain(
                "jev-pilot-junior-turn-bound",
              );
            }
          } else
            expect(result.details.results).toMatchObject([
              {
                model: `local/${expectedIdentity}${junior ? "" : `:${expectedThinking}`}`,
                ...(!junior ? { thinking: expectedThinking } : {}),
                exitCode: 0,
                finalOutput: "CHILD_RECEIPT_OK",
                usage: { input: 10, output: 4 },
              },
            ]);
        }
        const envelope = JSON.parse(
          (await Bun.file(join(directory, "envelope.jsonl")).text()).trim(),
        );
        if (preserve || routingOff || juniorWorkflow) expect(envelope).toEqual(original);
        if (!childCancel) {
          const childRequest = requests.find((request) =>
            riskOmitted
              ? !JSON.stringify(request.messages).includes("PRIVATE_PARENT_HISTORY")
              : request.model !== "parent",
          );
          if (["top-fresh", "scope-user", "profile-executor"].includes(name))
            expect(JSON.stringify(childRequest?.messages)).not.toContain("PRIVATE_PARENT_HISTORY");
          expect(childRequest).toMatchObject({
            model: expectedIdentity,
            ...(!clamped ? { reasoning_effort: expectedThinking } : {}),
          });
          if (!preserve && !routingOff && !juniorWorkflow)
            expect(envelope.model).toBe(
              `local/${expectedIdentity}${junior ? "" : `:${expectedThinking}`}`,
            );
        }
      }
      expect(classifications).toHaveLength(
        name === "disabled" ||
          name === "slot-risk-disabled" ||
          name === "profile-executor" ||
          junior
          ? 0
          : 1,
      );
      if (!preserve && !classifierCancel && !childCancel) {
        expect(allClassifications).toHaveLength(transition ? 3 : junior && !juniorWorkflow ? 1 : 2); // Workflow inner children retain executor-owned main guidance; direct children use the helper.
      }
      if (classifications.length) {
        expect(classifications[0]!.state).toEqual({
          prompt: direct.task,
          agentType: "receipt-worker",
        });
        expect(JSON.stringify(classifications)).not.toContain("PRIVATE_PARENT_HISTORY");
        if (slot) {
          const criteria = (
            classifications[0]!.questions as Record<string, { criteria: Record<string, string> }>
          ).tier!.criteria;
          expect(Object.keys(criteria)).toEqual(
            name === "slot-standard"
              ? ["fast", "balanced", "deep"]
              : ["fast", "balanced", "deep", "slot::deep", "slot::alpha"],
          );
          if (name !== "slot-standard")
            expect(criteria["slot::deep"]).toContain("Never for writing or changing code.");
        }
        expect(Object.keys(classifications[0]!.questions as object).sort()).toEqual([
          "effort",
          "risky",
          "tier",
        ]);
      }
      if (name === "coexistence-jev-first")
        expect(await Bun.file(join(directory, "host-conflict.log")).text()).toContain(
          "already registered for session",
        );
      if (name === "lifecycle" || name === "resume") {
        const first = await readResults();
        await waitForNotificationSettled(first.details.asyncId);
        const follow = async (id: string, input: Record<string, unknown>) => {
          dispatched = input;
          parentSent = false;
          const offset = records.length;
          const toolCallId = `worker-production-${launches + 1}`;
          process!.stdin.write(
            JSON.stringify({
              id,
              type: "prompt",
              message: "Run the next authorized receipt pass.",
            }) + "\n",
          );
          await waitForPromptResponse(id, "started");
          await wait(() =>
            records.some(
              (record) => record.type === "tool_execution_end" && record.toolCallId === toolCallId,
            ),
          );
          const terminal = records.find(
            (record) => record.type === "tool_execution_end" && record.toolCallId === toolCallId,
          )!;
          expect(terminal.isError, JSON.stringify(terminal.result)).not.toBe(true);
          const result = terminal.result as {
            details: {
              asyncId: string;
              asyncDir: string;
              launchResolvedExtensions: { required: string[] };
            };
          };
          await waitForNotificationSettled(result.details.asyncId, offset);
          expect(result.details.launchResolvedExtensions.required).toContain("jev-pilot-child");
          const statusFile = join(result.details.asyncDir, "status.json");
          let status = await Bun.file(statusFile).json();
          const deadline = Date.now() + 10000;
          while (status.processTerminal?.state !== "observed" && Date.now() < deadline) {
            await Bun.sleep(50);
            status = await Bun.file(statusFile).json();
          }
          expect(status).toMatchObject({
            state: "complete",
            processTerminal: { state: "observed" },
            steps: [{ model: "local/selected", thinking: "medium", exitCode: 0 }],
          });
          return result;
        };
        if (name === "resume") {
          await follow("resume-pass", {
            action: "resume",
            id: first.details.asyncId,
            message: "Return CHILD_RECEIPT_OK again.",
          });
          expect(classifications).toHaveLength(1);
          expect(allClassifications).toHaveLength(3);
        } else {
          await follow("repeat-pass", original);
          expect(classifications).toHaveLength(2);
          process!.stdin.write(
            JSON.stringify({ id: "reload", type: "prompt", message: "/worker-reload" }) + "\n",
          );
          await waitForPromptResponse("reload", "handled");
          await follow("reload-pass", original);
          expect(classifications).toHaveLength(3);
          expect(allClassifications).toHaveLength(6);
        }
      }
      if (name.includes("timeout")) {
        await wait(() => classifierAborts > 0);
        expect(classifierAborts).toBe(1);
      }
    } finally {
      releaseNotificationWake?.();
      await writeFile(
        join(directory, "trace.json"),
        JSON.stringify(
          {
            name,
            versions: {
              pi: "1.4.0",
              subagents: "naicoi92/pi-subagents@5f8adccb235f1a45858c84b5110c105108947de2",
              bun: Bun.version,
            },
            original,
            commands,
            requests,
            classifications,
            allClassifications,
            classifierAborts,
            childAborts,
            records,
            receipt,
            stderr,
          },
          null,
          2,
        ),
      );
      console.log(`WORKER-production-${name} artifacts: ${directory}`);
    }
  }, 120000);
