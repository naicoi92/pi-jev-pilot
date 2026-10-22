import { afterEach, expect, test } from "bun:test";
import { PiFixture } from "./fixtures/pi-cli.ts";

let fixture: PiFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  fixture = undefined;
});

test("FIXTURE-26a startup exit includes child diagnostics without waiting for deadline", async () => {
  fixture = new PiFixture([
    process.execPath,
    "-e",
    'console.error("fixture-startup-sentinel");process.exit(23)',
  ]);
  const started = Date.now();
  let failure: unknown;
  try {
    await fixture.start();
  } catch (error) {
    failure = error;
  }
  expect(String(failure)).toContain("exitCode=23");
  expect(String(failure)).toContain(`pid=${fixture.process.pid}`);
  expect(String(failure)).toContain("signal=null");
  expect(String(failure)).toContain("fixture-startup-sentinel");
  expect(String(failure)).not.toContain("Fixture deadline");
  expect(Date.now() - started).toBeLessThan(5000);
  expect(fixture.process.exitCode).toBe(23);
}, 16000);

test("FIXTURE-26a startup spawn error is captured with diagnostics", async () => {
  fixture = new PiFixture(["/pi-jev-intentionally-missing-executable"]);
  let failure: unknown;
  try {
    await fixture.start();
  } catch (error) {
    failure = error;
  }
  expect(String(failure)).toContain("ENOENT");
  expect(String(failure)).toContain("pid=undefined");
  expect(String(failure)).toContain("exitCode=");
  expect(String(failure)).toContain("stderr=");
}, 16000);

test("FIXTURE-26b close reaps an EOF and SIGTERM resistant child before deleting its directory", async () => {
  fixture = new PiFixture([
    process.execPath,
    "-e",
    `
    process.on("SIGTERM", () => {});
    process.stdin.on("data", () => console.log(JSON.stringify({ id: "command-1", success: true })));
    process.stdin.on("end", () => {});
    setInterval(() => {}, 1000);
  `,
  ]);
  await fixture.start();
  const child = fixture.process;
  const directory = fixture.directory;
  let closed = false;
  child.once("close", () => {
    closed = true;
  });
  const started = Date.now();
  await fixture.close();
  expect(closed).toBe(true);
  expect(child.signalCode).toBe("SIGKILL");
  expect(() => process.kill(child.pid!, 0)).toThrow();
  expect(await Bun.file(`${directory}/fixture-controls.ts`).exists()).toBe(false);
  expect(Date.now() - started).toBeLessThan(9000);
  await fixture.close();
}, 12000);
