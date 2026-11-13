// The GitHub workflows: the check runs with no secrets, staging deploys on a push to main, production on a release tag
// or by hand, each only in this repository and through its own environment, and every action is pinned to a commit.
// Staging deploys only once the check has passed on that push, the commit it passed; both deploys run the wrangler
// apps/server pins; the admin list is a Worker secret (server:ledger-alarm-lists-suspects), so no deploy passes it. Each deploy
// migrates its database before the build and the Worker, with the migrator role's string, and deploys nothing when
// that fails (server:migration-before-deploy); snapshots every character from the live commit between the migration and
// the build (server:snapshot-before-deploy); and ends by checking the deployment answers as the commit it deployed.
// Production deploys only a commit on main that staging serves (server:production-and-staging). The browser suite runs
// in its own workflow, by hand or each night, with no secrets.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { REPOSITORY_URL } from "../packages/content/src/legal/legal.repository";
import { readJson, REPO_ROOT } from "../tools/repo";

const folder = join(REPO_ROOT, ".github", "workflows");
const read = (name: string): string => readFileSync(join(folder, name), "utf8");
const workflows = readdirSync(folder).filter((name) => name.endsWith(".yml"));

/** The repository's owner and name, as `github.repository` gives them. */
const REPOSITORY = new URL(REPOSITORY_URL).pathname.slice(1);
const GUARD = `github.repository == '${REPOSITORY}'`;

/** The wrangler version apps/server/package.json names, its range mark taken off. */
const SERVER_PACKAGE = readJson<{ devDependencies?: Record<string, string>; dependencies?: Record<string, string> }>(join(REPO_ROOT, "apps", "server", "package.json"));
const WRANGLER_VERSION = (SERVER_PACKAGE.devDependencies?.["wrangler"] ?? SERVER_PACKAGE.dependencies?.["wrangler"] ?? "").replace(/^[\^~]/, "");

/** The check workflow's name, which the staging deploy waits for. */
const CHECK_NAME = /^name: (\S+)$/m.exec(read("check.yml"))?.[1];

/** A deploy's steps, each the text from its `- ` to the next step's. */
function stepsOf(text: string): string[] {
  return text.slice(text.indexOf("    steps:\n")).split(/\n {6}- /).slice(1);
}

