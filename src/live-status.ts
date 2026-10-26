import type {
  ExtensionAPI,
  ExtensionUIContext,
  SessionEntry,
  Theme,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth, type Component, type TUI } from "@earendil-works/pi-tui";
import type { Strategy } from "./guidance-policy.ts";
import { DECISION_TYPE, readDecisionRow, type VisibleEffort } from "./decision-visibility.ts";
import { SKILL_ENTRY_TYPE } from "./skill-policy.ts";

const KEY = "jev-pilot";
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SEPARATOR = " · ";
/** Spinner column is always reserved so busy/idle toggles do not move the text. */
const GUTTER = 2;
const RIGHT_PADDING = 1;

export type LiveOutcome =
  | {
      kind: "decided";
      effort: VisibleEffort;
      requested: VisibleEffort;
      skill?: string;
      strategy?: Strategy;
    }
  | { kind: "fallback"; effort: VisibleEffort; reason: string; skill?: string; strategy?: Strategy }
  | { kind: "error"; reason: string }
  | { kind: "skipped"; skill?: string; strategy?: Strategy }
  | { kind: "cancelled" };

interface Warning {
  label: "fallback" | "error";
  effort?: VisibleEffort;
  reason: string;
}

type Color = "accent" | "muted" | "dim" | "warning" | "error";
interface Part {
  text: string;
  color: Color;
}

const TOOL_ACTIVITY: Record<string, string> = {
  read: "reading",
  ls: "reading",
  grep: "searching",
  find: "searching",
  edit: "writing",
  write: "writing",
  bash: "running",
};

/** Shared Jev widget above the editor; presentation only, never model context. */
export class LiveStatusLine {
  private ui: ExtensionUIContext | undefined;
  private tui: TUI | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private choosing = false;
  private workerAssessments = new Set<symbol>();
  private running = false;
  private observedThinking = false;
  private tools = new Map<string, string>();
  private workers = 0;
  private workerRows: readonly string[] = [];
  private effort: VisibleEffort | undefined;
  private requested: VisibleEffort | undefined;
  private skill: string | undefined;
  private strategy: Strategy | undefined;
  private warning: Warning | undefined;
  private token = 0;

  constructor(private readonly frameMs = 100) {}

  /** Starts a fresh session line; only the supplied durable effort and skill carry over. */
  attach(ui: ExtensionUIContext, restored: { effort?: VisibleEffort; skill?: string } = {}): void {
    this.stopTimer();
    this.reset();
    this.effort = restored.effort;
    this.requested = restored.effort;
    this.skill = restored.skill;
    this.ui = ui;
    ui.setWidget(KEY, (tui: TUI, theme: Theme): Component & { dispose(): void } => {
      this.tui = tui;
      this.syncTimer();
      return {
        render: (width) => this.render(width, theme),
        invalidate() {},
        dispose: () => {
          if (this.tui === tui) {
            this.tui = undefined;
            this.stopTimer();
          }
        },
      };
    });
  }

  detach(): void {
    this.stopTimer();
    this.reset();
    this.ui?.setWidget(KEY, undefined);
    this.ui = undefined;
    this.tui = undefined;
  }

  choose(): number {
    this.choosing = true;
    this.changed();
    return ++this.token;
  }

  /** Each assessment owns only its cleanup, including across session replacement. */
  assessWorker(): () => void {
    const assessment = Symbol();
    this.workerAssessments.add(assessment);
    this.changed();
    return () => {
      if (this.workerAssessments.delete(assessment)) this.changed();
    };
  }

  /** Only a valid decision clears a warning; skipped and cancelled turns leave it. */
  settle(token: number, outcome: LiveOutcome): void {
    if (token !== this.token) return;
    this.choosing = false;
    this.skill = undefined;
    this.strategy = undefined;
    if (outcome.kind === "decided") {
      this.warning = undefined;
      this.effort = outcome.effort;
      this.requested = outcome.requested;
    } else if (outcome.kind === "fallback") {
      this.warning = { label: "fallback", effort: outcome.effort, reason: outcome.reason };
      this.effort = outcome.effort;
      this.requested = outcome.effort;
    } else if (outcome.kind === "error") {
      this.warning = { label: "error", reason: outcome.reason };
    }
    if (outcome.kind !== "error" && outcome.kind !== "cancelled") {
      this.skill = outcome.skill;
      this.strategy = outcome.strategy;
    }
    this.changed();
  }

