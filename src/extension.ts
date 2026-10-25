import { dirname } from "node:path";
import { registerWorkerAdapter } from "./worker-adapter.ts";
import { registerCrewJunior } from "./crew-junior.ts";
import type { ExtensionAPI, ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";
import {
  clampThinkingLevel,
  getSupportedThinkingLevels,
  type ModelThinkingLevel,
} from "@earendil-works/pi-ai";
import { effortScore, isContinuation, selectEffort, type EffortDecision } from "./effort-policy.ts";
import { nativeSkillTask } from "./native-skill.ts";
import { EffortVisibility } from "./effort-visibility.ts";
import {
  LiveStatusLine,
  observeActivity,
  restoreLiveState,
  safeSkillName,
  type LiveOutcome,
} from "./live-status.ts";
import {
  appendDecisionRow,
  registerDecisionVisibility,
  safeIdentity,
  safeEffort,
  type VisibleOutcome,
} from "./decision-visibility.ts";
import { classify, systemOneConfig, effortEnabled, type Decision } from "./system-one.ts";
import { classifierState } from "./classifier-context.ts";
import { decideMain, skillBlock } from "./skill-matching.ts";
import { SKILL_ENTRY_TYPE as SKILL_TYPE, type SkillCandidate } from "./skill-policy.ts";
import { guidanceEnabled, observeLoop, QUALITY_BARS, stepBackNote } from "./guidance-policy.ts";
import { ledgerEnabled, recordCorrection, recordTurn } from "./ledger.ts";
import {
  completedEntry,
  lastUserTurnId,
  newDraft,
  ToolTally,
  type LedgerDraft,
} from "./ledger-turn.ts";

const ADVICE_TYPE = "jev-pilot:advice";

const STATE_TYPE = "jev-pilot:effort";
const APPLICATION_TYPE = "jev-pilot:effort-application";
const RESTORED_TYPE = "jev-pilot:effort-restored";

/** User-selected physical main model; session effort, skills and advice only. */
export default function (pi: ExtensionAPI): void {
  registerDecisionVisibility(pi);
  const executionChildren = new Set<string>();
  pi.events.on("jev-pilot:execution-child:v1", (value: unknown) => {
    if (
      value &&
      typeof value === "object" &&
      "sessionId" in value &&
      typeof value.sessionId === "string"
    )
      executionChildren.add(value.sessionId);
  });
  const live = new LiveStatusLine();
  observeActivity(pi, live);
  registerCrewJunior(pi);
  registerWorkerAdapter(pi, (count) => live.setWorkers(count));
  const edits = new Map<string, number>();
  const runs = new Map<string, number>();
  let loopNoted = false;
  const resetLoop = () => {
    edits.clear();
    runs.clear();
    loopNoted = false;
  };
  // Observed only for the ledger: top-level tool results of the running turn.
  const tally = new ToolTally();
  let ledgerDraft: LedgerDraft | undefined;
  pi.on("agent_start", () => tally.reset());
  pi.on("tool_result", (event, ctx) => {
    if (!event.parentToolCallId) tally.observe(event.isError);
    if (ctx.signal?.aborted || event.parentToolCallId || loopNoted || !guidanceEnabled("QUALITY"))
      return;
    const circle = observeLoop(event.toolName, event.input, event.isError, edits, runs);
    if (!circle) return;
    loopNoted = true;
    return {
      content: [...event.content, { type: "text" as const, text: stepBackNote(circle) }],
      structuredContent: event.structuredContent,
    };
  });
  const visibility = new EffortVisibility(live);
  let active: AbortController | undefined;
  let selectionRevision = 0;
  let ownThinking: { level: ModelThinkingLevel; previousLevel: ModelThinkingLevel } | undefined;
  let pending: PendingEffort[] = [];
  const inputIds = new WeakMap<object, string>();
  const invalidateSelection = () => {
    ownThinking = undefined;
    selectionRevision++;
    visibility.clear();
    active?.abort();
    active = undefined;
  };
  // Selection events invalidate only outstanding work, never future prompts.
  // Our completed write clears active first so its notification cannot cancel it.
  pi.on("model_select", invalidateSelection);
  pi.on("thinking_level_select", (event) => {
    if (ownThinking?.level === event.level && ownThinking.previousLevel === event.previousLevel) {
      ownThinking = undefined;
      return;
    }
    ownThinking = undefined;
    live.setEffort(safeEffort(event.level));
    invalidateSelection();
  });
  const dispose = () => {
    resetLoop();
    ledgerDraft = undefined;
    tally.reset();
    selectionRevision++;
    ownThinking = undefined;
    visibility.clear();
    active?.abort();
    active = undefined;
    pending = [];
  };
  const commitPending = (ctx: ExtensionContext) => {
    try {
      if (!effortEnabled() || !applicable(ctx)) {
        pending = [];
        return;
      }
    } catch {
      pending = [];
      return;
    }
    const branch = ctx.sessionManager.getBranch();
    for (const state of pending) {
      if (state.signal.aborted || state.sessionId !== ctx.sessionManager.getSessionId()) continue;
      const ownerEntryId = ownedApplications(branch).get(state.data.applicationId);
      if (ownerEntryId) pi.appendEntry(STATE_TYPE, { ...state.data, ownerEntryId });
    }
    pending = [];
  };
  const applicable = (ctx: ExtensionContext) =>
    !!ctx.model?.reasoning && getSupportedThinkingLevels(ctx.model).length > 1;
  const restoreThinking = (ctx: ExtensionContext, fromTree = false) => {
    // Inapplicable/disabled effort has no consumer and must not create diagnostics
    // or setter writes, including when retained history contains old decisions.
    try {
      if (!effortEnabled() || !applicable(ctx)) return;
    } catch {
      return; // Eligible input reports invalid feature configuration actionably.
    }
    const branch = ctx.sessionManager.getBranch();
    // Before the first eligible application, leave native startup thinking alone.
    if (
      !fromTree &&
      !branch.some((entry) => entry.type === "custom" && entry.customType === APPLICATION_TYPE)
    )
      return;
    const desired = ownedThinking(branch);
    if (!desired) return;
    // Enabled auto-effort owns its branch state; a re-applied startup value is not
    // a persistent lock. Record the restored baseline, never adopt another user.
    pi.appendEntry(RESTORED_TYPE, { thinkingLevel: desired });
    pi.setThinkingLevel(desired);
  };
  pi.on("session_shutdown", () => {
    dispose();
    live.detach();
  });
  pi.on("session_start", (_event, ctx) => {
    dispose();
    live.attach(ctx.ui, restoreLiveState(ctx.sessionManager.getBranch()));
    restoreThinking(ctx);
  });
  pi.on("session_tree", (_event, ctx) => {
    dispose();
    live.attach(ctx.ui, restoreLiveState(ctx.sessionManager.getBranch()));
    restoreThinking(ctx, true);
  });
  pi.on("agent_end", (event, ctx) => {
    resetLoop();
    pending = [];
    // The draft belongs to the session that started the turn; replacement drops it.
    const draft = ledgerDraft;
    ledgerDraft = undefined;
    if (!draft || draft.sessionId !== ctx.sessionManager.getSessionId()) return;
    const id = lastUserTurnId(draft.sessionId, ctx.sessionManager.getBranch());
    if (!id) return;
    try {
      recordTurn(completedEntry(draft, tally, event.messages, id, Date.now()));
    } catch (error) {
      ctx.ui.notify(
        `Jev Pilot could not record the decision ledger: ${error instanceof Error ? error.message : String(error)}`,
        "warning",
      );
    }
  });
  pi.on("context", (event, ctx) => {
    commitPending(ctx);
    if (ctx.signal?.aborted) return;
    const selections = new Map<string, SkillCandidate>();
    const adviceSelections = new Map<string, string>();
    const branch = ctx.sessionManager.getBranch();
    const owners = new Set(
      branch.flatMap((entry) =>
        entry.type === "message" &&
        entry.message.role === "user" &&
        "jevPilotInputId" in entry.message
          ? [entry.message.jevPilotInputId]
          : [],
      ),
    );
    for (const entry of branch) {
      if (entry.type === "custom" && entry.customType === ADVICE_TYPE) {
        const data = entry.data as { inputId: string; advice: string };
        if (owners.has(data.inputId)) adviceSelections.set(data.inputId, data.advice);
      }
      if (entry.type === "custom" && entry.customType === SKILL_TYPE) {
        const data = entry.data as { inputId: string; skill: SkillCandidate };
        if (owners.has(data.inputId)) selections.set(data.inputId, data.skill);
      }
    }
    const loaded = new Map<string, string>();
    return {
      messages: event.messages.map((message) => {
        if (message.role !== "user") return message;
        const text = userText(message.content);
        for (const skill of selections.values()) {
          // Match Pi 1.4.0's complete native expansion, not a name/body substring.
          const native = `<skill name="${skill.name}" location="${skill.filePath}">\nReferences are relative to ${dirname(skill.filePath)}.\n\n${skill.body}\n</skill>`;
          if (text === native || text.startsWith(`${native}\n\n`))
            loaded.set(skill.filePath, skill.body);
        }
        if (!("jevPilotInputId" in message)) return message;
        const skill = selections.get(message.jevPilotInputId as string);
        const advice = adviceSelections.get(message.jevPilotInputId as string);
        if (!skill && !advice) return message;
        const content =
          typeof message.content === "string"
            ? [{ type: "text" as const, text: message.content }]
            : message.content;
        const block = [
          skill ? skillBlock(skill, loaded.get(skill.filePath) === skill.body) : null,
          advice,
        ]
          .filter(Boolean)
          .join("\n\n");
        if (skill) loaded.set(skill.filePath, skill.body);
        return {
          ...message,
          content: [...content, { type: "text" as const, text: block }],
        };
      }),
    };
  });
  // Spike: same-role replacement is public; persistence of extension-owned user
  // metadata is observed on Pi 1.4.0, not a documented UserMessage field contract.
  pi.on("message_end", (event) => {
    const inputId = inputIds.get(event.message);
    if (event.message.role !== "user" || !inputId) return;
    inputIds.delete(event.message);
    return { message: { ...event.message, jevPilotInputId: inputId } };
  });

  // User message_start is awaited before request preparation, includes queued
  // input, and supplies the active cancellation signal unlike before_agent_start.
  pi.on("message_start", async (event, ctx) => {
    if (event.message.role !== "user" || executionChildren.has(ctx.sessionManager.getSessionId()))
      return;
    resetLoop();
    // Pi persisted the preceding queued user at message_end. Commit it before a
    // following continuation reads its predecessor, even in steering mode "all".
    commitPending(ctx);
    let prompt =
      typeof event.message.content === "string"
        ? event.message.content
        : event.message.content
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n");
    active?.abort();
    const uiOwner = visibility.start(ctx.ui);
    const uiSession = ctx.sessionManager.getSessionId();
    const uiRevision = selectionRevision;
    const started = Date.now();
    const uiModel = safeIdentity(ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined);
    const previousEffort = safeEffort(pi.getThinkingLevel());
    let requestedEffort = previousEffort;
    let effectiveEffort = previousEffort;
    let recorded = false;
    const finish = (owner: number, summary: string, settled: LiveOutcome) => {
      if (!visibility.finish(owner, summary, settled)) return;
      if (recorded || !prompt.trim() || /^\/\S/.test(prompt.trim())) return;
      if (uiSession !== ctx.sessionManager.getSessionId() || uiRevision !== selectionRevision)
        return;
      recorded = true;
      const outcome: VisibleOutcome = summary.includes("cancelled")
        ? "cancelled"
        : summary.includes("timeout")
          ? "timeout"
          : /error|invalid configuration|invalid-response/.test(summary)
            ? "error"
            : summary.includes("reused")
              ? "reused"
              : summary.includes("skipped")
                ? "skipped"
                : summary.includes("classified")
                  ? "classified"
                  : "kept";
      appendDecisionRow(pi, {
        version: 1,
        kind: "main",
        model: uiModel,
        previous: previousEffort,
        requested: requestedEffort,
        effective: effectiveEffort,
        outcome,
        elapsedMs: Date.now() - started,
      });
    };
    if (!prompt.trim() || /^\/\S/.test(prompt.trim())) {
      finish(uiOwner, `effort skipped: ${prompt.trim() ? "command" : "empty input"}`, {
        kind: "skipped",
      });
      return;
    }
    let withEffort: boolean;
    let recording: boolean;
    try {
      recording = ledgerEnabled();
      withEffort = effortEnabled() && applicable(ctx);
      if (withEffort && (!ctx.model || !ctx.modelRegistry.hasConfiguredAuth(ctx.model)))
        throw new Error(
          "Select a configured physical Pi model with authentication before submitting work.",
        );
    } catch (error) {
      finish(uiOwner, "effort skipped: invalid configuration", INVALID_CONFIGURATION);
      ctx.ui.notify(
        error instanceof Error ? error.message : "Invalid Jev Pilot configuration.",
        "error",
      );
      ctx.abort();
      return;
    }
    // The new user is not persisted yet: this is the preceding turn on this branch.
    const precedingTurn = recording
      ? lastUserTurnId(uiSession, ctx.sessionManager.getBranch())
      : undefined;
    const draft = recording ? newDraft(uiSession, started, previousEffort) : undefined;
    ledgerDraft = draft;
    const controller = new AbortController();
    active = controller;
    const initialRevision = selectionRevision;
    const initialModel = ctx.model;
    const initialThinking = pi.getThinkingLevel();
    const initialSession = ctx.sessionManager.getSessionId();
    const initialLeaf = ctx.sessionManager.getLeafId();
    const parentSignal = ctx.signal;
    const cancel = () => {
      controller.abort();
      finish(uiOwner, "effort cancelled", { kind: "cancelled" });
    };
    parentSignal?.addEventListener("abort", cancel, { once: true });
    if (parentSignal?.aborted) cancel();
    let selectedNative: string | undefined;
    try {
      const native = await nativeSkillTask(pi, prompt);
      if (controller.signal.aborted || initialRevision !== selectionRevision) return;
      if (native) {
        if (!native.verified || !native.task) {
          finish(
            uiOwner,
            `effort skipped: ${native.verified ? "empty skill task" : "unverified skill resource"}`,
            { kind: "skipped", skill: native.verified ? nativeSkill(prompt) : undefined },
          );
          return;
        }
        selectedNative = nativeSkill(prompt);
        prompt = native.task;
        if (!withEffort) {
          finish(uiOwner, `effort skipped: ${effortEnabled() ? "inapplicable" : "disabled"}`, {
            kind: "skipped",
            skill: selectedNative,
          });
          return;
        }
      }
      const buildState = () =>
        classifierState(
          ctx,
          prompt,
          pi.getAllTools().map((tool) => tool.name),
          pi,
        );
      const previous = previousDecision(ctx);
      const reused = withEffort && previous !== null && isContinuation(prompt);
      const classifyStarted = Date.now();
      const { result, skill, advice, strategy } = reused
        ? { result: { outcome: "classified" as const, decision: previous }, skill: undefined }
        : native
          ? {
              result: await classify(systemOneConfig(), await buildState(), controller.signal, {
                tier: false,
                effort: true,
              }),
            }
          : await decideMain(pi, prompt, buildState, controller.signal, withEffort, ctx.cwd);
      if (
        controller.signal.aborted ||
        initialRevision !== selectionRevision ||
        initialSession !== ctx.sessionManager.getSessionId() ||
        initialLeaf !== ctx.sessionManager.getLeafId() ||
        initialModel?.provider !== ctx.model?.provider ||
        initialModel?.id !== ctx.model?.id ||
        initialThinking !== pi.getThinkingLevel()
      ) {
        finish(uiOwner, "effort cancelled", { kind: "cancelled" });
        return;
      }
      active = undefined;
      const read: Decision | undefined =
        result?.adviceDecision ?? (result?.outcome === "classified" ? result.decision : undefined);
      if (draft) {
        draft.answered = !reused && result?.outcome === "classified";
        draft.ms = result && !reused ? Date.now() - classifyStarted : null;
        draft.strategy = read?.strategy ?? null;
        draft.strategyConfidence = read?.strategyConfidence ?? null;
        draft.advised = !!advice?.includes("<execution_strategy>");
      }
      // A correction marks the preceding completed turn by identity, never by time.
      if (!reused && precedingTurn && typeof read?.corrects === "number" && draft) {
        try {
          recordCorrection(precedingTurn, read.corrects >= QUALITY_BARS.corrects);
        } catch {
          // The ledger is observational; a failed write never blocks the turn.
        }
      }
      const skipReason = effortEnabled() ? "inapplicable" : "disabled";
      const shownSkill = selectedNative ?? safeSkillName(skill?.name);
      if (!result || (!skill && !advice && !withEffort)) {
        finish(
          uiOwner,
          `effort skipped: ${skipReason}${result ? ` · classification ${result.outcome}` : " · no decision questions"}`,
          { kind: "skipped", skill: shownSkill, strategy },
        );
        return;
      }
      const existing =
        "jevPilotInputId" in event.message ? event.message.jevPilotInputId : undefined;
      const inputId = typeof existing === "string" ? existing : crypto.randomUUID();
      if (skill || advice || withEffort) inputIds.set(event.message, inputId);
      if (skill) pi.appendEntry(SKILL_TYPE, { inputId, skill });
      if (advice) pi.appendEntry(ADVICE_TYPE, { inputId, advice });
      if (!withEffort) {
        finish(uiOwner, `effort skipped: ${skipReason} · classification ${result.outcome}`, {
          kind: "skipped",
          skill: shownSkill,
          strategy,
        });
        return;
      }
      const current = pi.getThinkingLevel();
      const decision = result.outcome === "classified" ? result.decision : null;
      const requested = decision ? (selectEffort(decision, current, prompt) ?? current) : current;
      const effective = clampThinkingLevel(ctx.model!, requested);
      requestedEffort = safeEffort(requested);
      effectiveEffort = safeEffort(effective);
      if (draft) {
        draft.effortLevel = decision ? effortScore(decision) : null;
        draft.effortConfidence = decision?.effortConfidence ?? null;
        draft.requested = requestedEffort;
        draft.started = effectiveEffort;
      }
      // setThinkingLevel appends before the owning user is persisted. Record its
      // baseline first so a branch excluding that user can discard this change.
      const state: DecisionState = {
        requested,
        effective,
        outcome: reused ? "reused" : result.outcome,
        decision: decision ?? previous,
      };
      pi.appendEntry(APPLICATION_TYPE, { baseline: current, inputId, ...state });
      const applicationId = ctx.sessionManager.getLeafId()!;
      if (effective !== current) ownThinking = { level: effective, previousLevel: current };
      pi.setThinkingLevel(requested);
      pending.push({
        sessionId: ctx.sessionManager.getSessionId(),
        signal: parentSignal ?? controller.signal,
        data: { applicationId, inputId, ...state },
      });
      finish(
        uiOwner,
        `${requested} → ${effective} · ${effective === current ? "kept" : "changed"} · ${reused ? "reused" : result.outcome}`,
        result.outcome === "classified"
          ? {
              kind: "decided",
              effort: effectiveEffort,
              requested: requestedEffort,
              skill: shownSkill,
              strategy,
            }
          : {
              kind: "fallback",
              effort: effectiveEffort,
              reason: FALLBACK_REASON[result.outcome],
              skill: shownSkill,
              strategy,
            },
      );
    } catch (error) {
      if (!controller.signal.aborted) {
        finish(uiOwner, "effort skipped: invalid configuration", INVALID_CONFIGURATION);
        ctx.ui.notify(
          error instanceof Error ? error.message : "Invalid Jev Pilot configuration.",
          "error",
        );
        ctx.abort();
      }
    } finally {
      finish(uiOwner, "effort cancelled", { kind: "cancelled" });
      parentSignal?.removeEventListener("abort", cancel);
      if (active === controller) active = undefined;
    }
  });
}

const INVALID_CONFIGURATION: LiveOutcome = { kind: "error", reason: "invalid configuration" };
const FALLBACK_REASON = {
  timeout: "timeout",
  "service-error": "service error",
  "schema-error": "invalid response",
} as const;

/** Header of a verified native skill message; only a bare name is displayable. */
function nativeSkill(text: string): string | undefined {
  return safeSkillName(/^<skill name="([^"]+)"/.exec(text)?.[1]);
}

