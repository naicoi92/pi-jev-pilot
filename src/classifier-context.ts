// Context minimization adapted from Jev Pilot context.ts; see NOTICE.md.
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

interface ContextMessage {
  role: "user" | "assistant";
  text: string;
  tools: { name: string; failed: boolean }[];
}

function messagesOf(ctx: ExtensionContext): ContextMessage[] {
  const source = ctx.sessionManager.buildSessionProjection().messages;
  const failed = new Set(
    source.flatMap((message) =>
      message.role === "toolResult" && message.isError
        ? [message.toolCallId]
        : [],
    ),
  );
  return source.flatMap((message): ContextMessage[] => {
    if (message.role !== "user" && message.role !== "assistant") return [];
    const content = message.content;
    return [
      {
        role: message.role,
        text:
          typeof content === "string"
            ? content
            : content
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("\n"),
        tools:
          typeof content === "string"
            ? []
            : content.flatMap((part) =>
                part.type === "toolCall"
                  ? [{ name: part.name, failed: failed.has(part.id) }]
                  : [],
              ),
      },
    ];
  });
}

function recentContext(messages: ContextMessage[], prompt: string): string {
  let list = messages;
  if (
    list.at(-1)?.role === "user" &&
    list.at(-1)?.text.trim() === prompt.trim()
  )
    list = list.slice(0, -1);
  const newestAssistant = list.findLastIndex(
    (message) => message.role === "assistant" && message.text.trim(),
  );
  const lines: string[] = [];
  let used = 0;
  for (let index = list.length - 1; index >= 0 && lines.length < 4; index--) {
    const message = list[index]!;
    const text = message.text.replace(/\s+/g, " ").trim();
    const tools = message.tools.map(
      (tool) => `${tool.name}${tool.failed ? " (failed)" : ""}`,
    );
    if (!text && !tools.length) continue;
    const cap =
      index === newestAssistant ? 1100 : newestAssistant >= 0 ? 300 : 500;
    const tail = index === newestAssistant ? 792 : 0;
    const said =
      text.length <= cap
        ? text
        : tail
          ? `${text.slice(0, cap - tail)} … ${text.slice(-tail)}`
          : `${text.slice(0, cap)}…`;
    const line = `${message.role}: ${said}${tools.length ? ` [tools: ${tools.join(", ")}]` : ""}`;
    if (used + line.length > 2000) {
      if (!lines.length) lines.unshift(`${line.slice(0, 1999)}…`);
      break;
    }
    lines.unshift(line);
    used += line.length + 1;
  }
  return lines.join("\n");
}

const platforms: [RegExp, string][] = [
  [/(^|\/)vercel\.json$|(^|\/)\.vercel\/$/, "Vercel"],
  [/(^|\/)cdk\.json$/, "AWS CDK"],
  [/(^|\/)serverless\.(yml|yaml|ts|js)$/, "AWS Serverless"],
  [/(^|\/)template\.ya?ml$|(^|\/)samconfig\.toml$/, "AWS SAM"],
  [/(^|\/)buildspec\.ya?ml$/, "AWS CodeBuild"],
  [/(^|\/)amplify\.ya?ml$|(^|\/)amplify\/$/, "AWS Amplify"],
  [/(^|\/)netlify\.toml$/, "Netlify"],
  [/(^|\/)firebase\.json$/, "Firebase"],
  [/(^|\/)supabase\/config\.toml$/, "Supabase"],
  [/(^|\/)fly\.toml$/, "Fly.io"],
  [/(^|\/)wrangler\.(toml|json|jsonc)$/, "Cloudflare Workers"],
  [/(^|\/)app\.ya?ml$|(^|\/)cloudbuild\.ya?ml$/, "Google Cloud"],
  [/(^|\/)render\.ya?ml$/, "Render"],
  [/(^|\/)railway\.(json|toml)$/, "Railway"],
  [/(^|\/)(docker-)?compose\.ya?ml$/, "Docker Compose"],
  [/(^|\/)Dockerfile$/, "Docker"],
  [/(^|\/)\.github\/workflows\/$/, "GitHub Actions"],
  [/(^|\/)bitbucket-pipelines\.yml$/, "Bitbucket Pipelines"],
];

async function platformNames(cwd: string): Promise<string> {
  const paths: string[] = [];
  const excluded = new Set([
    "node_modules",
    ".git",
    ".pi",
    ".codegraph",
    "dist",
    "build",
    ".next",
    "out",
    "cdk.out",
    "vendor",
    "target",
    ".venv",
    "venv",
    "__pycache__",
    "coverage",
  ]);
  async function scan(relative: string, depth: number): Promise<void> {
    const entries = await readdir(join(cwd, relative), {
      withFileTypes: true,
    }).catch(() => []);
    let directories = 0;
    for (const entry of entries) {
      if (excluded.has(entry.name) || entry.isSymbolicLink()) continue;
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      paths.push(`${path}${entry.isDirectory() ? "/" : ""}`);
      if (entry.isDirectory() && depth > 0 && directories++ < 60)
        await scan(path, depth - 1);
    }
  }
  await scan("", 1);
  return (
    [
      ...new Set(
        platforms
          .filter(([pattern]) => paths.some((path) => pattern.test(path)))
          .map(([, name]) => name),
      ),
    ].join(", ") || "none found"
  );
}

/** Only prompt, bounded text, derived signals, tool names and platform marker names leave the host. */
export async function classifierState(
  ctx: ExtensionContext,
  prompt: string,
  toolNames: string[],
): Promise<unknown> {
  const messages = messagesOf(ctx);
  const recentTools = {
    edits: 0,
    commands: 0,
    reads: 0,
    subagents: 0,
    failed: 0,
  };
  for (const message of messages.slice(-10)) {
    for (const tool of message.tools) {
      if (["edit", "write"].includes(tool.name)) recentTools.edits++;
      if (["bash", "powershell"].includes(tool.name)) recentTools.commands++;
      if (["read", "grep", "find", "ls"].includes(tool.name))
        recentTools.reads++;
      if (tool.name === "subagent") recentTools.subagents++;
      if (tool.failed) recentTools.failed++;
    }
  }
  const pathPattern =
    /(?:^|[\s`'"(])((?:[\w.-]+\/)+[\w.-]+|[\w-]+\.(?:tsx?|jsx?|mjs|py|go|rs|java|kt|swift|rb|php|cs|c|cc|cpp|h|hpp|sql|json|ya?ml|toml|md|css|scss|html|sh|lock))(?=$|[\s`'"),:;])/g;
  const text = prompt.trim();
  return {
    prompt,
    recent_context: recentContext(messages, prompt),
    signals: {
      prompt_chars: text.length,
      files_mentioned: new Set(
        [...text.matchAll(pathPattern)].map((match) => match[1]),
      ).size,
      has_code_or_error:
        /```|Traceback|Exception|\berror\b|\bfailed\b|stack ?trace|\bat \S+:\d+/i.test(
          text,
        ),
      is_question:
        text.endsWith("?") ||
        /^(what|why|how|when|where|which|who|can|could|does|do|did|is|are|should|would|will)\b/i.test(
          text,
        ),
      recent_tools: recentTools,
    },
    project_platforms: await platformNames(ctx.cwd),
    tool_names: toolNames,
  };
}
