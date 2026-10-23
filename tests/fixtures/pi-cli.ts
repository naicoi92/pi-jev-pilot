import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

export interface RecordData {
  [key: string]: unknown;
}
export const root = resolve(import.meta.dir, "../..");
const cli = join(root, "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js");

export function answer(level = "high", confidence = 0.95, risky = 0): RecordData {
  return {
    answers: { effort: { choice: level, confidence }, risky: { noul: risky } },
  };
}

export class PiFixture {
  directory = "";
  settings: RecordData = {};
  server!: ReturnType<typeof Bun.serve>;
  process!: ChildProcessWithoutNullStreams;
  records: RecordData[] = [];
  classifications: RecordData[] = [];
  generations: RecordData[] = [];
  stderr = "";
  response: unknown = answer();
  classifierResponse: ((body: RecordData) => unknown) | undefined;
  skills: { name: string; body: string; description?: string; disabled?: boolean }[] = [];
  status = 200;
  classifierDelay = 0;
  modelDelay = 0;
  classifierAborts = 0;
  modelAborts = 0;
  modelText = "Fixture answer. Shall I implement the proposed multi-file change?";
  nextReadPath: string | undefined;
  toolCalls: { name: string; input: RecordData }[] = [];
  tools = "read";
  useGuidanceDefaults = false;
  useDesignDefaults = false;
  referenceTools: { name: string; active: boolean }[] = [];
  projectContext: string | undefined;
  modelFailures = 0;
  reasoning = true;
  startupModel = "fixture-model";
  startupProvider = "fixture";
  dropInputIdentity = false;
  jevBeforeControls = false;
  singleThinkingLevel = false;
  configuredModelKey = true;
  sawClassifierBearer = false;
  classifierHeaderChecks = 0;
  private sequence = 0;
  private processError: Error | undefined;
  private didExit = false;
  private closed = false;
  private exited: Promise<void> | undefined;

  constructor(private readonly commandLine?: string[]) {}