function userText(content: string | { type: string; text?: string }[]): string {
  return typeof content === "string"
    ? content
    : content
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n");
}

interface EffortState extends DecisionState {
  applicationId: string;
  inputId: string;
  ownerEntryId?: string;
}
interface DecisionState {
  requested: ModelThinkingLevel;
  effective: ModelThinkingLevel;
  outcome: string;
  decision: EffortDecision | null;
}
interface PendingEffort {
  sessionId: string;
  signal: AbortSignal;
  data: EffortState;
}
interface EffortApplication extends DecisionState {
  baseline: ModelThinkingLevel;
  inputId: string;
}

function ownedApplications(branch: SessionEntry[]): Map<string, string> {
  const owned = new Map<string, string>();
  const applications = new Map<string, string>();
  for (const entry of branch) {
    if (entry.type === "custom" && entry.customType === APPLICATION_TYPE) {
      const data = entry.data;
      if (data && typeof data === "object" && "inputId" in data && typeof data.inputId === "string")
        applications.set(data.inputId, entry.id);
    }
    if (entry.type === "message" && entry.message.role === "user") {
      const message = entry.message;
      if (!("jevPilotInputId" in message) || typeof message.jevPilotInputId !== "string") continue;
      const applicationId = applications.get(message.jevPilotInputId);
      if (applicationId) {
        owned.set(applicationId, entry.id);
        applications.delete(message.jevPilotInputId);
      }
    }
  }
  return owned;
}

