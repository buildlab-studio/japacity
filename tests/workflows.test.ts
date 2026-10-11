// The GitHub workflows: the check runs with no secrets,
// staging deploys on a push to main, production on a release tag or by hand, each only in this repository and
// through its own environment, and every action is pinned to a commit. Restated 11 Oct 2026 (the Cloudflare audit's
// finding 13): staging deploys only once the check has passed on that push, the commit it passed; both deploys run the
// wrangler apps/server pins; the admin list is a Worker secret (server.md R-SERVER-012), so no deploy passes it.
// each deploy migrates its database before
// the build and the Worker, with the migrator role's string, and deploys nothing when that fails.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { REPOSITORY_URL } from "../packages/content/src/legal/legal.repository";

const root = fileURLToPath(new URL("..", import.meta.url));
const folder = join(root, ".github", "workflows");
const read = (name: string): string => readFileSync(join(folder, name), "utf8");
const workflows = readdirSync(folder).filter((name) => name.endsWith(".yml"));

/** The repository's owner and name, as `github.repository` gives them. */
const REPOSITORY = new URL(REPOSITORY_URL).pathname.slice(1);
const GUARD = `github.repository == '${REPOSITORY}'`;

/** The wrangler version apps/server/package.json names, its range mark taken off. */
const SERVER_PACKAGE = JSON.parse(readFileSync(join(root, "apps", "server", "package.json"), "utf8")) as { devDependencies?: Record<string, string>; dependencies?: Record<string, string> };
const WRANGLER_VERSION = (SERVER_PACKAGE.devDependencies?.["wrangler"] ?? SERVER_PACKAGE.dependencies?.["wrangler"] ?? "").replace(/^[\^~]/, "");

/** The check workflow's name, which the staging deploy waits for. */
const CHECK_NAME = /^name: (\S+)$/m.exec(read("check.yml"))?.[1];

/** The `on:` block: the lines after `on:` up to the next line that starts at the margin. */
function triggers(text: string): string {
  const start = text.indexOf("\non:\n");
  const rest = text.slice(start + "\non:\n".length);
  const end = rest.search(/\n\S/);
  return rest.slice(0, end === -1 ? undefined : end);
}

