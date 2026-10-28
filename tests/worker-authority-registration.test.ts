import { afterEach, expect, test } from "bun:test";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  getWorkerDecisionAuthoritySnapshot,
  invalidateWorkerDecisionAuthority,
  registerWorkerDecisionAuthority,
} from "pi-subagents/worker-decision-authority";
import { registerWorkerAuthorityLifecycle } from "../src/worker-authority-registration.ts";
import { captureEffortAssessment } from "../src/effort-assessment.ts";

const cleanup: (() => void)[] = [];
afterEach(() => {
  for (const dispose of cleanup.splice(0)) dispose();
});
function fixture(sessionId = `/fixture/${crypto.randomUUID()}.jsonl`) {
  const hooks = new Map<string, Function[]>();
  const pi = {
    on: (name: string, handler: Function) => hooks.set(name, [...(hooks.get(name) ?? []), handler]),
    getSettings: () => ({}),
  };
  const ctx = {
    sessionManager: { getSessionFile: () => sessionId, getSessionId: () => "not-file-uuid" },
  } as unknown as ExtensionContext;
  registerWorkerAuthorityLifecycle(pi as unknown as ExtensionAPI, captureEffortAssessment);
  const fire = (name: string) => {
    for (const handler of hooks.get(name) ?? []) handler({}, ctx);
  };
  cleanup.push(() => fire("session_shutdown"));
  return { sessionId, fire };
}

// AC-2: actual registrant lifecycle, public registry, no internal registry fixture.
test("owner registration uses file identity through repeated startup and shutdown", () => {
  const f = fixture();
  f.fire("session_start");
  const first = getWorkerDecisionAuthoritySnapshot(f.sessionId);
  expect(first.kind).toBe("active");
  expect(getWorkerDecisionAuthoritySnapshot("not-file-uuid")).toEqual({ kind: "never-owned" });
  f.fire("session_start");
  const next = getWorkerDecisionAuthoritySnapshot(f.sessionId);
  expect(next.kind).toBe("active");
  expect(next).not.toEqual(first);
  f.fire("session_shutdown");
  expect(getWorkerDecisionAuthoritySnapshot(f.sessionId)).toEqual({ kind: "missing" });
});

test("old extension shutdown cannot dispose replacement registration", () => {
  const old = fixture();
  old.fire("session_start");
  old.fire("session_shutdown");
  const replacement = fixture(old.sessionId);
  replacement.fire("session_start");
  const current = getWorkerDecisionAuthoritySnapshot(old.sessionId);
  old.fire("session_shutdown");
  expect(getWorkerDecisionAuthoritySnapshot(old.sessionId)).toEqual(current);
  expect(current.kind).toBe("active");
});

test("stale registrant disposer cannot remove externally replaced owner", () => {
  const f = fixture();
  f.fire("session_start");
  const prior = getWorkerDecisionAuthoritySnapshot(f.sessionId);
  if (prior.kind !== "active") throw new Error("Expected active owner");
  invalidateWorkerDecisionAuthority(f.sessionId, prior.generation);
  const replacement = registerWorkerDecisionAuthority({
    sessionId: f.sessionId,
    lifetimeDeadline: Number.MAX_SAFE_INTEGER,
    assessmentTimeoutMs: 5000,
    authority: {
      async decide() {
        return { kind: "reject", reason: "assessment-unavailable" };
      },
    },
  });
  cleanup.push(() => replacement.dispose());
  f.fire("session_shutdown");
  expect(getWorkerDecisionAuthoritySnapshot(f.sessionId)).toMatchObject({
    kind: "active",
    generation: replacement.generation,
  });
});

test("duplicate owner conflict cannot be silently overwritten", () => {
  const f = fixture();
  f.fire("session_start");
  const before = getWorkerDecisionAuthoritySnapshot(f.sessionId);
  const other = fixture(f.sessionId);
  expect(() => other.fire("session_start")).toThrow("owner-conflict");
  other.fire("session_shutdown");
  expect(getWorkerDecisionAuthoritySnapshot(f.sessionId)).toEqual(before);
});

for (const transition of [
  "session_before_switch",
  "session_before_fork",
  "session_before_tree",
  "session_before_compact",
])
  test(`cancelled ${transition} retains registered owner`, () => {
    const f = fixture();
    f.fire("session_start");
    const before = getWorkerDecisionAuthoritySnapshot(f.sessionId);
    f.fire(transition);
    expect(getWorkerDecisionAuthoritySnapshot(f.sessionId)).toEqual(before);
  });