  /** Invalidates an outstanding choice without recording an outcome. */
  stopChoosing(): void {
    this.token++;
    this.choosing = false;
    this.changed();
  }

  agentRunning(running: boolean): void {
    this.running = running;
    if (!running) {
      this.observedThinking = false;
      this.tools.clear();
    }
    this.changed();
  }

  thinking(observed: boolean): void {
    this.observedThinking = observed;
    this.changed();
  }

  toolStarted(toolCallId: string, toolName: string): void {
    this.tools.set(toolCallId, TOOL_ACTIVITY[toolName] ?? "working");
    this.changed();
  }

  toolFinished(toolCallId: string): void {
    this.tools.delete(toolCallId);
    this.changed();
  }

  setWorkers(count: number): void {
    this.workers = count;
    this.changed();
  }

  setWorkerRows(rows: readonly string[]): void {
    this.workerRows = rows;
    this.changed();
  }

  /** A user-selected level replaces a known effort; it never creates one. */
  setEffort(effort: VisibleEffort): void {
    if (this.effort) {
      this.effort = effort;
      this.requested = effort;
    }
    if (this.warning?.effort) this.warning = { ...this.warning, effort };
    this.changed();
  }

  private reset(): void {
    this.token++;
    this.choosing = false;
    this.workerAssessments.clear();
    this.running = false;
    this.observedThinking = false;
    this.tools.clear();
    this.workers = 0;
    this.workerRows = [];
    this.effort = undefined;
    this.requested = undefined;
    this.skill = undefined;
    this.strategy = undefined;
    this.warning = undefined;
  }

  private busy(): boolean {
    return this.choosing || this.workerAssessments.size > 0;
  }

  private changed(): void {
    this.syncTimer();
    this.tui?.requestRender();
  }

