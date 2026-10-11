// R-SERVER-012: the admin accounts come from the deployment's Worker secret
// ADMIN_ACCOUNTS, never from a committed file. a secret
// set with `wrangler secret put`, no longer a variable in wrangler.jsonc that each deploy filled with --var.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { testDeps } from "../app.test";
import { makeApp } from "../app";
import { adminAccountsFrom, deployedConfig, productionConfig } from "../config";
import type { ServerConfig } from "../config";
import { testSession } from "../deps";

const OWNER = "account.owner";
const as = (account: string): RequestInit => ({ headers: { "x-test-account": account } });

/** A deployment's config from its variable, with only the test sign-in switched on so a session can be named. */
function deployment(adminAccounts: string | undefined): ServerConfig {
  const config = deployedConfig(adminAccounts);
  return { ...config, testing: { ...config.testing, testLogin: true } };
}

interface Vars {
  vars: Record<string, string>;
  env?: Record<string, { vars: Record<string, string> }>;
}

function wrangler(): Vars {
  const text = readFileSync(fileURLToPath(new URL("../../wrangler.jsonc", import.meta.url).href), "utf8");
  return JSON.parse(text.replace(/^\s*\/\/.*$/gm, "")) as Vars;
}

describe("the admin accounts from the deployment", () => {
  test("[R-SERVER-012] given the variable unset, empty or only commas and spaces, when it is read, then there is no admin account", () => {
    for (const value of [undefined, "", " ", ",", " , ,"]) expect(adminAccountsFrom(value)).toEqual([]);
  });

  test("[R-SERVER-012] given comma-separated ids with spaces, empty pieces and a repeat, when the variable is read, then each id is kept once, trimmed, in order", () => {
    expect(adminAccountsFrom(" account.owner, ,account.second,account.owner ")).toEqual(["account.owner", "account.second"]);
    expect(adminAccountsFrom("account.owner")).toEqual(["account.owner"]);
  });

  test("[R-SERVER-012] given a deployment's variable, when its config is made, then only the admin list differs from production's, and with no variable it is production's own", () => {
    const config = deployedConfig(`${OWNER},account.second`);
    expect(config.admin.accounts).toEqual([OWNER, "account.second"]);
    expect({ ...config, admin: productionConfig.admin }).toEqual(productionConfig);
    expect(deployedConfig(undefined)).toEqual(productionConfig);
    expect(productionConfig.admin.accounts).toEqual([]);
  });

  test("[R-SERVER-012] [R-MODERATION-012] given ADMIN_ACCOUNTS naming the maintainer, when the admin page is asked, then it answers the maintainer and nobody else; with the variable empty it does not exist for the maintainer either", async () => {
    const named = deployment(` ${OWNER} `);
    const app = makeApp(testDeps({ config: named, session: testSession(named) }));
    expect((await app.request("/api/admin/alarms", as(OWNER))).status).toBe(200);
    expect((await app.request("/api/admin/alarms", as("account.player"))).status).toBe(404);

    const empty = deployment("");
    const closed = makeApp(testDeps({ config: empty, session: testSession(empty) }));
    expect((await closed.request("/api/admin/alarms", as(OWNER))).status).toBe(404);
  });

  // the admin list is a Worker secret. A variable and a secret of one name cannot stand on one
  // Worker, so neither environment's vars may name it, and a deploy (which keeps the secrets already set) leaves it be.
  test("[R-SERVER-012] given the committed wrangler.jsonc, when both environments are read, then neither names ADMIN_ACCOUNTS as a variable, so no account id is committed and the secret of that name stands alone", () => {
    const config = wrangler();
    expect(Object.keys(config.vars)).not.toContain("ADMIN_ACCOUNTS");
    expect(Object.keys(config.env?.["staging"]?.vars ?? {})).not.toContain("ADMIN_ACCOUNTS");
    expect(config.vars["SITE_URL"]).toMatch(/^https:\/\//);
    expect(config.env?.["staging"]?.vars["SITE_URL"]).toMatch(/^https:\/\//);
    const text = readFileSync(fileURLToPath(new URL("../../wrangler.jsonc", import.meta.url).href), "utf8");
    // Named only in the comment that lists the secrets set with `wrangler secret put`, never as a key or a --var.
    expect(text).not.toMatch(/"ADMIN_ACCOUNTS"\s*:/);
    expect(text).not.toContain("--var");
    expect(text).toMatch(/\/\/ Secrets, set by the maintainer with `wrangler secret put <NAME>`[^\n]*\n(\s*\/\/[^\n]*\n)*?\s*\/\/[^\n]*\bADMIN_ACCOUNTS\b/);
  });

  test("[R-SERVER-012] given the Worker, when its isolate is made, then its config is the deployment's, read from the ADMIN_ACCOUNTS binding, and config.ts names no account", () => {
    const worker = readFileSync(fileURLToPath(new URL("../index.ts", import.meta.url).href), "utf8");
    expect(worker).toContain("config: deployedConfig(env.ADMIN_ACCOUNTS)");
    expect(worker).toMatch(/ADMIN_ACCOUNTS\?: string;/);
    const config = readFileSync(fileURLToPath(new URL("../config.ts", import.meta.url).href), "utf8");
    expect(config).toContain("admin: { accounts: [] },");
  });
});