/** Replay manual changes and only applications whose owning user is on this branch. */
function ownedThinking(branch: SessionEntry[]): ModelThinkingLevel | undefined {
  const committed = ownedApplications(branch);
  let level: ModelThinkingLevel | undefined;
  let application: { id: string; data: EffortApplication } | undefined;
  for (const entry of branch) {
    if (entry.type === "custom" && entry.customType === APPLICATION_TYPE) {
      application = { id: entry.id, data: entry.data as EffortApplication };
      level ??= application.data.baseline;
      continue;
    }
    if (entry.type === "custom" && entry.customType === RESTORED_TYPE) {
      level = (entry.data as { thinkingLevel: ModelThinkingLevel }).thinkingLevel;
    }
    if (entry.type === "thinking_level_change") {
      const provisional =
        application &&
        application.data.baseline !== application.data.effective &&
        entry.thinkingLevel === application.data.effective;
      if (!provisional || committed.has(application!.id))
        level = entry.thinkingLevel as ModelThinkingLevel;
    }
    application = undefined;
  }
  return level;
}

function previousDecision(ctx: ExtensionContext): EffortDecision | null {
  const branch = ctx.sessionManager.getBranch();
  const owned = ownedApplications(branch);
  for (const entry of branch.reverse()) {
    if (entry.type !== "custom") continue;
    if (entry.customType !== STATE_TYPE && entry.customType !== APPLICATION_TYPE) continue;
    const data = entry.data as EffortState | undefined;
    // A newer unidentified application is a boundary, not permission to reuse an
    // older decision. Missing/dropped originating metadata must fail closed.
    if (entry.customType === APPLICATION_TYPE && !owned.has(entry.id)) return null;
    if (
      entry.customType === STATE_TYPE &&
      (!data || owned.get(data.applicationId) !== data.ownerEntryId || !data.ownerEntryId)
    )
      return null;
    return data?.decision ?? null;
  }
  return null;
}
