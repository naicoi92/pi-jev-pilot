import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JuniorCliLifecycle } from "./fixtures/junior-cli-lifecycle.ts";
import { WorkerEvidence } from "./fixtures/worker-evidence.ts";

async function owner(): Promise<JuniorCliLifecycle> {
  const directory = await mkdtemp(join(tmpdir(), "pi-jev-junior-lifecycle-"));
  return new JuniorCliLifecycle(new WorkerEvidence(directory));
}

function startCli(current: JuniorCliLifecycle): void {
  const child = spawn(Bun.which("node")!, ["-e", "process.stdin.resume()"]);
  const command = { command: ["node", "stdin-owner"], exitCode: -1, output: "" };
  current.evidence.commands.push(command);
  const closed = new Promise<void>((resolve) => {
    child.once("close", (code) => {
      command.exitCode = code ?? -1;
      resolve();
    });
  });
  current.cli = { child, closed };
}

test("AC-26 junior-cli-lifecycle delayed cleanup retains its exact owner", async () => {
  const first = await owner();
  const second = await owner();
  startCli(first);
  startCli(second);
  const gate = Promise.withResolvers<void>();
  const stopping = Promise.withResolvers<void>();
  const firstServer = Bun.serve({ port: 0, fetch: () => new Response("first") });
  const secondServer = Bun.serve({ port: 0, fetch: () => new Response("second") });
  first.server = {
    async stop() {
      stopping.resolve();
      await gate.promise;
      await firstServer.stop(true);
    },
  };
  second.server = secondServer;
  const cleanup = first.finish();
  try {
    await stopping.promise;
    expect(first.cli!.child.exitCode).toBe(0);
    expect(second.cli!.child.exitCode).toBeNull();
    expect(await (await fetch(secondServer.url)).text()).toBe("second");
    second.evidence.commands.push({ command: ["second-only"], exitCode: 0, output: "second" });
    expect(await Bun.file(join(first.evidence.destination, "cleanup.json")).exists()).toBe(false);
    gate.resolve();
    await cleanup;
    expect(second.cli!.child.exitCode).toBeNull();
    expect(await (await fetch(secondServer.url)).text()).toBe("second");
    expect(first.evidence.commands.map((entry) => entry.command[0])).toEqual(["node"]);
    expect(second.evidence.commands.map((entry) => entry.command[0])).toEqual([
      "node",
      "second-only",
    ]);
    expect(await Bun.file(join(first.evidence.destination, "cleanup.json")).exists()).toBe(true);
  } finally {
    gate.resolve();
    await cleanup;
    await second.finish();
  }
});

test("AC-26 junior-cli-lifecycle cleanup error preserves the failing owner's dependencies", async () => {
  const first = await owner();
  const second = await owner();
  const root = join(first.evidence.directory, "runtime/async-subagent-runs/unknown");
  await mkdir(root, { recursive: true });
  await mkdir(join(first.evidence.directory, "node_modules"));
  await writeFile(join(root, "run-fanout-budget.json"), "{}");
  await writeFile(join(root, "unexpected.json"), "{}");
  startCli(second);
  const server = Bun.serve({ port: 0, fetch: () => new Response("second") });
  second.server = server;
  try {
    await expect(first.finish()).rejects.toThrow(
      `Unexpected admission reservation; retaining dependencies: ${root}`,
    );
    expect(await Bun.file(join(first.evidence.destination, "commands.json")).exists()).toBe(true);
    expect(await Bun.file(join(first.evidence.destination, "cleanup.json")).exists()).toBe(false);
    expect(await Bun.file(join(root, "unexpected.json")).exists()).toBe(true);
    expect((await stat(join(first.evidence.directory, "node_modules"))).isDirectory()).toBe(true);
    expect(second.cli!.child.exitCode).toBeNull();
    expect(await (await fetch(server.url)).text()).toBe("second");
    second.evidence.commands.push({ command: ["still-owned"], exitCode: 0, output: "" });
    expect(second.evidence.commands.at(-1)!.command).toEqual(["still-owned"]);
  } finally {
    await second.finish();
  }
});

test("AC-26 junior-cli-lifecycle propagates strict evidence failure without pruning", async () => {
  const current = await owner();
  const run = join(current.evidence.directory, "runtime/async-subagent-runs/missing");
  await mkdir(run, { recursive: true });
  await mkdir(join(current.evidence.directory, "node_modules"));
  // Presence is not terminal proof: malformed status must still fail in WorkerEvidence.
  await writeFile(join(run, "status.json"), "not-json");
  await expect(current.finish()).rejects.toBeInstanceOf(SyntaxError);
  expect((await stat(join(current.evidence.directory, "node_modules"))).isDirectory()).toBe(true);
  expect(await Bun.file(join(current.evidence.destination, "cleanup.json")).exists()).toBe(false);
});

test("AC-26 junior-cli-lifecycle preserves only an exact admission reservation", async () => {
  const current = await owner();
  const reservation = join(current.evidence.directory, "runtime/async-subagent-runs/reserved");
  await mkdir(reservation, { recursive: true });
  await writeFile(join(reservation, "run-fanout-budget.json"), '{"reserved":true}');
  await current.finish();
  expect(
    await readFile(
      join(current.evidence.destination, "admission-reservations/reserved/run-fanout-budget.json"),
      "utf8",
    ),
  ).toBe('{"reserved":true}');
  expect(await Bun.file(join(current.evidence.destination, "cleanup.json")).exists()).toBe(true);
});
