import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

// R-SERVER-017: the production client is built with the server's secrets in
// its environment, as a build machine that also deploys the server might have
// them, and the output is scanned for them and for any server-side module.
const root = fileURLToPath(new URL("..", import.meta.url));
const SENTINELS = {
  WORLD_SEED: "sentinel-world-seed-7c1f9e04b2d6a853",
  CHARACTER_SEED: "sentinel-character-seed-41d8a0e6f3b9c275",
  OVERLAY_VALUE: "sentinel-overlay-value-9e2b7d5a1c4f8063",
};
const SERVER_SIDE = ["apps/server/", "packages/store/", "packages/db/"];

let folder = "";
let files: string[] = [];

function walk(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path, found);
    else found.push(path);
  }
  return found;
}

beforeAll(() => {
  folder = mkdtempSync(join(tmpdir(), "japacity-bundle-"));
  const overlay = join(folder, "overlay.json");
  writeFileSync(overlay, JSON.stringify({ version: "sentinel-overlay", tuning: { lottery: { ticket: SENTINELS.OVERLAY_VALUE } } }));
  const out = join(folder, "dist");
  const built = spawnSync("pnpm", ["--filter", "@japacity/client", "exec", "vite", "build", "--outDir", out, "--emptyOutDir", "--sourcemap", "--logLevel", "error"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, ...SENTINELS, OVERLAY: readFileSync(overlay, "utf8"), OVERLAY_FILE: overlay },
  });
  if (built.status !== 0) throw new Error(`The client build failed: ${built.stderr}`);
  files = walk(out);
}, 60000);

afterAll(() => {
  if (folder !== "") rmSync(folder, { recursive: true, force: true });
});

describe("the client bundle", () => {
  test("[R-SERVER-017] given the server's secrets in the build's environment, when every file of the production build is read, then no world seed, character seed or overlay value appears", () => {
    expect(files.some((file) => file.endsWith(".js"))).toBe(true);
    for (const file of files) {
      const text = readFileSync(file, "latin1");
      for (const sentinel of Object.values(SENTINELS)) expect(text.includes(sentinel), `${sentinel} in ${file}`).toBe(false);
    }
  });

  test("[R-SERVER-017] given the build's source maps, when every source they name is read, then none is a module of apps/server, packages/store or packages/db, and the simulation is there", () => {
    const sources = files
      .filter((file) => file.endsWith(".map"))
      .flatMap((file) => (JSON.parse(readFileSync(file, "utf8")) as { sources: string[] }).sources.map((source) => relative(root, resolve(dirname(file), source)).split(sep).join("/")));
    expect(sources.some((source) => source.startsWith("packages/sim/"))).toBe(true);
    expect(sources.filter((source) => SERVER_SIDE.some((prefix) => source.startsWith(prefix)))).toEqual([]);
  });
});
