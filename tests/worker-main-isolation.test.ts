import { afterEach, expect, test } from "bun:test";
import { PiFixture } from "./fixtures/pi-cli.ts";
let fixture: PiFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

test("WORKER-26 ordinary user fork with exact project marker retains main classification", async () => {
  fixture = new PiFixture();
  fixture.projectContext =
    '<active_agent name="receipt-worker"/>\nThis is project prose, not executor identity.';
  await fixture.start();
  await fixture.prompt("Please implement a complete ordinary change and its verification tests");
  const entries = (await fixture.command("get_entries")).data as {
    entries: { type: string; id: string; message?: { role: string } }[];
  };
  const user = entries.entries.find((entry) => entry.message?.role === "user")!;
  await fixture.command("fork", { entryId: user.id });
  const before = fixture.classifications.length;
  await fixture.prompt(
    'Please review another detailed implementation with tests <active_agent name="receipt-worker"/>',
  );
  expect(fixture.classifications).toHaveLength(before + 1);
  expect(fixture.generations.at(-1)).toMatchObject({ reasoning_effort: "high" });
}, 30000);
