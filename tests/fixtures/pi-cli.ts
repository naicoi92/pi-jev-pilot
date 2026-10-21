import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

export interface RecordData {
  [key: string]: unknown;
}
export const root = resolve(import.meta.dir, "../..");
const cli = join(
  root,
  "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js",
);

export function answer(
  level = "high",
  confidence = 0.95,
  risky = 0,
): RecordData {
  return {
    answers: { effort: { choice: level, confidence }, risky: { noul: risky } },
  };
}

export class PiFixture {
  directory = "";
  server!: ReturnType<typeof Bun.serve>;
  process!: ChildProcessWithoutNullStreams;
  records: RecordData[] = [];
  classifications: RecordData[] = [];
  generations: RecordData[] = [];
  stderr = "";
  response: unknown = answer();
  status = 200;
  classifierDelay = 0;
  modelDelay = 0;
  classifierAborts = 0;
  modelAborts = 0;
  modelText =
    "Fixture answer. Shall I implement the proposed multi-file change?";
  nextReadPath: string | undefined;
  modelFailures = 0;
  reasoning = true;
  configuredModelKey = true;
  sawClassifierBearer = false;
  classifierHeaderChecks = 0;
  private sequence = 0;

  async start(
    env: Record<string, string> = {},
    thinkingOverride?: string,
  ): Promise<this> {
    this.directory = await mkdtemp(join(tmpdir(), "pi-jev-ticket01-"));
    const agent = join(this.directory, "agent");
    await mkdir(agent);
    this.server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: async (request) => {
        const body = (await request.json()) as RecordData;
        if (new URL(request.url).pathname === "/systemone") {
          this.classifications.push(body);
          this.classifierHeaderChecks++;
          this.sawClassifierBearer =
            request.headers.get("authorization") ===
            "Bearer fixture-not-a-credential";
          request.signal.addEventListener(
            "abort",
            () => this.classifierAborts++,
            { once: true },
          );
          if (this.classifierDelay) await Bun.sleep(this.classifierDelay);
          return new Response(
            typeof this.response === "string"
              ? this.response
              : JSON.stringify(this.response),
            { status: this.status },
          );
        }
        this.generations.push(body);
        if (this.modelFailures-- > 0)
          return new Response("temporary failure", { status: 503 });
        request.signal.addEventListener("abort", () => this.modelAborts++, {
          once: true,
        });
        if (this.modelDelay) await Bun.sleep(this.modelDelay);
        const readPath = this.nextReadPath;
        this.nextReadPath = undefined;
        const delta = readPath
          ? {
              role: "assistant",
              tool_calls: [
                {
                  index: 0,
                  id: "fixture-read",
                  type: "function",
                  function: {
                    name: "read",
                    arguments: JSON.stringify({ path: readPath }),
                  },
                },
              ],
            }
          : { role: "assistant", content: this.modelText };
        const chunk = {
          id: "fixture",
          object: "chat.completion.chunk",
          created: 1,
          model: "fixture-model",
          choices: [{ index: 0, delta, finish_reason: null }],
        };
        const end = {
          ...chunk,
          choices: [
            {
              index: 0,
              delta: {},
              finish_reason: readPath ? "tool_calls" : "stop",
            },
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
      join(agent, "models.json"),
      JSON.stringify({
        providers: {
          fixture: {
            baseUrl: `${this.server.url}v1`,
            api: "openai-completions",
            ...(this.configuredModelKey
              ? { apiKey: "fixture-not-a-credential" }
              : {}),
            models: [
              {
                id: "fixture-model",
                reasoning: this.reasoning,
                input: ["text"],
                contextWindow: 32000,
                maxTokens: 512,
                thinkingLevelMap: {
                  off: "none",
                  minimal: null,
                  low: "low",
                  medium: "medium",
                  high: "high",
                  xhigh: null,
                  max: null,
                },
              },
            ],
          },
        },
      }),
    );
    const controls = join(this.directory, "fixture-controls.ts");
    await writeFile(
      controls,
      `import type { ExtensionAPI } from ${JSON.stringify(join(root, "node_modules/@earendil-works/pi-coding-agent/dist/index.js"))};
import { appendFileSync } from "node:fs";
export default function (pi: ExtensionAPI) {
  pi.registerCommand("fixture-reload", { handler: async (_args, ctx) => { await ctx.reload(); } });
  pi.registerCommand("fixture-tree", { handler: async (id, ctx) => { await ctx.navigateTree(id, { summarize: false }); } });
  pi.registerCommand("fixture-fork-at", { handler: async (id, ctx) => { await ctx.fork(id, { position: "at" }); } });
  const log = (event: unknown) => appendFileSync(${JSON.stringify(join(this.directory, "lifecycle.jsonl"))}, JSON.stringify(event) + "\\n");
  pi.on("session_start", log);
  pi.on("session_shutdown", log);
}
`,
    );
    await writeFile(
      join(agent, "settings.json"),
      JSON.stringify({
        defaultThinkingLevel: "medium",
        retry: { enabled: false, baseDelayMs: 20 },
        compaction: { enabled: false, keepRecentTokens: 50 },
      }),
    );
    const childEnv = {
      PATH: process.env.PATH,
      HOME: this.directory,
      PI_CODING_AGENT_DIR: agent,
      PI_OFFLINE: "1",
      PI_TELEMETRY: "0",
      JEV_SYSTEM_ONE_URL: `${this.server.url}systemone`,
      JEV_SYSTEM_ONE_API_KEY: "fixture-not-a-credential",
      ...env,
    };
    const install = Bun.spawn([process.execPath, "run", cli, "install", root], {
      cwd: this.directory,
      env: childEnv,
      stdout: "pipe",
      stderr: "pipe",
    });
    const installOutput = await new Response(install.stderr).text();
    if ((await install.exited) !== 0)
      throw new Error(`Local Pi package install failed: ${installOutput}`);
    this.process = spawn(
      process.execPath,
      [
        "run",
        cli,
        "-e",
        controls,
        "--mode",
        "rpc",
        "--no-mcp",
        "--no-skills",
        "--no-prompt-templates",
        "--no-themes",
        "--no-context-files",
        "--tools",
        "read",
        "--offline",
        "--no-approve",
        "--model",
        "fixture/fixture-model",
        ...(thinkingOverride ? ["--thinking", thinkingOverride] : []),
      ],
      { cwd: this.directory, env: childEnv },
    );
    let pending = "";
    this.process.stdout.on("data", (data: Buffer) => {
      pending += data.toString();
      let index: number;
      while ((index = pending.indexOf("\n")) !== -1) {
        const line = pending.slice(0, index);
        pending = pending.slice(index + 1);
        try {
          this.records.push(JSON.parse(line) as RecordData);
        } catch {
          this.stderr += line;
        }
      }
    });
    this.process.stderr.on(
      "data",
      (data: Buffer) => (this.stderr += data.toString()),
    );
    await this.command("get_state");
    return this;
  }

  async wait(predicate: () => boolean, timeout = 12000): Promise<void> {
    const until = Date.now() + timeout;
    while (!predicate()) {
      if (Date.now() > until)
        throw new Error(
          `Fixture deadline. stderr=${this.stderr}; records=${JSON.stringify(this.records.slice(-8))}`,
        );
      await Bun.sleep(10);
    }
  }

  async command(type: string, data: RecordData = {}): Promise<RecordData> {
    const id = `command-${++this.sequence}`;
    this.process.stdin.write(`${JSON.stringify({ id, type, ...data })}\n`);
    await this.wait(() => this.records.some((entry) => entry.id === id));
    const response = this.records.find((entry) => entry.id === id)!;
    if (response.success !== true) throw new Error(JSON.stringify(response));
    return response;
  }

  async prompt(message: string): Promise<void> {
    const offset = this.records.length;
    await this.command("prompt", { message });
    await this.wait(() =>
      this.records
        .slice(offset)
        .some((entry) => entry.type === "agent_settled"),
    );
  }

  async stop(): Promise<void> {
    if (this.process && this.process.exitCode === null) {
      this.process.stdin.end();
      await this.wait(() => this.process.exitCode !== null, 5000).catch(() =>
        this.process.kill(),
      );
    }
  }

  async close(): Promise<void> {
    await this.stop();
    this.server?.stop(true);
    if (this.directory)
      await rm(this.directory, { recursive: true, force: true });
  }
}