/** A step's lines with the comments taken off. */
const code = (part: string): string =>
  part
    .split("\n")
    .filter((line) => !/^\s*#/.test(line))
    .join("\n");

/** The one step whose name is given, or "" when there is none. */
const named = (steps: readonly string[], name: string): string => steps.find((step) => step.startsWith(`name: ${name}\n`)) ?? "";

/** The page's build meta as the deploys read it, from the stamp the build writes (apps/client/vite/build-stamp.plugin.ts). */
const META_GREP = `grep -o 'japacity-build" content="[^"]*"'`;

/** Staging's Access service token headers, sent only when both values are set. */
const ACCESS_HEADERS = [
  "          access=()\n",
  '          if [ -n "$CF_ACCESS_CLIENT_ID" ] && [ -n "$CF_ACCESS_CLIENT_SECRET" ]; then\n',
  '            access=(-H "CF-Access-Client-Id: $CF_ACCESS_CLIENT_ID" -H "CF-Access-Client-Secret: $CF_ACCESS_CLIENT_SECRET")\n',
  "          fi\n",
].join("");
const ACCESS_ENV = "          CF_ACCESS_CLIENT_ID: ${{ secrets.CF_ACCESS_CLIENT_ID }}\n          CF_ACCESS_CLIENT_SECRET: ${{ secrets.CF_ACCESS_CLIENT_SECRET }}\n";

/** The `on:` block: the lines after `on:` up to the next line that starts at the margin. */
function triggers(text: string): string {
  const start = text.indexOf("\non:\n");
  const rest = text.slice(start + "\non:\n".length);
  const end = rest.search(/\n\S/);
  return rest.slice(0, end === -1 ? undefined : end);
}

describe("the workflows", () => {
  test("given every workflow, when its actions are read, then each is pinned to a full commit with its version beside it", () => {
    expect(workflows.sort()).toEqual(["browser.yml", "check.yml", "deploy-production.yml", "deploy-staging.yml"]);
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

  test("[server:ledger-alarm-lists-suspects] given the staging deploy, when it is read, then it runs only once the check has passed on a push to this repository's main, only in this repository, in the staging environment, one at a time, deploys the commit the check passed with --env staging, and passes no admin list", () => {
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

  // The Worker keeps its ADMIN_ACCOUNTS secret, so the deploy passes no admin list.
  test("[server:ledger-alarm-lists-suspects] given the production deploy, when it is read, then it runs on a v tag or by hand from main or a v tag, never on a branch push, only in this repository, in the production environment, deploys with no --env, and passes no admin list", () => {
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
      const steps = stepsOf(text);
      expect(steps[0]).toContain("id: ready");
      expect(steps[0]).toContain('echo "set=false" >> "$GITHUB_OUTPUT"');
      expect(steps[0]).toContain("::notice::");
      for (const step of steps.slice(1)) expect({ name, step: step.split("\n")[0], gated: step.includes("if: steps.ready.outputs.set == 'true'") }).toEqual({ name, step: step.split("\n")[0], gated: true });
      // The quiet stop asks for the Cloudflare pair only, never the database's string (server:migration-before-deploy).
      expect(steps[0]).not.toContain("DATABASE_URL_UNPOOLED");
    }
  });

  // Only the Cloudflare pair, the migrator's string and staging's Access service token are secrets of an environment;
  // the build's variables are not, and the admin accounts are the Worker's own secret (server:ledger-alarm-lists-suspects
  // and server:migration-before-deploy). Production reads staging's page for its guard, so it holds the Access pair and
  // staging's address too.
  test("[server:production-and-staging] given either deploy, when its secrets and variables are read, then each reads the Cloudflare pair, the migrator's string and staging's Access pair, and production also reads staging's address", () => {
    const secrets = ["secrets.CF_ACCESS_CLIENT_ID", "secrets.CF_ACCESS_CLIENT_SECRET", "secrets.CLOUDFLARE_ACCOUNT_ID", "secrets.CLOUDFLARE_API_TOKEN", "secrets.DATABASE_URL_UNPOOLED"];
    const vars = ["vars.VITE_ANALYTICS_TOKEN", "vars.VITE_SERVER_URL", "vars.VITE_TURNSTILE_SITE_KEY"];
    for (const [name, expected] of [["deploy-staging.yml", vars], ["deploy-production.yml", [...vars, "vars.STAGING_URL"].sort()]] as const) {
      const text = read(name);
      expect({ name, secrets: [...new Set(text.match(/secrets\.[A-Z_]+/g))].sort() }).toEqual({ name, secrets });
      expect({ name, vars: [...new Set(text.match(/vars\.[A-Z_]+/g))].sort() }).toEqual({ name, vars: expected });
    }
    // Production itself is not behind Access: only the guard, which reads staging, sends the headers there.
    const production = stepsOf(read("deploy-production.yml"));
    expect(production.flatMap((step, index) => (code(step).includes("CF_ACCESS_CLIENT_ID") ? [index] : []))).toEqual([production.indexOf(named(production, "The commit is on main and is the one staging serves"))]);
  });

  test("[server:migration-before-deploy] [server:snapshot-before-deploy] given either deploy, when its steps are read, then it installs, migrates with the migrator's string, snapshots, builds the client, deploys the Worker and checks the deployment in that order, and a missing string or a failed migration stops it loudly before anything is built or deployed", () => {
    for (const [name, environment] of [["deploy-staging.yml", "staging"], ["deploy-production.yml", "production"]] as const) {
      const text = read(name);
      const steps = stepsOf(text);
      const at = (find: (step: string) => boolean): number => steps.findIndex(find);
      const install = at((step) => step.includes("run: pnpm install --frozen-lockfile"));
      const migrate = at((step) => step.startsWith("name: Migrate the database\n"));
      const snapshot = at((step) => step.startsWith("name: Snapshot every character from the live commit\n"));
      const build = at((step) => step.startsWith("name: Build the client\n"));
      const deploy = at((step) => step.includes("uses: cloudflare/wrangler-action@"));
      const check = at((step) => step.startsWith("name: Check the deployment\n"));
      expect({ name, order: [install, migrate, snapshot, build, deploy, check] }).toEqual({ name, order: [install, install + 1, install + 2, install + 3, install + 4, install + 5] });
      expect({ name, install: install > 0, last: check === steps.length - 1 }).toEqual({ name, install: true, last: true });
      expect({ name, migrates: steps.filter((step) => step.includes("db:migrate")).length }).toEqual({ name, migrates: 1 });

      const step = steps[migrate] ?? "";
      expect(step).toContain("        if: steps.ready.outputs.set == 'true'\n");
      expect(step).toContain("        env:\n          DATABASE_URL_UNPOOLED: ${{ secrets.DATABASE_URL_UNPOOLED }}\n");
      expect(step).toContain('          if [ -z "$DATABASE_URL_UNPOOLED" ]; then\n');
      expect(step).toContain(`            echo "::error::The ${environment} environment has no DATABASE_URL_UNPOOLED secret`);
      expect(step).toMatch(/::error::[^\n]*\n\s+exit 1\n\s+fi\n\s+pnpm --filter @japacity\/db db:migrate\n/);
      // The string reaches the migration and the snapshot alone: not the build, not wrangler (comments aside).
      expect({ name, reading: steps.flatMap((other, index) => (code(other).includes("DATABASE_URL_UNPOOLED") ? [index] : [])) }).toEqual({ name, reading: [migrate, snapshot] });
      // A step after a failed one runs only when its `if` holds no status function, so nothing here may name one or
      // carry on after an error: the build and the deploy run only once the migration has succeeded.
      expect(text).not.toMatch(/always\(\)|failure\(\)|cancelled\(\)|success\(\)|continue-on-error/);
    }
    // The package's script is drizzle-kit's migrate with the config that reads DATABASE_URL_UNPOOLED.
    const db = readJson<{ scripts: Record<string, string> }>(join(REPO_ROOT, "packages", "db", "package.json"));
    expect(db.scripts["db:migrate"]).toBe("drizzle-kit migrate --config drizzle.migrate.config.ts");
    expect(readFileSync(join(REPO_ROOT, "packages", "db", "drizzle.migrate.config.ts"), "utf8")).toContain('dbCredentials: { url: process.env["DATABASE_URL_UNPOOLED"] ?? "" }');
  });

  test("[server:snapshot-before-deploy] given either deploy, when its snapshot step is read, then it reads the live commit from the deployment's own page, staging's through the Access service token, checks out that commit in a worktree of the whole history, installs it with a frozen lockfile and runs pnpm snapshot:all on the migrator's string, stops when the live commit cannot be read, and skips with a notice when that commit has no snapshot tool", () => {
    for (const [name, environment] of [["deploy-staging.yml", "staging"], ["deploy-production.yml", "production"]] as const) {
      const text = read(name);
      const step = named(stepsOf(text), "Snapshot every character from the live commit");
      // The live commit is found in the checkout's history, so the checkout fetches all of it.
      expect({ name, history: /uses: actions\/checkout@[0-9a-f]{40} # v\d+\.\d+\.\d+\n\s+with:\n(\s+(#.*|[\w-]+: .+)\n)*\s+fetch-depth: 0\n/.test(text) }).toEqual({ name, history: true });
      expect(step).toContain("        if: steps.ready.outputs.set == 'true'\n");
      expect(step).toContain("          DATABASE_URL_UNPOOLED: ${{ secrets.DATABASE_URL_UNPOOLED }}\n          SITE: ${{ vars.VITE_SERVER_URL }}\n");
      // Staging sits behind Access, so only its page is asked for with the service token's headers.
      const staging = environment === "staging";
      expect({ name, env: step.includes(ACCESS_ENV), headers: step.includes(ACCESS_HEADERS), any: step.includes("CF_ACCESS") }).toEqual({ name, env: staging, headers: staging, any: staging });
      const headers = staging ? '"${access[@]}" ' : "";
      expect(step).toContain(`          meta="$(curl -sS ${headers}"$SITE/?snapshot=1" | ${META_GREP} || true)"\n`);
      expect(step).toContain(`            echo "::error::The commit ${environment} is running could not be read ($meta), so nothing is snapshotted or deployed."\n            exit 1\n`);
      expect(step).toContain('          if ! git show "$live:package.json" | grep -q \'"snapshot:all"\'; then\n            echo "::notice::');
      expect(step).toMatch(/::notice::[^\n]*\n\s+exit 0\n\s+fi\n/);
      expect(step).toContain('          git worktree add --detach "$RUNNER_TEMP/live" "$live"\n          cd "$RUNNER_TEMP/live"\n          pnpm install --frozen-lockfile\n          pnpm snapshot:all\n');
      // The tool ends non-zero when it skipped a character, and the step adds nothing that would hide that.
      expect(code(step)).not.toMatch(/snapshot:all[^\n]*\|\|/);
    }
    // The root script the step runs is the snapshot tool.
    const root = readJson<{ scripts: Record<string, string> }>(join(REPO_ROOT, "package.json"));
    expect(root.scripts["snapshot:all"]).toBe("tsx apps/server/src/ops/snapshot.main.ts");
  });

  test("[server:production-and-staging] given either deploy, when its last step is read, then it asks up to six times, five seconds apart, for the root's 200, /api/health's ok and the page's build meta equal to the commit deployed, staging's through the Access service token, and fails when they never all hold", () => {
    // The meta carries the commit as the build stamp writes it.
    expect(readFileSync(join(REPO_ROOT, "apps", "client", "vite", "build-stamp.plugin.ts"), "utf8")).toContain('run(["rev-parse", "--short=12", "HEAD"])');
    for (const [name, environment, title] of [["deploy-staging.yml", "staging", "Staging"], ["deploy-production.yml", "production", "Production"]] as const) {
      const steps = stepsOf(read(name));
      const step = named(steps, "Check the deployment");
      expect(steps.at(-1)).toBe(step);
      expect(step).toContain("        if: steps.ready.outputs.set == 'true'\n");
      expect(step).toContain("          SITE: ${{ vars.VITE_SERVER_URL }}\n");
      expect(step).toContain('          commit="$(git rev-parse --short=12 HEAD)"\n          for try in 1 2 3 4 5 6; do\n');
      const staging = environment === "staging";
      expect({ name, env: step.includes(ACCESS_ENV), headers: step.includes(ACCESS_HEADERS), any: step.includes("CF_ACCESS") }).toEqual({ name, env: staging, headers: staging, any: staging });
      const headers = staging ? '"${access[@]}" ' : "";
      expect(step).toContain(`            root="$(curl -sS -o "$RUNNER_TEMP/root.html" -w '%{http_code}' ${headers}"$SITE/?deploy=$try" || true)"\n`);
      expect(step).toContain(`            meta="$(${META_GREP} "$RUNNER_TEMP/root.html" 2>/dev/null || true)"\n`);
      expect(step).toContain(`            health="$(curl -sS ${headers}"$SITE/api/health?deploy=$try" || true)"\n`);
      expect(step).toContain(`            if [ "$root" = "200" ] && [ "$meta" = "japacity-build\\" content=\\"$commit\\"" ] && printf '%s' "$health" | grep -q '"ok":true'; then\n`);
      expect(step).toContain('            if [ "$try" != "6" ]; then sleep 5; fi\n          done\n');
      expect(step).toContain(`          echo "::error::${title} does not answer as $commit:`);
      expect(step).toMatch(/::error::[^\n]*\n\s+exit 1\n$/);
    }
  });

  test("[server:production-and-staging] given the production deploy, when its steps are read, then right after the checkout it stops unless the commit is on main and is the commit in staging's build meta, read through the Access service token, before anything is installed, migrated or deployed", () => {
    const text = read("deploy-production.yml");
    const steps = stepsOf(text);
    const checkout = steps.findIndex((step) => step.includes("uses: actions/checkout@"));
    const guard = steps.indexOf(named(steps, "The commit is on main and is the one staging serves"));
    expect({ checkout, guard }).toEqual({ checkout: 1, guard: 2 });
    const step = steps[guard] ?? "";
    expect(step).toContain("        if: steps.ready.outputs.set == 'true'\n");
    expect(step).toContain(`          STAGING: \${{ vars.STAGING_URL }}\n${ACCESS_ENV}`);
    expect(step).toContain('          commit="$(git rev-parse HEAD)"\n          if ! git merge-base --is-ancestor "$commit" origin/main; then\n            echo "::error::$commit is not on main, so nothing is deployed."\n            exit 1\n          fi\n');
    expect(step).toContain('          if [ -z "$STAGING" ]; then\n');
    expect(step).toContain(ACCESS_HEADERS);
    expect(step).toContain(`          meta="$(curl -sS "\${access[@]}" "$STAGING/?release=1" | ${META_GREP} || true)"\n`);
    expect(step).toContain('          if [ -z "$staged" ] || [ "$(git rev-parse --verify --quiet "$staged^{commit}" || true)" != "$commit" ]; then\n            echo "::error::Staging serves ($meta), not $commit, so nothing is deployed."\n            exit 1\n          fi\n');
    // origin/main is there to compare with only when the checkout fetched every branch.
    expect(steps[checkout]).toMatch(/\n\s+fetch-depth: 0\n/);
    // Nothing that installs, migrates or deploys comes before the guard.
    for (const step of steps.slice(0, guard)) expect(code(step)).not.toMatch(/pnpm|db:migrate|wrangler/);
  });

  test("given the browser workflow, when it is read, then it runs the whole browser suite in four shards, by hand or each night, reads the repository only and no secret, installs Chromium with its system libraries, and keeps the report of a failing shard", () => {
    const text = read("browser.yml");
    expect(triggers(text).trim()).toMatch(/^workflow_dispatch:\n {2}schedule:\n {4}- cron: "[\d*/, -]+"$/);
    expect(text).toContain("\npermissions:\n  contents: read\n\njobs:");
    expect(text).not.toMatch(/secrets\.|vars\.|environment:/);
    expect(text).not.toMatch(/^ +permissions:/m);
    expect(text).toContain("        shard: [1, 2, 3, 4]\n");
    expect(text).toContain("        run: pnpm test:browser --shard=${{ matrix.shard }}/4 --reporter=list,html\n");
    expect(text).toContain("      - run: pnpm exec playwright install --with-deps chromium\n");
    expect(text).toContain("          persist-credentials: false\n");
    const steps = stepsOf(text);
    const upload = steps.findIndex((step) => step.includes("uses: actions/upload-artifact@"));
    expect({ upload, last: steps.length - 1 }).toEqual({ upload: steps.length - 1, last: steps.length - 1 });
    expect(steps[upload]).toContain("        if: failure()\n");
    expect(steps[upload]).toContain("            apps/client/test-results/\n");
    // The suite is the root script that runs Playwright's default projects, never the real tests or the catalog.
    const root = readJson<{ scripts: Record<string, string> }>(join(REPO_ROOT, "package.json"));
    expect(root.scripts["test:browser"]).toBe("playwright test -c apps/client/playwright.config.ts");
  });

  test("given CODEOWNERS, when it is read, then the lint config, tests/, the scrub check, the checks' run guard, every Worker config, the workflows and the legal constants are the maintainer's", () => {
    const owners = readFileSync(join(REPO_ROOT, ".github", "CODEOWNERS"), "utf8")
      .split("\n")
      .filter((line) => line.trim() !== "" && !line.startsWith("#"));
    expect(owners).toEqual([
      "/eslint.config.js @Alameen688",
      "/tests/ @Alameen688",
      "/tools/check/scrub.ts @Alameen688",
      "/tools/repo.ts @Alameen688",
      "wrangler.jsonc @Alameen688",
      "wrangler.load.jsonc @Alameen688",
      "/.github/ @Alameen688",
      "/packages/content/src/legal/ @Alameen688",
    ]);
  });

  test("given the check workflow, when its triggers and the unit tests are read, then it runs in the merge queue too, and the unit tests run in three parts, on a pull request only those its change reaches, under one unit check", () => {
    const text = read("check.yml");
    expect(text).toMatch(/\non:\n {2}push:\n {4}branches: \[main\]\n {2}pull_request:\n {2}merge_group:\n {2}workflow_dispatch:\n/);
    // The quick checks no longer run the unit tests themselves.
    expect(text).not.toContain("      - run: pnpm test\n");
    expect(text).toContain("        part: [1, 2, 3]\n");
    expect(text).toContain('pnpm exec vitest run --changed "$(git merge-base "origin/${BASE}" HEAD)" --shard="${PART}/3" --passWithNoTests');
    expect(text).toContain('pnpm exec vitest run --shard="${PART}/3"');
    expect(text).toMatch(/\n {2}unit:\n {4}needs: unit-run\n {4}if: always\(\)\n/);
    expect(text).toContain('[ "$RAN" = "success" ]');
  });

  test("given the check workflow, when its simulated-play jobs are read, then they run everywhere but a pull request, each file on its own runner, and the play job, skipped on a pull request, fails unless the listing and every file passed", () => {
    const text = read("check.yml");
    expect(text).toMatch(/\n {2}play-files:\n {4}if: github\.event_name != 'pull_request'\n/);
    expect(text).toContain("pnpm exec vitest list --project=play --filesOnly --json=");
    expect(text).toMatch(/\n {2}play-run:\n {4}needs: play-files\n/);
    expect(text).toContain("        file: ${{ fromJSON(needs.play-files.outputs.files) }}\n");
    expect(text).toContain('        run: pnpm test:play "$FILE"\n');
    expect(text).toMatch(/\n {2}play:\n {4}needs: \[play-files, play-run\]\n {4}if: always\(\) && github\.event_name != 'pull_request'\n/);
    expect(text).toContain('[ "$LISTED" = "success" ] && [ "$PLAYED" = "success" ]');
  });

  test("given the test config, when its rerun triggers are read, then the dependencies, the workspace, the Node version, the TypeScript configs and the test config each run every test", () => {
    const config = readFileSync(join(REPO_ROOT, "vitest.config.ts"), "utf8");
    for (const pattern of ['"**/package.json"', '"**/{vitest,vite}.config.*"', '"**/pnpm-lock.yaml"', '"**/pnpm-workspace.yaml"', '"**/.node-version"', '"**/tsconfig*.json"']) {
      expect({ pattern, present: config.includes(pattern) }).toEqual({ pattern, present: true });
    }
  });

  test("given the scripts, when the unit tests and the full check are read, then pnpm test leaves simulated play out and pnpm check runs it right after", () => {
    const root = readJson<{ scripts: Record<string, string> }>(join(REPO_ROOT, "package.json"));
    expect(root.scripts["test"]).toBe("vitest run");
    expect(root.scripts["test:play"]).toBe("vitest run --project play");
    expect(readFileSync(join(REPO_ROOT, "tools", "check", "all.ts"), "utf8")).toContain('"test", "test:play", "check:rules"');
  });
});