describe("the workflows", () => {
  test("given every workflow, when its actions are read, then each is pinned to a full commit with its version beside it", () => {
    expect(workflows.sort()).toEqual(["check.yml", "deploy-production.yml", "deploy-staging.yml"]);
    for (const name of workflows) {
      const uses = read(name).split("\n").filter((line) => /^\s*(-\s+)?uses:/.test(line));
      expect(uses.length).toBeGreaterThan(0);
      for (const line of uses) expect({ name, line, pinned: /uses: [\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/.test(line) }).toEqual({ name, line, pinned: true });
    }
  });

  test("given every workflow, when its triggers are read, then none runs on pull_request_target, and the check reads no secret", () => {
    for (const name of workflows) expect({ name, target: /^\s*pull_request_target\s*:/m.test(read(name)) }).toEqual({ name, target: false });
    expect(read("check.yml")).not.toMatch(/secrets\.[A-Z]/);
    expect(triggers(read("check.yml"))).toContain("pull_request:");
  });

  // it ran on the push itself, beside the check; now it runs after the check, on its success.
  test("[R-SERVER-012] given the staging deploy, when it is read, then it runs only once the check has passed on a push to this repository's main, only in this repository, in the staging environment, one at a time, deploys the commit the check passed with --env staging, and passes no admin list", () => {
    const text = read("deploy-staging.yml");
    expect(CHECK_NAME).toBe("check");
    expect(triggers(text).trim()).toBe(`workflow_run:\n    workflows: [${CHECK_NAME ?? ""}]\n    types: [completed]\n    branches: [main]`);
    expect(text).not.toMatch(/^\s*(push|pull_request)\s*:/m);
    const guard = [GUARD, "github.event.workflow_run.conclusion == 'success'", "github.event.workflow_run.event == 'push'", "github.event.workflow_run.head_branch == 'main'", "github.event.workflow_run.head_repository.full_name == github.repository"];
    expect(text).toContain(`    if: ${guard.join(" && ")}\n`);
    expect(text).toMatch(/uses: actions\/checkout@[0-9a-f]{40} # v\d+\.\d+\.\d+\n\s+with:\n(\s+#.*\n)*\s+ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}\n\s+persist-credentials: false\n/);
    expect(text).toContain("    environment: staging\n");
    expect(text).toMatch(/concurrency:\n\s+group: deploy-staging\n\s+cancel-in-progress: false/);
    expect(text).toMatch(/\n\s+command: deploy --env staging\n/);
    expect(text).not.toContain("--var");
    expect(text).not.toMatch(/secrets\.ADMIN_ACCOUNTS/);
  });

  // the deploy passes no admin list; the Worker keeps its ADMIN_ACCOUNTS secret.
  test("[R-SERVER-012] given the production deploy, when it is read, then it runs on a v tag or by hand from main or a v tag, never on a branch push, only in this repository, in the production environment, deploys with no --env, and passes no admin list", () => {
    const text = read("deploy-production.yml");
    expect(triggers(text).trim()).toBe('push:\n    tags: ["v*"]\n  workflow_dispatch:');
    expect(text).toContain(`    if: ${GUARD} && (github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v'))\n`);
    expect(text).toContain("    environment: production\n");
    expect(text).toMatch(/concurrency:\n\s+group: deploy-production\n\s+cancel-in-progress: false/);
    expect(text).toMatch(/\n\s+command: deploy\n/);
    expect(text).not.toMatch(/command:.*--env/);
    expect(text).not.toContain("--var");
    expect(text).not.toMatch(/secrets\.ADMIN_ACCOUNTS/);
  });

  test("given either deploy, when its wrangler step is read, then it runs the wrangler version apps/server/package.json pins, written out in full", () => {
    expect(WRANGLER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    for (const name of ["deploy-staging.yml", "deploy-production.yml"]) {
      const text = read(name);
      expect({ name, pins: [...text.matchAll(/^\s+wranglerVersion: "([^"]+)"$/gm)].map((match) => match[1]) }).toEqual({ name, pins: [WRANGLER_VERSION] });
      expect({ name, uses: text.match(/uses: cloudflare\/wrangler-action@/g)?.length }).toEqual({ name, uses: 1 });
    }
  });

  test("given either deploy, when its secrets are missing, then the first step says so and every later step is skipped, so nothing deploys and nothing fails", () => {
    for (const name of ["deploy-staging.yml", "deploy-production.yml"]) {
      const text = read(name);
      const steps = text.slice(text.indexOf("    steps:\n")).split(/\n {6}- /).slice(1);
      expect(steps[0]).toContain("id: ready");
      expect(steps[0]).toContain('echo "set=false" >> "$GITHUB_OUTPUT"');
      expect(steps[0]).toContain("::notice::");
      for (const step of steps.slice(1)) expect({ name, step: step.split("\n")[0], gated: step.includes("if: steps.ready.outputs.set == 'true'") }).toEqual({ name, step: step.split("\n")[0], gated: true });
      // The quiet stop asks for the Cloudflare pair only, never the database's string (R-SERVER-044).
      expect(steps[0]).not.toContain("DATABASE_URL_UNPOOLED");
      // Only the Cloudflare pair and the migrator's string are secrets of the environment; the build's variables are
      // not, and the admin accounts are the Worker's own secret (R-SERVER-012 and R-SERVER-044).
      expect([...new Set(text.match(/secrets\.[A-Z_]+/g))].sort()).toEqual(["secrets.CLOUDFLARE_ACCOUNT_ID", "secrets.CLOUDFLARE_API_TOKEN", "secrets.DATABASE_URL_UNPOOLED"]);
      expect([...new Set(text.match(/vars\.[A-Z_]+/g))].sort()).toEqual(["vars.VITE_ANALYTICS_TOKEN", "vars.VITE_SERVER_URL", "vars.VITE_TURNSTILE_SITE_KEY"]);
    }
  });

  test("[R-SERVER-044] given either deploy, when its steps are read, then it installs, migrates with the migrator's string, builds the client and deploys the Worker in that order, and a missing string or a failed migration stops it loudly before anything is built or deployed", () => {
    for (const [name, environment] of [["deploy-staging.yml", "staging"], ["deploy-production.yml", "production"]] as const) {
      const text = read(name);
      const steps = text.slice(text.indexOf("    steps:\n")).split(/\n {6}- /).slice(1);
      const at = (find: (step: string) => boolean): number => steps.findIndex(find);
      const install = at((step) => step.includes("run: pnpm install --frozen-lockfile"));
      const migrate = at((step) => step.startsWith("name: Migrate the database\n"));
      const build = at((step) => step.startsWith("name: Build the client\n"));
      const deploy = at((step) => step.includes("uses: cloudflare/wrangler-action@"));
      expect({ name, order: [install, migrate, build, deploy].every((index, i, all) => index > (all[i - 1] ?? 0)) }).toEqual({ name, order: true });
      expect({ name, migrates: steps.filter((step) => step.includes("db:migrate")).length }).toEqual({ name, migrates: 1 });

      const step = steps[migrate] ?? "";
      expect(step).toContain("        if: steps.ready.outputs.set == 'true'\n");
      expect(step).toContain("        env:\n          DATABASE_URL_UNPOOLED: ${{ secrets.DATABASE_URL_UNPOOLED }}\n");
      expect(step).toContain('          if [ -z "$DATABASE_URL_UNPOOLED" ]; then\n');
      expect(step).toContain(`            echo "::error::The ${environment} environment has no DATABASE_URL_UNPOOLED secret`);
      expect(step).toMatch(/::error::[^\n]*\n\s+exit 1\n\s+fi\n\s+pnpm --filter @japacity\/db db:migrate\n/);
      // The string reaches the migration alone: not the build, not wrangler (comments aside).
      const code = (part: string) => part.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n");
      expect({ name, reading: steps.flatMap((other, index) => (index !== migrate && code(other).includes("DATABASE_URL_UNPOOLED") ? [index] : [])) }).toEqual({ name, reading: [] });
      // A step after a failed one runs only when its `if` holds no status function, so nothing here may name one or
      // carry on after an error: the build and the deploy run only once the migration has succeeded.
      expect(text).not.toMatch(/always\(\)|failure\(\)|cancelled\(\)|success\(\)|continue-on-error/);
    }
    // The package's script is drizzle-kit's migrate with the config that reads DATABASE_URL_UNPOOLED.
    const db = JSON.parse(readFileSync(join(root, "packages", "db", "package.json"), "utf8")) as { scripts: Record<string, string> };
    expect(db.scripts["db:migrate"]).toBe("drizzle-kit migrate --config drizzle.migrate.config.ts");
    expect(readFileSync(join(root, "packages", "db", "drizzle.migrate.config.ts"), "utf8")).toContain('dbCredentials: { url: process.env["DATABASE_URL_UNPOOLED"] ?? "" }');
  });

  test("given CODEOWNERS, when it is read, then the lint config, tests/, the scrub check, every Worker config, the workflows and the legal constants are the maintainer's", () => {
    const owners = readFileSync(join(root, ".github", "CODEOWNERS"), "utf8")
      .split("\n")
      .filter((line) => line.trim() !== "" && !line.startsWith("#"));
    expect(owners).toEqual([
      "/eslint.config.js @Alameen688",
      "/tests/ @Alameen688",
      "/tools/scrub-check.ts @Alameen688",
      "wrangler.jsonc @Alameen688",
      "/.github/ @Alameen688",
      "/packages/content/src/legal/ @Alameen688",
    ]);
  });
});
