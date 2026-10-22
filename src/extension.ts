import type { ExtensionAPI, ExtensionContext, SessionEntry } from "@earendil-works/pi-coding-agent";
import {
  clampThinkingLevel,
  getSupportedThinkingLevels,
  type ModelThinkingLevel,
} from "@earendil-works/pi-ai";
import { isContinuation, selectEffort, type EffortDecision } from "./effort-policy.ts";
import {
  classify,
  effortEnabled,
  mainRoutingEnabled,
  systemOneConfig,
  type Decision,
} from "./system-one.ts";
import { TIER_ORDER, selectTier, type TierDecision, type Tiers } from "./tier-policy.ts";
import { classifierState } from "./classifier-context.ts";

const STATE_TYPE = "jev-pilot:effort";
const APPLICATION_TYPE = "jev-pilot:effort-application";
const RESTORED_TYPE = "jev-pilot:effort-restored";

/** Session-only routing: physical effort path or explicitly selected Jev virtual model. */
export default function (pi: ExtensionAPI): void {
  let active: AbortController | undefined;
  let selectionRevision = 0;
  let pending: PendingEffort[] = [];
  const inputIds = new WeakMap<object, string>();
  const invalidateSelection = () => {
    selectionRevision++;
    active?.abort();
    active = undefined;
  };
  // Selection events invalidate only outstanding work, never future prompts.
  // Our completed write clears active first so its notification cannot cancel it.
  pi.on("model_select", invalidateSelection);
  pi.on("thinking_level_select", invalidateSelection);
  if (mainRoutingEnabled()) {
    pi.registerVirtualModel<MainRouteState>({
      provider: "jev",
      id: "auto",
      name: "Jev Auto",
      thinkingLevels: ["off", "minimal", "low", "medium", "high", "xhigh", "max"],
      async route(request, ctx) {
        const tiers = configuredTiers();
        const models = TIER_ORDER.map((tier) => physicalModel(ctx, tiers[tier]));
        const sticky = request.failed ?? request.previous;
        // Native previous/failed is a physical response on this request branch.
        // A manual physical turn is newer than any saved Jev route state.
        // Pi omits previous when a successful response's identity has vanished
        // from the registry. Do not hide that invalid baseline behind saved state.
        const latest = !sticky
          ? request.messages.findLast(
              (message) =>
                message.role === "assistant" &&
                message.stopReason !== "error" &&
                message.stopReason !== "aborted",
            )
          : undefined;
        const identity = sticky
          ? `${sticky.model.provider}/${sticky.model.id}`
          : latest?.role === "assistant"
            ? `${latest.provider}/${latest.model}`
            : (request.state?.physical ?? tiers.balanced);
        const baselineModel = physicalModel(ctx, identity);
        const baselineThinking =
          request.reason === "user"
            ? request.thinkingLevel
            : (request.state?.effective ?? sticky?.thinkingLevel ?? request.thinkingLevel);
        if (request.reason !== "user") {
          const model = sticky
            ? physicalModel(ctx, `${sticky.model.provider}/${sticky.model.id}`)
            : baselineModel;
          return {
            model,
            thinkingLevel: clampThinkingLevel(model, sticky?.thinkingLevel ?? baselineThinking),
            state: request.state,
          };
        }
        const batch: string[] = [];
        for (let index = request.messages.length - 1; index >= 0; index--) {
          const message = request.messages[index]!;
          if (message.role !== "user") break;
          batch.unshift(
            typeof message.content === "string"
              ? message.content
              : message.content
                  .filter((part) => part.type === "text")
                  .map((part) => part.text)
                  .join("\n"),
          );
        }
        const prompt = batch.findLast((text) => !isContinuation(text)) ?? batch.at(-1) ?? "";
        if (!prompt.trim() || /^\/\S/.test(prompt.trim()))
          return {
            model: baselineModel,
            thinkingLevel: clampThinkingLevel(baselineModel, baselineThinking),
            state: request.state,
          };
        const withEffort =
          effortEnabled() &&
          models.some((model) => model.reasoning && getSupportedThinkingLevels(model).length > 1);
        const config = systemOneConfig();
        active?.abort();
        const controller = new AbortController();
        active = controller;
        const revision = selectionRevision;
        const session = ctx.sessionManager.getSessionId();
        const cancel = () => controller.abort();
        request.signal?.addEventListener("abort", cancel, { once: true });
        if (request.signal?.aborted) cancel();
        try {
          const previous = request.state?.decision ?? null;
          const reused = previous?.tier !== undefined && isContinuation(prompt);
          const result = reused
            ? { outcome: "classified" as const, decision: previous }
            : await classify(
                config,
                await classifierState(
                  ctx,
                  prompt,
                  pi.getAllTools().map((tool) => tool.name),
                ),
                controller.signal,
                { tier: true, effort: withEffort },
              );
          if (request.signal?.aborted) throw new Error("Jev routing cancelled.");
          if (
            controller.signal.aborted ||
            revision !== selectionRevision ||
            session !== ctx.sessionManager.getSessionId()
          ) {
            throw new Error("Jev routing invalidated by a selection or session change.");
          }
          const decision = result.outcome === "classified" ? result.decision : null;
          const physical = decision?.tier
            ? (selectTier(decision as TierDecision, identity, tiers) ?? identity)
            : identity;
          const model = physicalModel(ctx, physical);
          const requested =
            withEffort &&
            model.reasoning &&
            getSupportedThinkingLevels(model).length > 1 &&
            decision
              ? (selectEffort(decision, baselineThinking, prompt) ?? baselineThinking)
              : baselineThinking;
          const effective = clampThinkingLevel(model, requested);
          const state: MainRouteState = {
            physical,
            requested,
            effective,
            outcome: reused ? "reused" : result.outcome,
            source: decision ? "decision" : request.state || sticky ? "retained" : "default",
            decision: decision ?? previous,
          };
          ctx.ui.setStatus(
            "jev-pilot",
            `jev/auto → ${physical} · ${requested} → ${effective} · ${state.source}/${state.outcome}`,
          );
          return { model, thinkingLevel: effective, state };
        } finally {
          request.signal?.removeEventListener("abort", cancel);
          if (active === controller) active = undefined;
        }
      },
    });
  }
  const dispose = () => {
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
    !isJevModel(ctx) && !!ctx.model?.reasoning && getSupportedThinkingLevels(ctx.model).length > 1;
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
  pi.on("session_shutdown", dispose);
  pi.on("session_start", (_event, ctx) => {
    dispose();
    restoreThinking(ctx);
  });
  pi.on("session_tree", (_event, ctx) => {
    dispose();
    restoreThinking(ctx, true);
  });
  pi.on("agent_end", () => {
    pending = [];
  });
  pi.on("context", (_event, ctx) => {
    commitPending(ctx);
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
    if (event.message.role !== "user" || isJevModel(ctx)) return;
    // Pi persisted the preceding queued user at message_end. Commit it before a
    // following continuation reads its predecessor, even in steering mode "all".
    commitPending(ctx);
    const prompt =
      typeof event.message.content === "string"
        ? event.message.content
        : event.message.content
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n");
    if (!prompt.trim() || /^\/\S/.test(prompt.trim())) return;
    let config;
    try {
      if (!effortEnabled() || (ctx.model && !applicable(ctx))) return;
      config = systemOneConfig();
      if (!ctx.model || !ctx.modelRegistry.hasConfiguredAuth(ctx.model))
        throw new Error(
          "Select a configured physical Pi model with authentication before submitting work.",
        );
    } catch (error) {
      ctx.ui.notify(
        error instanceof Error ? error.message : "Invalid Jev Pilot configuration.",
        "error",
      );
      ctx.abort();
      return;
    }
    active?.abort();
    const controller = new AbortController();
    active = controller;
    const initialRevision = selectionRevision;
    const initialModel = ctx.model;
    const initialThinking = pi.getThinkingLevel();
    const initialSession = ctx.sessionManager.getSessionId();
    const parentSignal = ctx.signal;
    const cancel = () => controller.abort();
    parentSignal?.addEventListener("abort", cancel, { once: true });
    if (parentSignal?.aborted) cancel();
    try {
      const previous = previousDecision(ctx);
      const reused = previous !== null && isContinuation(prompt);
      const result = reused
        ? { outcome: "classified" as const, decision: previous }
        : await classify(
            config,
            await classifierState(
              ctx,
              prompt,
              pi.getAllTools().map((tool) => tool.name),
            ),
            controller.signal,
          );
      if (
        controller.signal.aborted ||
        initialRevision !== selectionRevision ||
        initialSession !== ctx.sessionManager.getSessionId() ||
        initialModel?.provider !== ctx.model?.provider ||
        initialModel?.id !== ctx.model?.id ||
        initialThinking !== pi.getThinkingLevel()
      )
        return;
      active = undefined;
      const current = pi.getThinkingLevel();
      const decision = result.outcome === "classified" ? result.decision : null;
      const requested = decision ? (selectEffort(decision, current, prompt) ?? current) : current;
      const effective = clampThinkingLevel(ctx.model!, requested);
      // setThinkingLevel appends before the owning user is persisted. Record its
      // baseline first so a branch excluding that user can discard this change.
      const state: DecisionState = {
        requested,
        effective,
        outcome: reused ? "reused" : result.outcome,
        decision: decision ?? previous,
      };
      const inputId = crypto.randomUUID();
      inputIds.set(event.message, inputId);
      pi.appendEntry(APPLICATION_TYPE, { baseline: current, inputId, ...state });
      const applicationId = ctx.sessionManager.getLeafId()!;
      pi.setThinkingLevel(requested);
      pending.push({
        sessionId: ctx.sessionManager.getSessionId(),
        signal: parentSignal ?? controller.signal,
        data: { applicationId, inputId, ...state },
      });
      ctx.ui.setStatus(
        "jev-pilot",
        `jev · ${requested} → ${effective} · ${reused ? "reused" : result.outcome}`,
      );
    } catch {
      if (!controller.signal.aborted)
        ctx.ui.notify(
          "Jev Pilot could not classify this input; current effort is unchanged.",
          "warning",
        );
    } finally {
      parentSignal?.removeEventListener("abort", cancel);
      if (active === controller) active = undefined;
    }
  });
}

interface MainRouteState {
  physical: string;
  requested: ModelThinkingLevel;
  effective: ModelThinkingLevel;
  outcome: string;
  source: "decision" | "retained" | "default";
  decision: Decision | null;
}
function isJevModel(ctx: ExtensionContext): boolean {
  return ctx.model?.provider === "jev" && ctx.model.id === "auto" && ctx.model.api === "pi-virtual";
}
function configuredTiers(): Tiers {
  return Object.fromEntries(
    TIER_ORDER.map((tier) => {
      const key = `JEV_TIER_${tier.toUpperCase()}`;
      const value = process.env[key] ?? "";
      if (!/^[^/\s]+\/\S+$/.test(value))
        throw new Error(`Set ${key} to a qualified physical provider/model identity.`);
      return [tier, value];
    }),
  ) as Tiers;
}
function physicalModel(ctx: ExtensionContext, identity: string) {
  const slash = identity.indexOf("/");
  const model = ctx.modelRegistry.find(identity.slice(0, slash), identity.slice(slash + 1));
  if (!model || model.api === "pi-virtual")
    throw new Error(
      `Jev target ${identity} must resolve to an exact physical Pi model. Check JEV_TIER_FAST/BALANCED/DEEP and the model registry.`,
    );
  if (!ctx.modelRegistry.hasConfiguredAuth(model))
    throw new Error(
      `Configure Pi authentication for Jev target ${identity}; no replacement model will be selected.`,
    );
  return model;
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
