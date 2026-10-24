import { afterEach, expect, test } from "bun:test";
import { PiFixture, answer, type RecordData } from "./fixtures/pi-cli.ts";
const TYPE = "jev-pilot:decision:v1";
let fixture: PiFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});
async function entries(f: PiFixture) {
  const data = (await f.command("get_entries")).data as { entries: RecordData[] };
  return data.entries.filter((row) => row.customType === TYPE);
}
test("AC-2 STATUS-1 official command before task makes no classifier or provider request", async () => {
  const f = await (fixture = new PiFixture()).start();
  await f.command("prompt", { message: "/jev status" });
  expect(f.classifications).toHaveLength(0);
  expect(f.generations).toHaveLength(0);
  expect(
    f.records.some(
      (row) =>
        row.type === "extension_ui_request" && String(row.message).includes("No selection yet"),
    ),
  ).toBe(true);
  expect(await entries(f)).toHaveLength(0);
});
test("AC-4 SAFE-2 official session stores UI-only allowlisted rows outside model context", async () => {
  const f = await (fixture = new PiFixture()).start();
  await f.prompt("PRIVATE_TASK: review this patch carefully");
  const rows = await entries(f);
  expect(rows).toHaveLength(1);
  expect(rows[0]!.data).toMatchObject({
    version: 1,
    kind: "main",
    model: "fixture/fixture-model",
    previous: "medium",
    requested: "high",
    effective: "high",
    outcome: "classified",
  });
  expect(Object.keys(rows[0]!.data as object).sort()).toEqual(
    [
      "version",
      "kind",
      "model",
      "previous",
      "requested",
      "effective",
      "outcome",
      "elapsedMs",
    ].sort(),
  );
  expect(JSON.stringify(rows)).not.toContain("PRIVATE_TASK");
  expect(JSON.stringify(f.generations)).not.toContain(TYPE);
  expect(JSON.stringify(f.generations)).not.toContain("Jev main");
});
test("AC-5 RESTORE-3 official reload tree fork retain rows without duplicate startup appends", async () => {
  const f = await (fixture = new PiFixture()).start();
  await f.prompt("Review this patch with care for failure modes");
  const original = (await f.command("get_state")).data as { sessionFile: string };
  const before = await entries(f);
  expect(before).toHaveLength(1);
  await f.command("prompt", { message: "/fixture-reload" });
  expect(await entries(f)).toHaveLength(1);
  await f.command("new_session");
  expect(await entries(f)).toHaveLength(0);
  await f.command("switch_session", { sessionPath: original.sessionFile });
  expect(await entries(f)).toHaveLength(1);
  const data = (await f.command("get_entries")).data as { entries: RecordData[] };
  const user = data.entries.find(
    (row) => (row.message as RecordData | undefined)?.role === "user",
  )!;
  await f.command("prompt", { message: `/fixture-fork-at ${user.id}` });
  expect(await entries(f)).toHaveLength(1);
  await f.command("prompt", { message: `/fixture-tree ${before[0]!.id}` });
  expect(await entries(f)).toHaveLength(1);
  expect(f.classifications).toHaveLength(1);
}, 20000);
test("AC-6 MAIN-2 continuation row records reuse without another query", async () => {
  const f = await (fixture = new PiFixture()).start();
  f.response = answer("high");
  await f.prompt("Review this patch carefully");
  await f.prompt("continue");
  expect(f.classifications).toHaveLength(1);
  expect((await entries(f)).map((row) => (row.data as RecordData).outcome)).toEqual([
    "classified",
    "reused",
  ]);
});
test("AC-5 RESTORE-4 late main completion cannot append to replacement session", async () => {
  const f = await (fixture = new PiFixture()).start();
  f.classifierDelay = 1200;
  await f.command("prompt", { message: "Review carefully" });
  await f.wait(() => f.classifications.length === 1);
  await f.command("new_session");
  await Bun.sleep(1300);
  expect(await entries(f)).toHaveLength(0);
}, 10000);
for (const mode of ["error", "timeout"] as const) {
  test(`AC-6 MAIN-3 official classifier ${mode} persists safe outcome`, async () => {
    const f = await (fixture = new PiFixture()).start(
      mode === "timeout" ? { JEV_TIMEOUT_MS: "100" } : {},
    );
    if (mode === "error") {
      f.status = 503;
      f.response = "PRIVATE_PROVIDER_ERROR";
    } else f.classifierDelay = 700;
    await f.prompt("Review this patch carefully");
    const rows = await entries(f);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.data).toMatchObject({
      outcome: mode,
      previous: "medium",
      requested: "medium",
      effective: "medium",
    });
    expect(JSON.stringify(rows)).not.toContain("PRIVATE");
    expect(f.classifications).toHaveLength(1);
  });
}
test("AC-6 MAIN-4 official user abort persists cancelled once", async () => {
  const f = await (fixture = new PiFixture()).start();
  f.classifierDelay = 1000;
  await f.command("prompt", { message: "Review carefully" });
  await f.wait(() => f.classifications.length === 1);
  await f.command("abort");
  await f.wait(() => f.records.some((row) => row.type === "agent_settled"));
  expect((await entries(f)).map((row) => (row.data as RecordData).outcome)).toEqual(["cancelled"]);
});
