import { afterEach, describe, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, readdir, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkerEvidence, reapWorkerCli } from "./worker-evidence.ts";

/** One scenario owns these resources, including continuations after a hook timeout. */
export class JuniorCliLifecycle {
  cli?: { child: ChildProcess; closed: Promise<void> };
  server?: Pick<ReturnType<typeof Bun.serve>, "stop">;

  constructor(readonly evidence: WorkerEvidence) {}

  async finish(): Promise<void> {
    const { cli, server, evidence } = this;
    if (cli) await reapWorkerCli(cli.child, cli.closed);
    await server?.stop(true);
    const root = join(evidence.directory, "runtime/async-subagent-runs");
    const runs = await readdir(root).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    for (const name of runs) {
      if (name.startsWith(".")) continue;
      const files = await readdir(join(root, name));
      if (files.includes("status.json")) continue;
      // Only this exact reservation proves that no runner was started here.
      if (files.length !== 1 || files[0] !== "run-fanout-budget.json") {
        await evidence.save();
        throw new Error(
          `Unexpected admission reservation; retaining dependencies: ${root}/${name}`,
        );
      }
      const target = join(evidence.directory, "admission-reservations");
      await mkdir(target, { recursive: true });
      await rename(join(root, name), join(target, name));
    }
    await evidence.finish();
  }
}

export function juniorCliTest(
  name: string,
  run: (owner: JuniorCliLifecycle) => Promise<void>,
): void {
  describe(name, () => {
    let owner: JuniorCliLifecycle | undefined;
    afterEach(async () => {
      const current = owner;
      if (current) await current.finish();
    }, 60000); // Reap7s + terminal10s + measured save/prune up to22s, with I/O headroom.
    test(
      name,
      async () => {
        const directory = await mkdtemp(join(tmpdir(), "pi-jev-junior-bound-"));
        const current = new JuniorCliLifecycle(new WorkerEvidence(directory));
        owner = current;
        await run(current);
      },
      180000,
    );
  });
}
