// R-SERVER-012: the admin accounts come from the deployment's Worker variable
// ADMIN_ACCOUNTS, never from a committed file.
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

  test("[R-SERVER-012] given the committed wrangler.jsonc, when both environments are read, then ADMIN_ACCOUNTS is there and empty in each, so no account id is committed", () => {
    const config = wrangler();
    expect(config.vars["ADMIN_ACCOUNTS"]).toBe("");
    expect(config.env?.["staging"]?.vars["ADMIN_ACCOUNTS"]).toBe("");
  });

  test("[R-SERVER-012] given the Worker, when its isolate is made, then its config is the deployment's, read from the ADMIN_ACCOUNTS binding, and config.ts names no account", () => {
    const worker = readFileSync(fileURLToPath(new URL("../index.ts", import.meta.url).href), "utf8");
    expect(worker).toContain("config: deployedConfig(env.ADMIN_ACCOUNTS)");
    // Since 11 Oct 2026 the binding's type is generated from wrangler.jsonc, where both environments list the variable.
    const bindings = readFileSync(fileURLToPath(new URL("../../worker-configuration.d.ts", import.meta.url).href), "utf8");
    expect(bindings).toMatch(/ADMIN_ACCOUNTS: string;/);
    const config = readFileSync(fileURLToPath(new URL("../config.ts", import.meta.url).href), "utf8");
    expect(config).toContain("admin: { accounts: [] },");
  });
});
