import { expect } from "bun:test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { reapWorkerCli } from "./fixtures/worker-evidence.ts";
import { juniorCliTest } from "./fixtures/junior-cli-lifecycle.ts";
interface RpcRecord {
  type: string;
  id?: string;
  success?: boolean;
}
interface ChildStatus {
  state: string;
  processTerminal?: { state: string };
  steps: { sessionFile: string }[];
}
interface ToolReceipt {
  details: {
    asyncId?: string;
    results?: { runId: string; workflowKey: string; exitCode: number }[];
  };
}
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

for (const scenario of [
  "direct39",
  "direct40",
  "direct41",
  "async41",
  "workflow41",
  "cancel-resume",
] as const)
  juniorCliTest(`BOUND-19-${scenario} packed junior assistant turn boundary`, async (owner) => {
    const { evidence } = owner;
    const { directory } = evidence;
    let child: ChildProcessWithoutNullStreams;
    let closed: Promise<void>;
    await evidence.checkCapacity();
    const agentDir = join(directory, "agent");
    await mkdir(join(agentDir, "agents"), { recursive: true });
    await mkdir(join(agentDir, "extensions/subagent"), { recursive: true });
    await writeFile(
      join(agentDir, "extensions/subagent/config.json"),
      JSON.stringify({
        toolActivation: "eager",
        missions: { enabled: false },
        intercomBridge: { mode: "off" },
      }),
    );
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
    const env = {
      PATH: Bun.env.PATH,
      HOME: directory,
      TMPDIR: directory,
      PI_CODING_AGENT_DIR: agentDir,
      PI_OFFLINE: "1",
      PI_TELEMETRY: "0",
      PI_SUBAGENTS_TEMP_ROOT: join(directory, "runtime"),
      JEV_EFFORT_ENABLED: "false",
      JEV_MAIN_ROUTING_ENABLED: "false",
      JEV_SKILLS_ENABLED: "false",
      JEV_STRATEGY_ENABLED: "false",
      JEV_QUALITY_ENABLED: "false",
      JEV_DESIGN_ENABLED: "false",
      JEV_WORKER_ROUTING_ENABLED: "false",
      JEV_CREW_CONFIG: join(directory, "crew.json"),
    };
    await writeFile(
      env.JEV_CREW_CONFIG,
      JSON.stringify({ mode: "junior-lead", slots: [{ name: "alpha", model: "local/junior" }] }),
    );
    const run = async (args: string[], cwd = directory) => {
      const p = Bun.spawn(args, { cwd, env, stdout: "pipe", stderr: "pipe" });
      const output = (await new Response(p.stdout).text()) + (await new Response(p.stderr).text());
      const exitCode = await p.exited;
      evidence.commands.push({ command: args, exitCode, output });
      expect(exitCode, output).toBe(0);
    };
    await run([Bun.which("bun")!, "install"]);
    const packed = join(directory, "pi-jev-pilot.tgz");
    await run(
      [Bun.which("bun")!, "pm", "pack", "--filename", packed],
      resolve(import.meta.dir, ".."),
    );
    await mkdir(join(directory, "packed"));
    await run(["tar", "-xzf", packed, "-C", join(directory, "packed")]);
    const installed = join(directory, "packed/package");
    const cli = join(directory, "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js");
    const executor = join(directory, "node_modules/pi-subagents/index.ts");
    const observer = join(directory, "observer.ts");
    await writeFile(
      observer,
      `import {appendFileSync} from "node:fs";
export default function(pi) {
 pi.on("tool_result", e=>{if(e.toolName==="subagent")appendFileSync(${JSON.stringify(join(directory, "results.jsonl"))},JSON.stringify(e)+"\\n");});
 pi.registerCommand("bound-status", {handler:async(id,ctx)=>{
  await ctx.waitForIdle();
  const requestAt=Date.now();
  const request={version:1,requestId:"bound-"+id+"-"+requestAt,method:"status",params:{id}};
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
 pi.registerCommand("bound-reload", {handler:async(_args,ctx)=>{await ctx.waitForIdle();await ctx.reload();}});
}`,
    );
    await writeFile(
      join(agentDir, "agents/sibling.md"),
      "---\nname: sibling\ndescription: Ordinary sibling control\nmodel: local/sibling\ntools: write\ndefaultContext: fresh\n---\nExecute the assigned task.\n",
    );
    await writeFile(
      join(directory, "workflow.js"),
      'return await runs.all([{key:"junior",agent:"jev-pilot:junior",task:"Run loop"},{key:"sibling",agent:"sibling",task:"Run loop"}]);',
    );
    const options = { context: "fresh", acceptance: false, mission: false };
    const background = scenario === "async41" || scenario === "cancel-resume";
    let nextLaunch: Record<string, unknown> | undefined =
      scenario === "workflow41"
        ? { workflow: "./workflow.js", async: false, options }
        : {
            agent: "jev-pilot:junior",
            task: "Run the deterministic local loop",
            async: background,
            options,
          };
    const requests: { model: string; ordinal: number }[] = [];
    let cancelRequest = false;
    let requestAborted = false;
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        const body = (await request.json()) as { model: string; messages: { role: string }[] };
        const { model } = body;
        const ordinal = body.messages.filter((m) => m.role === "assistant").length + 1;
        requests.push({ model, ordinal });
        let tool: { name: string; arguments: string } | undefined;
        if (model === "parent" && nextLaunch) {
          tool = { name: "subagent", arguments: JSON.stringify(nextLaunch) };
          nextLaunch = undefined;
        } else if (model !== "parent") {
          if (scenario === "cancel-resume" && ordinal === 39 && !cancelRequest) {
            cancelRequest = true;
            await new Promise<void>((resolve) => {
              request.signal.addEventListener(
                "abort",
                () => {
                  requestAborted = true;
                  resolve();
                },
                { once: true },
              );
            });
          }
          const final =
            model === "sibling"
              ? 45
              : scenario === "direct39"
                ? 39
                : scenario === "direct40"
                  ? 40
                  : 41;
          if (ordinal < final)
            tool = {
              name: "write",
              arguments: JSON.stringify({
                path: join(directory, `${model}-mutation.txt`),
                content: `mutation-${ordinal}\n`,
              }),
            };
        }
        const delta = tool
          ? {
              role: "assistant",
              tool_calls: [
                { index: 0, id: `${model}-${requests.length}`, type: "function", function: tool },
                ...(scenario === "direct41" && model === "junior"
                  ? [
                      {
                        index: 1,
                        id: `${model}-${requests.length}-second`,
                        type: "function",
                        function: {
                          name: "write",
                          arguments: JSON.stringify({
                            path: join(directory, "junior-second-mutation.txt"),
                            content: `second-${ordinal}\n`,
                          }),
                        },
                      },
                    ]
                  : []),
              ],
            }
          : { role: "assistant", content: `COMPLETE_${model}_${ordinal}` };
        const chunk = {
          id: String(requests.length),
          object: "chat.completion.chunk",
          created: 1,
          model,
          choices: [{ index: 0, delta, finish_reason: null }],
        };
        const end = {
          ...chunk,
          choices: [{ index: 0, delta: {}, finish_reason: tool ? "tool_calls" : "stop" }],
          usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
        };
        return new Response(
          `data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(end)}\n\ndata: [DONE]\n\n`,
          { headers: { "content-type": "text/event-stream" } },
        );
      },
    });
    owner.server = server;
    await writeFile(
      join(agentDir, "models.json"),
      JSON.stringify({
        providers: {
          local: {
            baseUrl: `${server.url}v1`,
            api: "openai-completions",
            apiKey: "fixture-not-a-credential",
            models: ["parent", "junior", "sibling"].map((id) => ({
              id,
              reasoning: false,
              input: ["text"],
              contextWindow: 128000,
              maxTokens: 128,
            })),
          },
        },
      }),
    );
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
      "-e",
      executor,
      "-e",
      join(installed, "src/extension.ts"),
      "-e",
      observer,
    ];
    const records: RpcRecord[] = [];
    let stderr = "";
    const start = (argv = args) => {
      let pending = "";
      child = spawn(Bun.which("node")!, argv, { cwd: directory, env });
      evidence.commands.push({
        command: [Bun.which("node")!, ...argv],
        exitCode: -1,
        output: "RPC trace in trace.json",
      });
      const command = evidence.commands.at(-1)!;
      closed = new Promise<void>((resolve) =>
        child!.once("close", (code) => {
          command.exitCode = code ?? -1;
          resolve();
        }),
      );
      owner.cli = { child, closed };
      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });
      child.stdout.on("data", (data) => {
        pending += data.toString();
        let at;
        while ((at = pending.indexOf("\n")) >= 0) {
          const line = pending.slice(0, at);
          pending = pending.slice(at + 1);
          try {
            records.push(JSON.parse(line));
          } catch {
            stderr += line + "\n";
          }
        }
      });
    };
    const wait = async (predicate: () => boolean, deadline = Date.now() + 60000) => {
      while (!predicate()) {
        if (child!.exitCode !== null || Date.now() > deadline)
          throw new Error(
            `Wait failed: ${directory}; ${stderr}; ${JSON.stringify(records.slice(-3))}`,
          );
        await Bun.sleep(20);
      }
    };
    const prompt = async (
      id: string,
      message = "Run the authorized local child test.",
      deadline?: number,
    ) => {
      const offset = records.length;
      child!.stdin.write(JSON.stringify({ id, type: "prompt", message }) + "\n");
      await wait(() => records.some((r) => r.id === id), deadline);
      expect(records.find((r) => r.id === id)!.success).toBe(true);
      return offset;
    };
    const settled = (offset: number) =>
      wait(() => records.slice(offset).some((r) => r.type === "agent_settled"));
    const results = async (): Promise<ToolReceipt[]> =>
      (await readFile(join(directory, "results.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
    const status = async (id: string) => {
      const file = join(directory, "runtime/async-subagent-runs", id, "status.json");
      let value: ChildStatus | undefined;
      await wait(() => {
        try {
          value = JSON.parse(readFileSync(file, "utf8"));
          return value?.processTerminal?.state === "observed";
        } catch {
          return false;
        }
      });
      return value!;
    };
    start();
    try {
      child!.stdin.write(JSON.stringify({ id: "ready", type: "get_state" }) + "\n");
      await wait(() => records.some((r) => r.id === "ready"));
      const offset = await prompt("launch");
      await settled(offset);
      let asyncId: string | undefined;
      if (background) {
        asyncId = (await results())[0]!.details.asyncId;
        if (scenario === "cancel-resume") {
          await wait(() => cancelRequest);
          nextLaunch = { action: "stop", id: asyncId };
          await settled(await prompt("cancel"));
          await wait(() => requestAborted);
        }
        const terminal = await status(asyncId!);
        expect(terminal.state).toBe(scenario === "cancel-resume" ? "stopped" : "failed");
        if (scenario === "async41")
          expect(JSON.stringify(terminal)).toContain("40 assistant turns");
      }
      const expected = scenario === "direct39" ? 39 : scenario === "cancel-resume" ? 39 : 40;
      expect(requests.filter((r) => r.model === "junior")).toHaveLength(expected);
      expect(await readFile(join(directory, "junior-mutation.txt"), "utf8")).toBe(
        `mutation-${scenario === "direct39" ? 38 : scenario === "direct40" ? 39 : scenario === "cancel-resume" ? 38 : 40}\n`,
      );
      if (scenario === "direct41")
        expect(await readFile(join(directory, "junior-second-mutation.txt"), "utf8")).toBe(
          "second-40\n",
        );
      if (scenario === "direct39" || scenario === "direct40") {
        const output = JSON.stringify(await results());
        expect(output).toContain(`COMPLETE_junior_${expected}`);
        expect(output).toContain('"exitCode":0');
      } else if (!background)
        expect(JSON.stringify(await results())).toContain("40 assistant turns");
      if (scenario === "workflow41") {
        expect(requests.filter((r) => r.model === "sibling")).toHaveLength(45);
        expect(JSON.stringify(await results())).toContain("COMPLETE_sibling_45");
        const children = (await results())[0]!.details.results!;
        expect(children).toHaveLength(2);
        expect(children.map((result) => result.workflowKey).sort()).toEqual(["junior", "sibling"]);
        expect(new Set(children.map((result) => result.runId)).size).toBe(2);
        expect(children.find((result) => result.workflowKey === "junior")!.exitCode).toBe(1);
        expect(children.find((result) => result.workflowKey === "sibling")!.exitCode).toBe(0);
        for (const result of children) {
          expect(result.runId).toBeString();
          expect(result.runId).not.toBe("");
        }
        // Logical workflow completion precedes native close. Keep its observer owner alive.
        const deadline = Date.now() + 10000;
        const pending = new Set(children.map((result) => result.runId));
        const file = join(directory, "status-rpc.jsonl");
        await writeFile(file, "");
        let observations: StatusObservation[] = [];
        let sequence = 0;
        while (pending.size && Date.now() < deadline) {
          for (const id of pending) {
            const before = observations.length;
            await prompt(`status-${sequence++}`, `/bound-status ${id}`, deadline);
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
            if (terminal.state === "observed") pending.delete(id);
          }
          if (pending.size) await Bun.sleep(50);
        }
        expect(
          [...pending],
          "Exact workflow children must be observed before parent close",
        ).toEqual([]);
        expect(child!.exitCode).toBeNull();
      }
      if (background) {
        const before = requests.filter((r) => r.model === "junior").length;
        nextLaunch = { action: "resume", id: asyncId, message: "Continue the same retained task." };
        await settled(await prompt("resume"));
        // A stopped run is intentionally non-resumable in the executor. Exercise its
        // retained public Pi session below instead of claiming that stop is resumable.
        if (scenario === "cancel-resume") {
          expect(JSON.stringify(await results())).toContain("was stopped and cannot be resumed");
        } else {
          const revived = (await results()).at(-1)!.details.asyncId;
          expect(revived).toBeString();
          expect(revived).not.toBe(asyncId);
          const resumedTerminal = await status(revived!);
          expect(resumedTerminal.state).toBe("failed");
          expect(JSON.stringify(resumedTerminal)).toContain("40 assistant turns");
          expect(resumedTerminal.steps[0]!.sessionFile).toBe(
            (await status(asyncId!)).steps[0]!.sessionFile,
          );
        }
        expect(requests.filter((r) => r.model === "junior")).toHaveLength(before);
        // Read the public persisted child session path from its owned status receipt.
        const sessionFile = (await status(asyncId!)).steps[0]!.sessionFile;
        expect(sessionFile).toBeString();
        const reservations = (await readFile(sessionFile, "utf8"))
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line))
          .filter(
            (entry) => entry.type === "custom" && entry.customType === "jev-pilot:junior-turns",
          );
        expect(reservations).toHaveLength(scenario === "cancel-resume" ? 39 : 40);
        expect(reservations.at(-1).data.used).toBe(scenario === "cancel-resume" ? 39 : 40);
        await reapWorkerCli(child!, closed!);
        const reloadOffset = records.length;
        start([
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
          "--session",
          sessionFile,
          "-e",
          join(installed, "src/junior-turn-bound.ts"),
          "-e",
          observer,
        ]);
        await prompt("restore");
        await settled(reloadOffset);
        expect(requests.filter((r) => r.model === "junior")).toHaveLength(
          scenario === "cancel-resume" ? before + 1 : before,
        );
        await prompt("reload", "/bound-reload");
        const reloadPrompt = await prompt("after-reload");
        await settled(reloadPrompt);
        expect(requests.filter((r) => r.model === "junior")).toHaveLength(
          scenario === "cancel-resume" ? before + 1 : before,
        );
        await reapWorkerCli(child!, closed!);
        start();
        nextLaunch = {
          agent: "jev-pilot:junior",
          task: "New independent task",
          async: false,
          options,
        };
        await settled(await prompt("independent"));
        expect(requests.filter((r) => r.model === "junior")).toHaveLength(
          (scenario === "cancel-resume" ? before + 1 : before) + 40,
        );
      }
      // No automatic resume/request after terminal; the parent still accepts RPC.
      await Bun.sleep(150);
      child!.stdin.write(JSON.stringify({ id: "alive", type: "get_state" }) + "\n");
      await wait(() => records.some((r) => r.id === "alive"));
      expect(records.find((r) => r.id === "alive")!.success).toBe(true);
    } finally {
      await writeFile(
        join(directory, "trace.json"),
        JSON.stringify({ scenario, requests, records, stderr }, null, 2),
      );
      const asyncRoot = join(directory, "runtime/async-subagent-runs");
      await writeFile(
        join(directory, "run-directories.json"),
        JSON.stringify(await readdir(asyncRoot).catch(() => [])),
      );
      console.log(`BOUND-${scenario} artifacts: ${directory}`);
    }
  });