  private syncTimer(): void {
    if (this.busy() && this.tui && !this.timer) {
      this.timer = setInterval(() => this.tui?.requestRender(), this.frameMs);
      this.timer.unref?.();
    } else if (!this.busy()) this.stopTimer();
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  private activity(): string | undefined {
    if (this.choosing) return "choosing effort";
    if (this.workerAssessments.size) return "assessing worker";
    if (this.running)
      return [...this.tools.values()].at(-1) ?? (this.observedThinking ? "thinking" : "working");
    if (this.workers) return `${this.workers} ${this.workers === 1 ? "worker" : "workers"} running`;
  }

  private parts(options: { strategy: boolean; workers: boolean; skill?: string }): Part[] {
    const parts: Part[] = [{ text: "Jev", color: "accent" }];
    const activity = this.activity();
    if (activity) parts.push({ text: activity, color: "muted" });
    if (this.warning) {
      const color = this.warning.label === "error" ? "error" : "warning";
      parts.push({ text: this.warning.label, color });
      if (this.warning.effort) parts.push({ text: this.warning.effort, color: "accent" });
      parts.push({ text: this.warning.reason, color });
    } else if (this.effort)
      parts.push({
        text:
          this.requested && this.requested !== this.effort
            ? `${this.effort} (wanted ${this.requested})`
            : this.effort,
        color: "accent",
      });
    if (options.skill) parts.push({ text: options.skill, color: "muted" });
    if (options.strategy && this.strategy)
      parts.push({ text: `strategy ${this.strategy}`, color: "dim" });
    if (options.workers && (this.busy() || this.running) && this.workers)
      parts.push({
        text: `${this.workers} ${this.workers === 1 ? "worker" : "workers"}`,
        color: "dim",
      });
    if (parts.length === 1) parts.push({ text: "ready", color: "muted" });
    return parts;
  }

  private render(width: number, theme: Theme): string[] {
    const budget = Math.max(0, width - RIGHT_PADDING);
    const skill = this.skill ? `/${this.skill}` : undefined;
    const plainWidth = (parts: Part[]) =>
      GUTTER + visibleWidth(parts.map((part) => part.text).join(SEPARATOR));
    let parts: Part[] | undefined;
    for (const options of [
      { strategy: true, workers: true },
      { strategy: false, workers: true },
      { strategy: false, workers: false },
    ]) {
      const candidate = this.parts({ ...options, skill });
      if (plainWidth(candidate) <= budget) {
        parts = candidate;
        break;
      }
    }
    if (!parts && skill) {
      const without = this.parts({ strategy: false, workers: false });
      const room = budget - plainWidth(without) - visibleWidth(SEPARATOR);
      if (room >= 2)
        parts = this.parts({
          strategy: false,
          workers: false,
          skill: truncateToWidth(skill, room, "…"),
        });
    }
    parts ??= this.parts({ strategy: false, workers: false });
    const frame = this.busy()
      ? FRAMES[Math.floor(Date.now() / this.frameMs) % FRAMES.length]!
      : " ";
    const separator = theme.fg("dim", SEPARATOR);
    const styled = parts.map((part) => theme.fg(part.color, part.text)).join(separator);
    const line = truncateToWidth(`${theme.fg("accent", frame)} ${styled}`, budget, "…");
    const align = (text: string) => " ".repeat(Math.max(0, budget - visibleWidth(text))) + text;
    return [
      align(line),
      ...this.workerRows.map((row) => align(truncateToWidth(`  ${row}`, budget, "…"))),
    ];
  }
}

/** Only a bare skill name crosses into the live line, never paths or free text. */
export function safeSkillName(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(value)
    ? value
    : undefined;
}

/** Observation only: public events choose a label, silence is never read as thinking. */
export function observeActivity(pi: ExtensionAPI, live: LiveStatusLine): void {
  pi.on("agent_start", () => live.agentRunning(true));
  pi.on("agent_end", () => live.agentRunning(false));
  pi.on("agent_settled", () => live.agentRunning(false));
  pi.on("tool_execution_start", (event) => {
    if (!event.parentToolCallId) live.toolStarted(event.toolCallId, event.toolName);
  });
  pi.on("tool_execution_end", (event) => live.toolFinished(event.toolCallId));
  pi.on("message_update", (event) => {
    const type = event.assistantMessageEvent.type;
    if (type === "thinking_start" || type === "thinking_delta") live.thinking(true);
    else if (type === "thinking_end" || type === "text_start" || type === "toolcall_start")
      live.thinking(false);
  });
}

const RESTORABLE_OUTCOMES = ["classified", "reused", "kept", "timeout", "error"];

/** Durable same-branch evidence only: no busy state, warning or earlier turn's skill. */
export function restoreLiveState(branch: SessionEntry[]): {
  effort?: VisibleEffort;
  skill?: string;
} {
  let effort: VisibleEffort | undefined;
  let lastInputId: unknown;
  const skills = new Map<string, string>();
  for (const entry of branch) {
    if (entry.type === "message" && entry.message.role === "user")
      lastInputId = "jevPilotInputId" in entry.message ? entry.message.jevPilotInputId : undefined;
    if (entry.type !== "custom") continue;
    if (entry.customType === DECISION_TYPE) {
      const row = readDecisionRow(entry.data);
      if (row?.kind === "main" && RESTORABLE_OUTCOMES.includes(row.outcome))
        effort = row.effective === "unknown" ? undefined : row.effective;
    } else if (entry.customType === SKILL_ENTRY_TYPE) {
      const data = entry.data as { inputId?: unknown; skill?: { name?: unknown } } | undefined;
      const name = safeSkillName(data?.skill?.name);
      if (typeof data?.inputId === "string" && name) skills.set(data.inputId, name);
    }
  }
  const skill = typeof lastInputId === "string" ? skills.get(lastInputId) : undefined;
  return { ...(effort ? { effort } : {}), ...(skill ? { skill } : {}) };
}
