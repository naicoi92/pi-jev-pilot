import { afterEach, expect, test } from "bun:test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

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

const cases = [
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
] as const;
for (const scenario of cases)
  test(`WORKER-${scenario.name === "clamp" ? "06" : scenario.name === "coexistence" ? "13" : scenario.name.includes("cancel") ? "12" : "20"}-${scenario.name} packed production adapter actual receipt`, async () => {
    const { name, baseline, background } = scenario;
    const directory = await mkdtemp(join(tmpdir(), "pi-jev-worker-production-"));
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
    const env: Record<string, string | undefined> = {
      PATH: Bun.env.PATH,
      HOME: directory,
      PI_CODING_AGENT_DIR: agentDir,
      PI_OFFLINE: "1",
      PI_TELEMETRY: "0",
      PI_SUBAGENTS_TEMP_ROOT: join(directory, "runtime"),
      JEV_EFFORT_ENABLED: "true",
      JEV_MAIN_ROUTING_ENABLED: "false",
      JEV_SKILLS_ENABLED: "false",
      JEV_STRATEGY_ENABLED: "false",
      JEV_QUALITY_ENABLED: "false",
      JEV_DESIGN_ENABLED: "false",
      JEV_WORKER_ROUTING_ENABLED: name === "disabled" ? "false" : "true",
      JEV_SYSTEM_ONE_API_KEY: "fixture-not-a-credential",
      JEV_TIER_FAST: "local/parent",
      JEV_TIER_BALANCED: "local/selected",
      JEV_TIER_DEEP: "local/configured",
      JEV_TIMEOUT_MS: name === "timeout" ? "100" : "5000",
    };
    const commands: { command: string[]; exitCode: number; output: string }[] = [];
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
    const classifierCancel = name === "classifier-cancel";
    const childCancel = name === "direct-cancel" || name === "async-cancel";
    const preserve = name === "disabled" || name === "error" || name === "timeout";
    const caller = name === "same-identity" ? "local/selected" : "local/configured";
    const original = {
      agent: "receipt-worker",
      model: caller,
      task: "Return CHILD_RECEIPT_OK after performing the specified local implementation and tests.",
      async: background,
      options: { context: "fresh", acceptance: false },
    };
    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const body = (await request.json()) as Record<string, unknown>;
        if (new URL(request.url).pathname === "/classify") {
          allClassifications.push(body);
          if ((body.state as Record<string, unknown>)?.agentType !== "receipt-worker")
            return Response.json({
              answers: { effort: { choice: "medium", confidence: 0.95 }, risky: { noul: 0 } },
            });
          classifications.push(body);
          request.signal.addEventListener("abort", () => classifierAborts++, { once: true });
          if (name === "timeout" || classifierCancel) await Bun.sleep(1000);
          if (name === "error") return new Response("fixture classifier failure", { status: 503 });
          return Response.json({
            answers: {
              tier: { choice: "balanced", confidence: 0.95 },
              effort: { choice: "medium", confidence: 0.45 },
              risky: { noul: 0 },
            },
          });
        }
        if (!activationProbe) requests.push(body);
        const isParent = body.model === "parent";
        if (
          name === "async-cancel" &&
          isParent &&
          parentSent &&
          requests.filter((request) => request.model === "parent").length >= 3
        )
          await Bun.sleep(10000);
        const launch = !activationProbe && isParent && !parentSent;
        if (launch) parentSent = true;
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
                  id: "worker-production",
                  type: "function",
                  function: { name: "subagent", arguments: JSON.stringify(original) },
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
            models: ["parent", "configured", "selected"].map((id) => ({
              id,
              reasoning: !(name === "clamp" && id === "selected"),
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
    await writeFile(
      join(agentDir, "agents/receipt-worker.md"),
      `---\nname: receipt-worker\ndescription: Deterministic receipt test subject\ntools: read\nmodel: local/configured\nthinking: ${baseline}\n---\nReturn CHILD_RECEIPT_OK. Do not use tools.\n`,
    );
    const observer = join(directory, "observer.ts");
    await writeFile(
      observer,
      `import { appendFileSync } from "node:fs";
import { registerRequiredChildExtensions } from "pi-subagents/required-child-extensions";
export default function(pi) {
 let registration;
 pi.on("session_start", (_event,ctx) => { if (${name === "coexistence"}) registration = registerRequiredChildExtensions({sessionId:ctx.sessionManager.getSessionId(),extensions:[{id:"existing-owner",path:${JSON.stringify(join(installedPackage, "src/worker-child.ts"))}}]}); });
 pi.on("session_shutdown",()=>registration?.dispose());
 pi.on("tool_call", event => {if(event.toolName==="subagent") appendFileSync(${JSON.stringify(join(directory, "envelope.jsonl"))},JSON.stringify(event.input)+"\\n");});
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
      "local/parent",
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
      "local/parent",
      "--thinking",
      "medium",
    ];
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
      const deadline = Date.now() + 40000;
      while (!predicate()) {
        if (process!.exitCode !== null || Date.now() > deadline)
          throw new Error(
            `directory=${directory};stderr=${stderr};records=${JSON.stringify(records.slice(-8))}`,
          );
        await Bun.sleep(20);
      }
    };
    const readResults = async () =>
      JSON.parse((await Bun.file(join(directory, "result.jsonl")).text()).trim().split("\n")[0]!);
    let receipt: unknown;
    try {
      process.stdin.write(JSON.stringify({ id: "ready", type: "get_state" }) + "\n");
      await wait(() => records.some((record) => record.id === "ready"));
      process.stdin.write(
        JSON.stringify({
          id: "start",
          type: "prompt",
          message: "PRIVATE_PARENT_HISTORY: Run the deterministic child test subject.",
        }) + "\n",
      );
      if (classifierCancel || childCancel) {
        await wait(() => (classifierCancel ? classifications.length === 1 : childStarted));
        if (name === "async-cancel") {
          await wait(() => records.some((record) => record.type === "agent_settled"));
          process.stdin.write(
            JSON.stringify({
              id: "cancel-turn",
              type: "prompt",
              message: "Wait for my cancellation.",
            }) + "\n",
          );
          await wait(() => requests.filter((request) => request.model === "parent").length >= 3);
        }
        process.stdin.write(JSON.stringify({ id: "abort", type: "abort" }) + "\n");
        await wait(() => records.some((record) => record.id === "abort"));
      }
      await wait(() => records.some((record) => record.type === "agent_settled"));
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
      } else {
        await wait(() => records.some((record) => record.type === "tool_execution_end"));
        const result = await readResults();
        if (background) {
          await wait(() => childStarted);
          const statusFile = join(result.details.asyncDir, "status.json");
          await wait(
            () =>
              records.some(
                (record) =>
                  record.type === "message_end" &&
                  JSON.stringify(record).includes("subagent-notify"),
              ) ||
              (childCancel && childAborts > 0),
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
                model: "local/selected",
                thinking: "medium",
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
        } else {
          receipt = result;
          if (childCancel) {
            await wait(() => childAborts > 0);
            expect(result.isError).toBe(true);
            expect(JSON.stringify(result.content)).toContain("Request aborted");
          } else
            expect(result.details.results).toMatchObject([
              {
                model: `${preserve ? "local/configured" : "local/selected"}:${preserve ? baseline : name === "clamp" ? "off" : "medium"}`,
                thinking: preserve ? baseline : name === "clamp" ? "off" : "medium",
                exitCode: 0,
                finalOutput: "CHILD_RECEIPT_OK",
                usage: { input: 10, output: 4 },
              },
            ]);
        }
        if (!childCancel) {
          expect(requests.find((request) => request.model !== "parent")).toMatchObject({
            model: preserve ? "configured" : "selected",
            ...(name === "clamp" ? {} : { reasoning_effort: preserve ? baseline : "medium" }),
          });
          const envelope = JSON.parse(
            (await Bun.file(join(directory, "envelope.jsonl")).text()).trim(),
          );
          if (preserve) expect(envelope).toEqual(original);
          else expect(envelope.model).toBe(`local/selected:${name === "clamp" ? "off" : "medium"}`);
        }
      }
      expect(classifications).toHaveLength(name === "disabled" ? 0 : 1);
      if (!preserve && !classifierCancel && !childCancel) {
        expect(allClassifications).toHaveLength(2); // Parent task plus exactly one worker decision, never a child main decision.
      }
      if (classifications.length) {
        expect(classifications[0]!.state).toEqual({
          prompt: original.task,
          agentType: "receipt-worker",
        });
        expect(JSON.stringify(classifications)).not.toContain("PRIVATE_PARENT_HISTORY");
        expect(Object.keys(classifications[0]!.questions as object).sort()).toEqual([
          "effort",
          "risky",
          "tier",
        ]);
      }
      if (name === "timeout") {
        await wait(() => classifierAborts > 0);
        expect(classifierAborts).toBe(1);
      }
    } finally {
      await writeFile(
        join(directory, "trace.json"),
        JSON.stringify(
          {
            name,
            versions: { pi: "1.4.0", subagents: "0.80.0", bun: Bun.version },
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
