import { expect } from "bun:test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
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
  details: { asyncId?: string };
}

for (const scenario of ["direct41", "async41", "workflow41", "retained-denied"] as const) {
  const name = `REQUIRED-19-${scenario} policy conflict before provider activity`;
  juniorCliTest(name, async (owner) => {
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
import {registerSubagentCapabilityCeiling} from "pi-subagents/capability-ceiling";
export default function(pi) {
 const deny=ctx=>registerSubagentCapabilityCeiling({sessionId:ctx.sessionManager.getSessionId(),source:"jev-required-denied-fixture",ceiling:{denyExtensions:true}});
 pi.on("session_start",(_e,ctx)=>{if(${JSON.stringify(scenario)}!=="retained-denied")deny(ctx);});
 pi.registerCommand("deny-helper",{handler:async(_args,ctx)=>{deny(ctx);}});
 pi.on("tool_result", e=>{if(e.toolName==="subagent")appendFileSync(${JSON.stringify(join(directory, "results.jsonl"))},JSON.stringify(e)+"\\n");});
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
    const background = scenario === "async41" || scenario === "retained-denied";
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
          const final = model === "sibling" ? 45 : 41;
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
    const wait = async (predicate: () => boolean) => {
      const deadline = Date.now() + 60000;
      while (!predicate()) {
        if (child!.exitCode !== null || Date.now() > deadline)
          throw new Error(
            `Wait failed: ${directory}; ${stderr}; ${JSON.stringify(records.slice(-3))}`,
          );
        await Bun.sleep(20);
      }
    };
    const prompt = async (id: string, message = "Run the authorized local child test.") => {
      const offset = records.length;
      child!.stdin.write(JSON.stringify({ id, type: "prompt", message }) + "\n");
      await wait(() => records.some((r) => r.id === id));
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
      if (scenario === "retained-denied") {
        const id = (await results())[0]!.details.asyncId;
        const terminal = await status(id!);
        expect(terminal.state).toBe("failed");
        expect(requests.filter((r) => r.model === "junior")).toHaveLength(40);
        const descriptor = await readFile(
          join(directory, "runtime/async-subagent-runs", id!, "recovery-descriptor.json"),
          "utf8",
        );
        expect(descriptor).toContain("jev-pilot-junior-turn-bound");
        await prompt("deny", "/deny-helper");
        nextLaunch = {
          action: "resume",
          id,
          message: "Continue retained task",
          async: true,
          options,
        };
        await settled(await prompt("denied-resume"));
        expect(JSON.stringify((await results()).at(-1))).toMatch(
          /denies extensions.*requires: jev-pilot-junior-turn-bound/,
        );
        expect(requests.filter((r) => r.model === "junior")).toHaveLength(40);
      } else {
        expect(requests.filter((r) => r.model === "junior")).toHaveLength(0);
        expect(JSON.stringify(await results())).toMatch(
          /denies extensions.*requires: jev-pilot-junior-turn-bound/,
        );
      }
      // Independent ordinary sibling under the same UUID-only denial remains uncapped.
      nextLaunch = { agent: "sibling", task: "Run ordinary loop", async: false, options };
      await settled(await prompt("ordinary-sibling"));
      expect(requests.filter((r) => r.model === "sibling")).toHaveLength(
        scenario === "workflow41" ? 90 : 45,
      );
      expect(JSON.stringify(await results())).toContain("COMPLETE_sibling_45");
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
}
