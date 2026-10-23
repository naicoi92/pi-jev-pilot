import { afterEach, expect, test } from "bun:test";
import { readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { PiFixture, root } from "./fixtures/pi-cli.ts";

let fixture: PiFixture | undefined;
afterEach(async () => {
  await fixture?.close();
  if (fixture?.process) {
    console.log(
      "ownership CLI terminal",
      JSON.stringify({
        pid: fixture.process.pid,
        exitCode: fixture.process.exitCode,
        signal: fixture.process.signalCode,
      }),
    );
    expect(fixture.process.exitCode).toBe(0);
    expect(fixture.process.signalCode).toBeNull();
  }
  fixture = undefined;
});
for (const before of [false, true]) {
  for (const enabled of [true, false, null]) {
    test(`router-registration official Pi foreign ${before ? "before" : "after"} survives shutdown and reload ${enabled}`, async () => {
      const probe = `${root}/tests/fixtures/router-ownership.ts`;
      const extensions = before ? [probe, root] : [root, probe];
      fixture = new PiFixture([
        process.execPath,
        "run",
        `${root}/node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js`,
        ...extensions.flatMap((path) => ["-e", path]),
        "--mode",
        "rpc",
        "--no-mcp",
        "--no-skills",
        "--no-context-files",
        "--offline",
        "--no-approve",
        "--model",
        "fixture/fixture-model",
      ]);
      fixture.settings = { jevPilot: { mainRoutingEnabled: true } };
      // Fixture creates temp directory during start; log outside it, then remove on completion.
      const output = `${process.env.TMPDIR ?? "/tmp"}/jev-ownership-${crypto.randomUUID()}.jsonl`;
      try {
        const f = await fixture.start({
          JEV_OWNERSHIP_LOG: output,
          JEV_OWNERSHIP_BEFORE: String(before),
        });
        if (!before) {
          await f.command("prompt", { message: "/ownership-replace" });
          await f.command("get_state");
        }
        const path = `${f.directory}/agent/settings.json`;
        const settings = JSON.parse(await readFile(path, "utf8"));
        await writeFile(
          path,
          JSON.stringify({ ...settings, jevPilot: { mainRoutingEnabled: enabled } }),
        );
        await f.command("prompt", { message: "/ownership-reload" });
        await f.command("get_state");
        const models = JSON.stringify((await f.command("get_available_models")).data);
        expect(models).toContain("Foreign Auto");
        expect(models).toContain("Foreign Other");
        if (enabled === true) expect(JSON.stringify(f.records)).toContain("another extension owns");
        if (enabled === null)
          expect(JSON.stringify(f.records)).toContain("jevPilot.mainRoutingEnabled");
        // Re-enable once more: new extension instance must not overwrite foreign owner.
        await writeFile(
          path,
          JSON.stringify({ ...settings, jevPilot: { mainRoutingEnabled: true } }),
        );
        await f.command("prompt", { message: "/ownership-reload" });
        await f.command("get_state");
        expect(JSON.stringify((await f.command("get_available_models")).data)).toContain(
          "Foreign Auto",
        );
        await f.stop();
        const observations = (await readFile(output, "utf8"))
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line));
        expect(
          observations
            .filter((item) => item.phase === "start")
            .slice(1)
            .every((item) => item.name === "Foreign Auto"),
        ).toBe(true);
        if (!before)
          expect(observations.find((item) => item.phase === "refresh")).toMatchObject({
            foreignSame: true,
            otherSame: true,
            physicalSame: true,
          });
        if (!before)
          expect(observations.find((item) => item.phase === "shutdown")).toMatchObject({
            foreignSame: true,
            otherSame: true,
            physicalSame: true,
          });
        if (process.env.JEV_SETTINGS_EVIDENCE_DIR) {
          await mkdir(process.env.JEV_SETTINGS_EVIDENCE_DIR, { recursive: true });
          await writeFile(
            `${process.env.JEV_SETTINGS_EVIDENCE_DIR}/ownership-${before}-${enabled}.json`,
            JSON.stringify(
              {
                observations,
                records: f.records,
                stderr: f.stderr,
                terminal: {
                  pid: f.process.pid,
                  exitCode: f.process.exitCode,
                  signal: f.process.signalCode,
                },
              },
              null,
              2,
            ),
          );
        }
        expect(
          observations
            .filter((item) => item.phase === "shutdown")
            .every((item) => item.name === "Foreign Auto"),
        ).toBe(true);
      } finally {
        await rm(output, { force: true });
      }
    }, 30000);
  }
}
