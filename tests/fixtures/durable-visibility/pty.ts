import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const root = resolve(import.meta.dir, "../../..");
const dir = await mkdtemp(join(tmpdir(), "jev-durable-pty-"));
const agent = join(dir, "agent");
await mkdir(join(agent, "agents"), { recursive: true });
const evidence = process.env.EVIDENCE ?? "/tmp/durable-visibility/green-final";
let beforeTaskRequests = 0;
let launched = false;
const calls: unknown[] = [];
const generations: unknown[] = [];
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 0,
  async fetch(req) {
    if (!existsSync(evidence + ".task-start")) beforeTaskRequests++;
    const b = (await req.json()) as {
      model?: string;
      reasoning_effort?: string;
      questions?: { tier?: unknown };
    };
    if (new URL(req.url).pathname === "/classify") {
      calls.push({ tier: !!b.questions?.tier });
      await Bun.sleep(1000);
      return Response.json({
        answers: {
          tier: { choice: "balanced", confidence: 0.95 },
          effort: { choice: "medium", confidence: 0.95 },
          risky: { noul: 0 },
        },
      });
    }
    generations.push({ model: b.model, effort: b.reasoning_effort });
    const launch = b.model === "parent" && !launched;
    if (launch) launched = true;
    const delta = launch
      ? {
          role: "assistant",
          tool_calls: [
            {
              index: 0,
              id: "local-worker-call",
              type: "function",
              function: {
                name: "subagent",
                arguments: JSON.stringify({
                  agent: "receipt-worker",
                  model: "local/configured",
                  task: "PRIVATE_WORKER_TASK",
                  async: false,
                  options: { context: "fresh", acceptance: false, mission: false },
                }),
              },
            },
          ],
        }
      : { role: "assistant", content: "LOCAL_OK" };
    const chunk = {
      id: "local",
      object: "chat.completion.chunk",
      created: 1,
      model: b.model,
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
  "---\nname: receipt-worker\ndescription: Local worker\nmodel: local/configured\nthinking: low\ndefaultContext: fresh\ntools: read\n---\nReturn LOCAL_OK.\n",
);
const powerbar = process.env.POWERBAR_EXTENSION;
if (!powerbar)
  throw new Error(
    "Set POWERBAR_EXTENSION to installed powerbar entrypoint; no replacement footer fixture.",
  );
const p = Bun.spawn(
  [
    "uv",
    "run",
    "--offline",
    "--no-project",
    "python",
    join(import.meta.dir, "terminal_driver.py"),
    Bun.which("node")!,
    join(root, "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js"),
    "-e",
    root,
    "-e",
    powerbar,
    "-e",
    join(root, "node_modules/pi-subagents/index.ts"),
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
    "low",
  ],
  {
    cwd: dir,
    env: {
      PATH: process.env.PATH,
      HOME: dir,
      PI_CODING_AGENT_DIR: agent,
      PI_OFFLINE: "1",
      PI_TELEMETRY: "0",
      TERM: "xterm-256color",
      PI_SUBAGENTS_TEMP_ROOT: join(dir, "runtime"),
      JEV_SKILLS_ENABLED: "false",
      JEV_QUALITY_ENABLED: "false",
      JEV_STRATEGY_ENABLED: "false",
      JEV_DESIGN_ENABLED: "false",
      JEV_SYSTEM_ONE_URL: `${server.url}classify`,
      JEV_SYSTEM_ONE_API_KEY: "fixture-not-a-credential",
      JEV_TIMEOUT_MS: "5000",
      EVIDENCE: evidence,
    },
    stdout: "inherit",
    stderr: "inherit",
  },
);
const code = await p.exited;
const sessionFiles = [...new Bun.Glob("**/*.jsonl").scanSync(join(agent, "sessions"))];
const rows: unknown[] = [];
for (const path of sessionFiles) {
  for (const line of (await readFile(join(agent, "sessions", path), "utf8")).trim().split("\n")) {
    const entry = JSON.parse(line) as { customType?: string; data?: unknown };
    if (entry.customType === "jev-pilot:decision:v1") rows.push(entry.data);
  }
}
await writeFile(evidence + ".decisions.json", JSON.stringify(rows, null, 2));
const requestCheck =
  beforeTaskRequests === 0 &&
  calls.length === 2 &&
  generations.some((value) => {
    const generation = value as { model: string; effort: string };
    return generation.model === "selected" && generation.effort === "medium";
  });
await writeFile(
  evidence + ".requests.json",
  JSON.stringify(
    { calls, generations, beforeTaskRequests, requestCheck, dir, exit: code },
    null,
    2,
  ),
);
console.log({
  calls: calls.length,
  generations,
  beforeTaskRequests,
  requestCheck,
  dir,
  exit: code,
});
server.stop(true);
process.exitCode = code || (requestCheck ? 0 : 1);
