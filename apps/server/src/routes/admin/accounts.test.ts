// server:ledger-alarm-lists-suspects: the admin accounts come from the deployment's Worker secret ADMIN_ACCOUNTS, never from a committed
// file: a secret set with `wrangler secret put`, never a variable in wrangler.jsonc
// filled by a deploy's --var, which the dashboard shows as plain text.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

import { asAccount, testDeps } from "../../app.testing";
import { makeApp } from "../../app";
import { adminAccountsFrom, deployedConfig, productionConfig } from "../../config";
import type { ServerConfig } from "../../config";
import { testSession } from "../../deps";

const OWNER = "account.owner";

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
  const text = readFileSync(fileURLToPath(new URL("../../../wrangler.jsonc", import.meta.url).href), "utf8");
  return JSON.parse(text.replace(/^\s*\/\/.*$/gm, "")) as Vars;
}

describe("the admin accounts from the deployment", () => {
  test("[server:ledger-alarm-lists-suspects] given the variable unset, empty or only commas and spaces, when it is read, then there is no admin account", () => {
    for (const value of [undefined, "", " ", ",", " , ,"]) expect(adminAccountsFrom(value)).toEqual([]);
  });

  test("[server:ledger-alarm-lists-suspects] given comma-separated ids with spaces, empty pieces and a repeat, when the variable is read, then each id is kept once, trimmed, in order", () => {
    expect(adminAccountsFrom(" account.owner, ,account.second,account.owner ")).toEqual(["account.owner", "account.second"]);
    expect(adminAccountsFrom("account.owner")).toEqual(["account.owner"]);
  });

  test("[server:ledger-alarm-lists-suspects] given a deployment's variable, when its config is made, then only the admin list differs from production's, and with no variable it is production's own", () => {
    const config = deployedConfig(`${OWNER},account.second`);
    expect(config.admin.accounts).toEqual([OWNER, "account.second"]);
    expect({ ...config, admin: productionConfig.admin }).toEqual(productionConfig);
    expect(deployedConfig(undefined)).toEqual(productionConfig);
    expect(productionConfig.admin.accounts).toEqual([]);
  });

  test("[server:ledger-alarm-lists-suspects] [moderation:admin-view-for-admin-list] given ADMIN_ACCOUNTS naming one account, when the admin page is asked, then it answers that account and nobody else; with the variable empty it does not exist for that account either", async () => {
    const named = deployment(` ${OWNER} `);
    const app = makeApp(testDeps({ config: named, session: testSession(named) }));
    expect((await app.request("/api/admin/alarms", asAccount(OWNER))).status).toBe(200);
    expect((await app.request("/api/admin/alarms", asAccount("account.player"))).status).toBe(404);

    const empty = deployment("");
    const closed = makeApp(testDeps({ config: empty, session: testSession(empty) }));
    expect((await closed.request("/api/admin/alarms", asAccount(OWNER))).status).toBe(404);
  });

  // The admin list is a Worker secret. A variable and a secret of one name cannot stand on one
  // Worker, so neither environment's vars may name it, and a deploy (which keeps the secrets already set) leaves it be.
  test("[server:ledger-alarm-lists-suspects] given the committed wrangler.jsonc, when both environments are read, then neither names ADMIN_ACCOUNTS as a variable, so no account id is committed and the secret of that name stands alone", () => {
    const config = wrangler();
    expect(Object.keys(config.vars)).not.toContain("ADMIN_ACCOUNTS");
    expect(Object.keys(config.env?.["staging"]?.vars ?? {})).not.toContain("ADMIN_ACCOUNTS");
    expect(config.vars["SITE_URL"]).toMatch(/^https:\/\//);
    expect(config.env?.["staging"]?.vars["SITE_URL"]).toMatch(/^https:\/\//);
    const text = readFileSync(fileURLToPath(new URL("../../../wrangler.jsonc", import.meta.url).href), "utf8");
    // Named only in the comment that lists the secrets set with `wrangler secret put`, never as a key or a --var.
    expect(text).not.toMatch(/"ADMIN_ACCOUNTS"\s*:/);
    expect(text).not.toContain("--var");
    expect(text).toMatch(/\/\/ Secrets, set with `wrangler secret put <NAME>`[^\n]*\n(\s*\/\/[^\n]*\n)*?\s*\/\/[^\n]*\bADMIN_ACCOUNTS\b/);
  });

  test("[server:ledger-alarm-lists-suspects] given the Worker, when its isolate is made, then its config is the deployment's, read from the ADMIN_ACCOUNTS binding, and config.ts names no account", () => {
    // The isolate is made in worker.ts (server:no-platform-error-page's plumbing); the Env is in index.ts.
    const plumbing = readFileSync(fileURLToPath(new URL("../../worker.ts", import.meta.url).href), "utf8");
    expect(plumbing).toContain("config: deployedConfig(env.ADMIN_ACCOUNTS)");
    const worker = readFileSync(fileURLToPath(new URL("../../index.ts", import.meta.url).href), "utf8");
    expect(worker).toContain("export type Env = Cloudflare.Env;");
    // The bindings' types are generated from wrangler.jsonc; the admin list is a secret, so it is
    // declared beside the other secrets in src/env.d.ts and the generated file does not list it.
    const secrets = readFileSync(fileURLToPath(new URL("../../env.d.ts", import.meta.url).href), "utf8");
    expect(secrets).toMatch(/ADMIN_ACCOUNTS\?: string;/);
    const bindings = readFileSync(fileURLToPath(new URL("../../../worker-configuration.d.ts", import.meta.url).href), "utf8");
    expect(bindings).not.toContain("ADMIN_ACCOUNTS");
    const config = readFileSync(fileURLToPath(new URL("../../config.ts", import.meta.url).href), "utf8");
    expect(config).toContain("admin: { accounts: [] },");
  });
});
