import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { REPO_ROOT } from "../repo";

const here = (file: string) => fileURLToPath(new URL(file, import.meta.url));
const read = (file: string) => readFileSync(here(file), "utf8");

/** Every package manifest of the workspace. */
function manifests(): string[] {
  const found = [join(REPO_ROOT, "package.json"), join(REPO_ROOT, "tools", "package.json")];
  for (const parent of ["apps", "packages"]) {
    for (const entry of readdirSync(join(REPO_ROOT, parent), { withFileTypes: true })) {
      if (entry.isDirectory()) found.push(join(REPO_ROOT, parent, entry.name, "package.json"));
    }
  }
  return found.filter((file) => {
    try {
      readFileSync(file);
      return true;
    } catch {
      return false;
    }
  });
}

describe("the load test's scripts", () => {
  test("[load:runs-against-local-stack] given the load Worker's config, when it is read, then it runs the server package's app on this machine with the server's limits and nothing deployable", () => {
    const worker = read("../../apps/server/wrangler.load.jsonc");
    expect(worker).toContain('"main": "src/load.worker.ts"');
    expect(worker).toContain('"workers_dev": false');
    for (const absent of ['"routes"', '"route"', "account_id", "hyperdrive", "triggers"]) expect(worker).not.toContain(absent);
    const server = read("../../apps/server/wrangler.jsonc");
    for (const limit of worker.match(/\{ "name": "[A-Z0-9_]+", "namespace_id": "\d+", "simple": \{ "limit": \d+, "period": \d+ \} \}/g) ?? []) expect(server).toContain(limit);
    expect(worker.match(/"simple"/g)).toHaveLength(5);
  });

  test("[load:arrival-rate-generator] given the repository, when every package manifest is read, then none depends on k6, and the scenario uses k6's constant-arrival-rate executor", () => {
    for (const file of manifests()) expect(readFileSync(file, "utf8")).not.toMatch(/"k6"|"xk6|"@types\/k6"/);
    const script = read("./commands.k6.js");
    expect(script).toContain('executor: "constant-arrival-rate"');
    expect(script).toContain('from "k6/http"');
  });

  test("[load:arrival-rate-generator] given k6 missing, when the run starts, then it says how to install it and stops", () => {
    const run = read("./run.ts");
    expect(run).toContain("brew install k6");
    expect(run).toMatch(/tool === "k6" && k6 === null\) \{[^}]*process\.exit\(1\)/s);
  });

  test("[load:connection-errors-counted-apart] given the run's entry, when it starts, then it raises the open file limit for its own shell before anything runs, and k6 keeps its connections alive", () => {
    const shell = read("./run.sh").split("\n");
    const limit = shell.findIndex((line) => line.startsWith("ulimit -n"));
    const runs = shell.findIndex((line) => line.startsWith("exec "));
    expect(limit).toBeGreaterThan(0);
    expect(limit).toBeLessThan(runs);
    const script = read("./commands.k6.js");
    expect(script).toContain("noConnectionReuse: false");
    expect(script).toContain("noVUConnectionReuse: false");
    expect(script).toContain('[shown("connection_errors")]');
  });

  test("[load:peak-reads-reported-only] [load:main-scenario-pass-thresholds] given the second scenario, when the script is read, then it adds heartbeats, view fetches and world fetches, and the gate's thresholds name only the measured commands", () => {
    const script = read("./commands.k6.js");
    for (const name of ['exec: "heartbeat"', '"/api/health"', '"/api/view"', '"/api/world"']) expect(script.includes(name) || script.includes(name.replace('exec: "heartbeat"', '"heartbeat"'))).toBe(true);
    const thresholds = script.slice(script.indexOf("thresholds: {"), script.indexOf("};", script.indexOf("thresholds: {")));
    expect(thresholds).toContain('[shown("command_ms")]: [`p(95)<=${String(PLAN.p95Ms)}`, `p(99)<=${String(PLAN.p99Ms)}`]');
    expect(thresholds).not.toContain("read_ms");
  });
});
