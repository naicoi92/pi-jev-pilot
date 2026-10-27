import { expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

test("main native rejects non-executable cached binary before invoking launcher", async () => {
  const root = await mkdtemp(join(tmpdir(), "jev-native-cache-test-"));
  try {
    const platform = process.platform === "darwin" ? "darwin" : "linux";
    const variant =
      platform === "darwin" || process.arch === "arm64"
        ? "arm64"
        : /\bavx2\b/.test(readFileSync("/proc/cpuinfo", "utf8"))
          ? "x64"
          : "x64-baseline";
    const binary = join(root, `cache/1.0.4/pi-bolt-${platform}-${variant}/pi`);
    await mkdir(join(binary, ".."), { recursive: true });
    await writeFile(binary, "not executable");
    await chmod(binary, 0o644);
    const marker = join(root, "launcher-invoked");
    const launcher = join(root, "launcher.sh");
    await writeFile(launcher, `touch '${marker}'\necho '1.4.0 (Pi-Bolt 1.0.4, fake)'\nexit 1\n`);
    const child = Bun.spawn(
      [process.execPath, "test", "tests/main-config-native.test.ts", "-t", "MAIN-CFG-disabled"],
      {
        env: {
          ...process.env,
          JEV_NATIVE_EXECUTABLE: launcher,
          JEV_NATIVE_CACHE: join(root, "cache"),
          JEV_CONFIG_EVIDENCE_DIR: "",
        },
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(code).not.toBe(0);
    expect(stdout + stderr).toContain("refusing installation");
    expect(existsSync(marker)).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 20000);
