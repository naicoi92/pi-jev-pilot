import { afterEach, expect, test } from "bun:test";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { registerCrewJunior } from "../src/crew-junior.ts";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
const saved = process.env.JEV_CREW_CONFIG;
afterEach(() => {
  if (saved === undefined) delete process.env.JEV_CREW_CONFIG;
  else process.env.JEV_CREW_CONFIG = saved;
});
async function fixture() {
  const cwd = await mkdtemp(join(tmpdir(), "jev-junior-owner-"));
  process.env.JEV_CREW_CONFIG = join(cwd, "crew.json");
  await writeFile(
    process.env.JEV_CREW_CONFIG,
    JSON.stringify({ mode: "junior-lead", slots: [{ name: "alpha", model: "local/cheap" }] }),
  );
  const hooks = new Map<string, Function[]>();
  const listeners = new Map<string, Function[]>();
  let requests = 0,
    disposals = 0;
  let fail = false,
    installed = true;
  const pi = {
    on(name: string, fn: Function) {
      hooks.set(name, [...(hooks.get(name) ?? []), fn]);
    },
    events: {
      on(name: string, fn: Function) {
        listeners.set(name, [...(listeners.get(name) ?? []), fn]);
      },
      emit(_name: string, request: { result?: unknown }) {
        requests++;
        if (installed)
          request.result = fail
            ? { ok: false, error: new Error("name collision") }
            : {
                ok: true,
                registration: {
                  dispose() {
                    disposals++;
                  },
                },
              };
      },
    },
  };
  registerCrewJunior(pi as unknown as ExtensionAPI);
  const fire = async (name: string, event: unknown = {}) => {
    let result;
    for (const fn of hooks.get(name) ?? []) result = await fn(event, { cwd } as ExtensionContext);
    return result;
  };
  return {
    fire,
    requests: () => requests,
    disposals: () => disposals,
    fail: () => {
      fail = true;
    },
    missing: () => {
      installed = false;
    },
  };
}
test("CREW-19 junior registration reuses ownership and disposes on lifecycle", async () => {
  const f = await fixture();
  await f.fire("session_start");
  await f.fire("tool_call", { toolName: "subagent", input: { agent: "jev-pilot:junior" } });
  expect(f.requests()).toBe(1);
  await f.fire("session_shutdown");
  await f.fire("session_shutdown");
  expect(f.disposals()).toBe(1);
  await f.fire("session_start");
  expect(f.requests()).toBe(2);
  await f.fire("session_shutdown");
  expect(f.disposals()).toBe(2);
});
test("CREW-13 unavailable executor or collision blocks junior not main startup", async () => {
  const f = await fixture();
  f.missing();
  await f.fire("session_start");
  expect(await f.fire("tool_call", { toolName: "read", input: {} })).toBeUndefined();
  expect(
    await f.fire("tool_call", { toolName: "subagent", input: { agent: "jev-pilot:junior" } }),
  ).toMatchObject({ block: true, reason: expect.stringContaining("not installed") });
  const g = await fixture();
  g.fail();
  await g.fire("session_start");
  expect(
    await g.fire("tool_call", { toolName: "subagent", input: { agent: "jev-pilot:junior" } }),
  ).toMatchObject({ block: true, reason: expect.stringContaining("collision") });
  expect(g.disposals()).toBe(0);
});