  async start(env: Record<string, string> = {}, thinkingOverride?: string): Promise<this> {
    this.directory = await mkdtemp(join(tmpdir(), "pi-jev-ticket01-"));
    const agent = join(this.directory, "agent");
    await mkdir(agent);
    if (this.projectContext)
      await writeFile(join(this.directory, "AGENTS.md"), this.projectContext);
    for (const skill of this.skills) {
      const directory = join(agent, "skills", skill.name);
      await mkdir(directory, { recursive: true });
      await writeFile(
        join(directory, "SKILL.md"),
        `---\nname: ${skill.name}\ndescription: ${skill.description ?? `Procedure for ${skill.name}`}\n${skill.disabled ? "disable-model-invocation: true\n" : ""}---\n${skill.body}\n`,
      );
    }
    this.server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: async (request) => {
        const body = (await request.json()) as RecordData;
        if (new URL(request.url).pathname === "/systemone") {
          this.classifications.push(body);
          this.classifierHeaderChecks++;
          this.sawClassifierBearer =
            request.headers.get("authorization") === "Bearer fixture-not-a-credential";
          request.signal.addEventListener("abort", () => this.classifierAborts++, { once: true });
          if (this.classifierDelay) await Bun.sleep(this.classifierDelay);
          const response = this.classifierResponse ? this.classifierResponse(body) : this.response;
          return new Response(typeof response === "string" ? response : JSON.stringify(response), {
            status: this.status,
          });
        }
        this.generations.push(body);
        if (this.modelFailures-- > 0) return new Response("temporary failure", { status: 503 });
        request.signal.addEventListener("abort", () => this.modelAborts++, {
          once: true,
        });
        if (this.modelDelay) await Bun.sleep(this.modelDelay);
        const readPath = this.nextReadPath;
        this.nextReadPath = undefined;
        const tool =
          this.toolCalls.shift() ??
          (readPath ? { name: "read", input: { path: readPath } } : undefined);
        const delta = tool
          ? {
              role: "assistant",
              tool_calls: [
                {
                  index: 0,
                  id: `fixture-tool-${this.generations.length}`,
                  type: "function",
                  function: {
                    name: tool.name,
                    arguments: JSON.stringify(tool.input),
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
              finish_reason: tool ? "tool_calls" : "stop",
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
            ...(this.configuredModelKey ? { apiKey: "fixture-not-a-credential" } : {}),
            models: [
              {
                id: "fixture-model",
                reasoning: this.reasoning,
                input: ["text"],
                contextWindow: 32000,
                maxTokens: 512,
                thinkingLevelMap: {
                  off: this.singleThinkingLevel ? null : "none",
                  minimal: null,
                  low: this.singleThinkingLevel ? null : "low",
                  medium: this.singleThinkingLevel ? null : "medium",
                  high: "high",
                  xhigh: null,
                  max: null,
                },
              },
              {
                id: "fixture-other-model",
                reasoning: true,
                input: ["text"],
                contextWindow: 32000,
                maxTokens: 512,
              },
              {
                id: "fixture-plain-model",
                reasoning: false,
                input: ["text"],
                contextWindow: 32000,
                maxTokens: 512,
              },
            ],
          },
          "fixture-fast": {
            baseUrl: `${this.server.url}v1`,
            api: "openai-completions",
            apiKey: "fixture-not-a-credential",
            models: [
              {
                id: "lookup",
                reasoning: true,
                input: ["text"],
                contextWindow: 32000,
                maxTokens: 512,
              },
            ],
          },
          "fixture-deep": {
            baseUrl: `${this.server.url}v1`,
            api: "openai-completions",
            apiKey: "fixture-not-a-credential",
            models: [
              {
                id: "judgment",
                reasoning: true,
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
import { Type } from ${JSON.stringify(join(root, "node_modules/@earendil-works/pi-ai/dist/index.js"))};
export default function (pi: ExtensionAPI) {
  const referenceTools = ${JSON.stringify(this.referenceTools)};
  for (const { name } of referenceTools) pi.registerTool({
    name, label: name, description: "Disposable reference library fixture", defaultActive: false,
    parameters: Type.Object({}),
    async execute() { throw new Error("Reference tools must not be invoked by design advice."); }
  });
  pi.on("session_start", () => {
    pi.setActiveTools([...pi.getActiveTools().filter((name) => !referenceTools.some((tool) => tool.name === name)), ...referenceTools.filter((tool) => tool.active).map((tool) => tool.name)]);
  });
  pi.registerCommand("fixture-tools", { handler: async () => { log({ fixtureTools: pi.getAllTools().map((tool) => tool.name), active: pi.getActiveTools() }); } });
  pi.registerCommand("fixture-reload", { handler: async (_args, ctx) => { await ctx.reload(); } });
  pi.registerCommand("fixture-tree", { handler: async (id, ctx) => { await ctx.navigateTree(id, { summarize: false }); } });
  pi.registerCommand("fixture-fork-at", { handler: async (id, ctx) => { await ctx.fork(id, { position: "at" }); } });
  pi.registerCommand("fixture-effort", { handler: async (value) => { process.env.JEV_EFFORT_ENABLED = value; } });
  pi.registerCommand("fixture-tier-deep", { handler: async (value) => { process.env.JEV_TIER_DEEP = value; } });
  pi.registerCommand("fixture-model-refresh", { handler: async (_args, ctx) => { await ctx.modelRegistry.refresh(); } });
  let dropInputIdentity = ${this.dropInputIdentity};
  pi.registerCommand("fixture-drop-input-identity", { handler: async () => { dropInputIdentity = true; } });
  const log = (event: unknown) => appendFileSync(${JSON.stringify(join(this.directory, "lifecycle.jsonl"))}, JSON.stringify(event) + "\\n");
  pi.on("message_end", (event) => {
    if (dropInputIdentity && event.message.role === "user") return { message: { role: "user", content: event.message.content, timestamp: event.message.timestamp } };
  });
  pi.on("session_start", log);
  pi.on("session_shutdown", log);
}
`,
    );
    await writeFile(
      join(agent, "settings.json"),
      JSON.stringify({
        ...this.settings,
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
      ...(this.useDesignDefaults ? {} : { JEV_DESIGN_ENABLED: "false" }),
      ...(this.useGuidanceDefaults
        ? {}
        : { JEV_STRATEGY_ENABLED: "false", JEV_QUALITY_ENABLED: "false" }),
      ...env,
    };
    const install = Bun.spawn([process.execPath, "run", cli, "install", root], {
      cwd: this.directory,
      env: childEnv,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [installCode, installStdout, installStderr] = await Promise.all([
      install.exited,
      new Response(install.stdout).text(),
      new Response(install.stderr).text(),
    ]);
    if (installCode !== 0)
      throw new Error(
        `Local Pi package install failed: pid=${install.pid}; exitCode=${installCode}; signal=${install.signalCode}; stdout=${installStdout}; stderr=${installStderr}`,
      );
    const [executable, ...args] = this.commandLine ?? [
      process.execPath,
      "run",
      cli,
      ...(this.jevBeforeControls ? ["-e", root] : []),
      "-e",
      controls,
      "--mode",
      "rpc",
      "--no-mcp",
      ...(this.skills.length ? [] : ["--no-skills"]),
      "--no-prompt-templates",
      "--no-themes",
      ...(this.projectContext ? [] : ["--no-context-files"]),
      "--tools",
      [this.tools, ...this.referenceTools.map((tool) => tool.name)].join(","),
      "--offline",
      "--no-approve",
      "--model",
      `${this.startupProvider}/${this.startupModel}`,
      ...(thinkingOverride ? ["--thinking", thinkingOverride] : []),
    ];
    this.processError = undefined;
    this.didExit = false;
    this.closed = false;
    this.process = spawn(executable!, args, { cwd: this.directory, env: childEnv });
    this.exited = new Promise((resolve) => {
      this.process.once("close", () => {
        this.closed = true;
        resolve();
      });
    });
    this.process.on("error", (error) => {
      this.processError = error;
    });
    this.process.once("exit", () => {
      this.didExit = true;
    });
    this.process.stdin.on("error", (error) => {
      this.processError = error;
    });
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
    this.process.stderr.on("data", (data: Buffer) => (this.stderr += data.toString()));
    try {
      await this.command("get_state");
      return this;
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  async wait(predicate: () => boolean, timeout = 12000): Promise<void> {
    const until = Date.now() + timeout;
    while (!predicate()) {
      this.checkProcess();
      if (Date.now() > until) throw new Error(`Fixture deadline. ${this.diagnostics()}`);
      await Bun.sleep(10);
    }
  }

  private diagnostics(): string {
    return `pid=${this.process?.pid}; exitCode=${this.process?.exitCode}; signal=${this.process?.signalCode}; error=${this.processError?.message ?? "none"}; stderr=${this.stderr}; records=${JSON.stringify(this.records.slice(-8))}`;
  }

  private checkProcess(): void {
    if (this.processError || this.didExit || this.closed)
      throw new Error(`Fixture child stopped. ${this.diagnostics()}`);
  }

  async command(type: string, data: RecordData = {}): Promise<RecordData> {
    this.checkProcess();
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
      this.records.slice(offset).some((entry) => entry.type === "agent_settled"),
    );
  }

  private async awaitClose(timeout: number): Promise<boolean> {
    if (this.closed) return true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.exited!.then(() => true),
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), timeout);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  async stop(): Promise<void> {
    if (!this.process || this.closed) return;
    this.process.stdin.end();
    if (await this.awaitClose(5000)) return;
    this.process.kill("SIGTERM");
    if (await this.awaitClose(1000)) return;
    this.process.kill("SIGKILL");
    if (!(await this.awaitClose(1000)))
      throw new Error(
        `Fixture child did not close after SIGKILL; retaining directory. ${this.diagnostics()}`,
      );
    await this.exited;
  }

  async close(): Promise<void> {
    await this.stop();
    this.server?.stop(true);
    if (this.directory) await rm(this.directory, { recursive: true, force: true });
  }
}
