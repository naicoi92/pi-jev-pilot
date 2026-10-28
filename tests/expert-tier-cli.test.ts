import { afterEach, expect, test } from "bun:test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { reapWorkerCli } from "./fixtures/worker-evidence.ts";

const root = resolve(import.meta.dir, "..");
const cli = join(root, "node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js");
let child: ChildProcessWithoutNullStreams | undefined;
let closed: Promise<void> | undefined;
let server: ReturnType<typeof Bun.serve> | undefined;
let directory: string | undefined;
afterEach(async () => {
  if (child && closed) await reapWorkerCli(child, closed);
  child = undefined;
  closed = undefined;
  server?.stop(true);
  server = undefined;
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = undefined;
}, 25000);

interface Scenario {
  name: string;
  tiers: Record<string, string>;
  choice: string;
  expertNeeded?: number;
  offered: string[];
  asksExpertNeeded: boolean;
  selected: string;
}

// Deterministic real-Pi runs: config -> classification request -> selected child model.
// The fake System One and OpenAI-compatible provider run on loopback; no hosted request is made.
const scenarios: Scenario[] = [
  {
    name: "sparse tiers offer only the configured tier",
    tiers: { balanced: "local/balanced" },
    choice: "balanced",
    offered: ["balanced"],
    asksExpertNeeded: false,
    selected: "balanced",
  },
  {
    name: "expert disabled sends no expert question",
    tiers: {
      fast: "local/fast",
      balanced: "local/balanced",
      deep: "local/deep",
      expert: "  ",
    },
    choice: "deep",
    offered: ["fast", "balanced", "deep"],
    asksExpertNeeded: false,
    selected: "deep",
  },
  {
    name: "expert enabled admits expert above 0.9",
    tiers: {
      fast: "local/fast",
      balanced: "local/balanced",
      deep: "local/deep",
      expert: "local/expert",
    },
    choice: "expert",
    expertNeeded: 0.91,
    offered: ["fast", "balanced", "deep", "expert"],
    asksExpertNeeded: true,
    selected: "expert",
  },
  {
    name: "expert enabled falls back to deep at exactly 0.9",
    tiers: {
      fast: "local/fast",
      balanced: "local/balanced",
      deep: "local/deep",
      expert: "local/expert",
    },
    choice: "expert",
    expertNeeded: 0.9,
    offered: ["fast", "balanced", "deep", "expert"],
    asksExpertNeeded: true,
    selected: "deep",
  },
];

for (const scenario of scenarios)
  test(`EXPERT-03 Pi CLI: ${scenario.name}`, async () => {
    directory = await mkdtemp(join(tmpdir(), "pi-jev-expert-cli-"));
    const agent = join(directory, "agent");
    await mkdir(join(agent, "agents"), { recursive: true });
    const records: Record<string, unknown>[] = [];
    const requests: Record<string, unknown>[] = [];
    const classifications: Record<string, unknown>[] = [];
    const endpointEntries: string[] = [];
    let sent = false;
    const original = {
      agent: "receipt-worker",
      model: "local/configured",
      task: "Resolve the open design decision with tightly interacting constraints.",
      async: false,
      options: { context: "fresh", acceptance: false, mission: false },
    };
    server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      async fetch(request) {
        endpointEntries.push(new URL(request.url).pathname);
        const body = (await request.json()) as Record<string, unknown>;
        if (new URL(request.url).pathname === "/classify") {
          classifications.push(body);
          return Response.json({
            answers: {
              tier: { choice: scenario.choice, confidence: 0.95 },
              effort: { choice: "medium", confidence: 0.95 },
              risky: { noul: 0 },
              ...(scenario.expertNeeded === undefined
                ? {}
                : { expert_needed: { noul: scenario.expertNeeded } }),
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
                  id: "expert-cli-call-1",
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
            models: ["parent", "configured", "fast", "balanced", "deep", "expert"].map((id) => ({
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
      }),
    );
    await writeFile(
      join(agent, "jev-pilot.json"),
      JSON.stringify({
        tiers: scenario.tiers,
        effortEnabled: false,
        skillsEnabled: false,
        strategyEnabled: false,
        qualityEnabled: false,
        designEnabled: false,
        workerRoutingEnabled: true,
        classifier: {
          url: `${server.url}classify`,
          apiKeyEnv: "EXPERT_FIXTURE_API_KEY",
          timeoutMs: 5000,
        },
      }),
    );
    await writeFile(
      join(agent, "agents/receipt-worker.md"),
      "---\nname: receipt-worker\ndescription: Deterministic receipt worker\nmodel: local/configured\nthinking: low\ndefaultContext: fresh\ntools: read\n---\nReturn CHILD_RECEIPT_OK without tools.\n",
    );
    const args = [
      cli,
      "-e",
      root,
      "-e",
      join(root, "node_modules/pi-subagents/index.ts"),
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
    child = spawn(Bun.which("node")!, args, {
      cwd: directory,
      env: {
        PATH: Bun.env.PATH,
        HOME: directory,
        PI_CODING_AGENT_DIR: agent,
        PI_OFFLINE: "1",
        PI_TELEMETRY: "0",
        PI_SUBAGENTS_TEMP_ROOT: join(directory, "runtime"),
        EXPERT_FIXTURE_API_KEY: "fixture-not-a-credential",
      },
    });
    const process = child;
    closed = new Promise<void>((done) => process.once("close", () => done()));
    let stderr = "";
    let pending = "";
    process.stderr.on("data", (data) => (stderr += data.toString()));
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
      const until = Date.now() + 30000;
      while (!predicate()) {
        if (process.exitCode !== null || Date.now() > until)
          throw new Error(
            `deadline; endpoint=${server?.url}; ready=${records.some((record) => record.id === "ready")}; endpointEntries=${JSON.stringify(endpointEntries)}; providerRequests=${requests.length}; classifications=${classifications.length}; exitCode=${process.exitCode}; stderr=${stderr}; records=${JSON.stringify(records.slice(-5))}`,
          );
        await Bun.sleep(20);
      }
    };
    process.stdin.write(JSON.stringify({ id: "ready", type: "get_state" }) + "\n");
    await wait(() => records.some((record) => record.id === "ready"));
    process.stdin.write(
      JSON.stringify({ id: "start", type: "prompt", message: "Run the deterministic worker." }) +
        "\n",
    );
    await wait(() => records.some((record) => record.type === "tool_execution_end"));
    const terminal = records.find((record) => record.type === "tool_execution_end")!;
    expect(terminal.isError).not.toBe(true);
    const result = terminal.result as {
      details: { results: { model: string; thinking: string; exitCode: number }[] };
    };

    expect(classifications).toHaveLength(1);
    const questions = classifications[0]!.questions as Record<
      string,
      { type?: string; criteria: Record<string, string> }
    >;
    expect(Object.keys(questions.tier!.criteria)).toEqual(scenario.offered);
    expect(Object.keys(questions).includes("expert_needed")).toBe(scenario.asksExpertNeeded);
    if (!scenario.asksExpertNeeded)
      expect(JSON.stringify(classifications[0])).not.toContain("expert");
    expect(result.details.results).toMatchObject([
      { model: `local/${scenario.selected}:medium`, thinking: "medium", exitCode: 0 },
    ]);
    expect(requests.find((request) => request.model !== "parent")).toMatchObject({
      model: scenario.selected,
      reasoning_effort: "medium",
    });
    expect(requests.some((request) => request.model === "expert")).toBe(
      scenario.selected === "expert",
    );
  }, 60000);
