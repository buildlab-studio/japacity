// The GitHub workflows: the check runs with no secrets,
// staging deploys on a push to main, production on a release tag or by hand, each only in this repository and
// through its own environment, and every action is pinned to a commit.
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

  test("given the staging deploy, when it is read, then it runs only on a push to main, only in this repository, in the staging environment, one at a time, and deploys with --env staging", () => {
    const text = read("deploy-staging.yml");
    expect(triggers(text).trim()).toBe("push:\n    branches: [main]");
    expect(text).toContain(`    if: ${GUARD}\n`);
    expect(text).toContain("    environment: staging\n");
    expect(text).toMatch(/concurrency:\n\s+group: deploy-staging\n\s+cancel-in-progress: false/);
    expect(text).toContain("command: deploy --env staging --var ADMIN_ACCOUNTS:${{ secrets.ADMIN_ACCOUNTS }}");
  });

  test("given the production deploy, when it is read, then it runs on a v tag or by hand from main or a v tag, never on a branch push, only in this repository, in the production environment, and deploys with no --env", () => {
    const text = read("deploy-production.yml");
    expect(triggers(text).trim()).toBe('push:\n    tags: ["v*"]\n  workflow_dispatch:');
    expect(text).toContain(`    if: ${GUARD} && (github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/tags/v'))\n`);
    expect(text).toContain("    environment: production\n");
    expect(text).toMatch(/concurrency:\n\s+group: deploy-production\n\s+cancel-in-progress: false/);
    expect(text).toContain("command: deploy --var ADMIN_ACCOUNTS:${{ secrets.ADMIN_ACCOUNTS }}");
    expect(text).not.toMatch(/command:.*--env/);
  });

  test("given either deploy, when its secrets are missing, then the first step says so and every later step is skipped, so nothing deploys and nothing fails", () => {
    for (const name of ["deploy-staging.yml", "deploy-production.yml"]) {
      const text = read(name);
      const steps = text.slice(text.indexOf("    steps:\n")).split(/\n {6}- /).slice(1);
      expect(steps[0]).toContain("id: ready");
      expect(steps[0]).toContain('echo "set=false" >> "$GITHUB_OUTPUT"');
      expect(steps[0]).toContain("::notice::");
      for (const step of steps.slice(1)) expect({ name, step: step.split("\n")[0], gated: step.includes("if: steps.ready.outputs.set == 'true'") }).toEqual({ name, step: step.split("\n")[0], gated: true });
      // Only the Cloudflare pair and the admin accounts are secrets; the build's variables are not.
      expect([...new Set(text.match(/secrets\.[A-Z_]+/g))].sort()).toEqual(["secrets.ADMIN_ACCOUNTS", "secrets.CLOUDFLARE_ACCOUNT_ID", "secrets.CLOUDFLARE_API_TOKEN"]);
      expect([...new Set(text.match(/vars\.[A-Z_]+/g))].sort()).toEqual(["vars.VITE_ANALYTICS_TOKEN", "vars.VITE_SERVER_URL", "vars.VITE_TURNSTILE_SITE_KEY"]);
    }
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
