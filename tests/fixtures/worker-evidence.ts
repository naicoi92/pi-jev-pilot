import { cp, mkdir, readdir, rm, statfs, writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import { tmpdir } from "node:os";

/** Only disposable dependency installs are pruned; source, sessions and receipts remain. */
export class WorkerEvidence {
  readonly commands: { command: string[]; exitCode: number; output: string }[] = [];
  readonly destination: string;
  private readonly disposable: string[];

  constructor(readonly directory: string) {
    this.destination = join(
      process.env.JEV_WORKER_EVIDENCE_DIR ?? join(tmpdir(), "pi-jev-worker-evidence"),
      basename(directory),
    );
    this.disposable = [
      "node_modules",
      "packed/package/node_modules",
      ".bun/install/cache",
      "pi-jev-pilot.tgz",
    ];
  }

  async checkCapacity(): Promise<void> {
    const space = await statfs(this.directory);
    const available = space.bavail * space.bsize;
    await writeFile(join(this.directory, "capacity.json"), JSON.stringify({ available }));
    if (available < 2 * 1024 * 1024 * 1024)
      throw new Error(`Worker fixture requires 2 GiB free before install; available=${available}`);
  }

  async save(): Promise<void> {
    await writeFile(join(this.directory, "commands.json"), JSON.stringify(this.commands, null, 2));
    await mkdir(this.destination, { recursive: true });
    await cp(this.directory, this.destination, {
      recursive: true,
      filter: (path) => {
        const name = relative(this.directory, path);
        return !this.disposable.some((item) => name === item || name.startsWith(`${item}/`));
      },
    });
  }

  async finish(): Promise<void> {
    // The caller must reap the CLI first. Detached children also need their own terminal proof.
    const asyncRoot = join(this.directory, "runtime/async-subagent-runs");
    const runs = await readdir(asyncRoot, { withFileTypes: true }).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return [];
        throw error;
      },
    );
    const deadline = Date.now() + 10000;
    for (const run of runs) {
      if (!run.isDirectory() || run.name.startsWith(".")) continue;
      const file = Bun.file(join(asyncRoot, run.name, "status.json"));
      if (!(await file.exists())) {
        await this.save();
        throw new Error(
          `Missing child terminal receipt; retaining dependencies: ${this.directory}`,
        );
      }
      while ((await file.json()).processTerminal?.state !== "observed") {
        if (Date.now() > deadline) {
          await this.save();
          throw new Error(`Child terminal not observed; retaining dependencies: ${this.directory}`);
        }
        await Bun.sleep(50);
      }
    }
    await this.save();
    for (const item of this.disposable)
      await rm(join(this.directory, item), { recursive: true, force: true });
    const space = await statfs(this.directory);
    await writeFile(
      join(this.destination, "cleanup.json"),
      JSON.stringify({ removed: this.disposable, available: space.bavail * space.bsize }, null, 2),
    );
  }
}

export async function reapWorkerCli(
  child: import("node:child_process").ChildProcess,
  closed: Promise<void>,
): Promise<void> {
  if (child.exitCode === null && child.signalCode === null) child.stdin?.end();
  const term = setTimeout(() => child.kill("SIGTERM"), 5000);
  const kill = setTimeout(() => child.kill("SIGKILL"), 7000);
  try {
    await closed;
  } finally {
    clearTimeout(term);
    clearTimeout(kill);
  }
}
