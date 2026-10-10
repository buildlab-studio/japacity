// R-MODERATION-012 through the real auth library: an admin session opened by
// email code is refused, one opened with a passkey is let in. The passkey is a
// software one that signs the WebAuthn assertion a browser would send.
import { pgStores } from "@japacity/db";
import { connectPglite } from "@japacity/db/pglite";
import { describe, expect, test } from "vitest";

import { drizzleAuthAdapter } from "../auth/drizzle";
import { softwarePasskey } from "../auth/software-passkey";
import { harness } from "../auth/testing";
import { testConfig } from "../config";
import { memoryStores } from "../deps";
import type { Harness, Jar } from "../auth/testing";
import { ADMIN_PASSKEY_DETAIL } from "./admin";

const ADMIN_ROUTES = ["/api/admin/alarms", "/api/admin/report", "/api/admin/rejections", "/api/admin/analytics", "/api/admin/adverts/campaigns", "/api/admin/moderation/queue", "/api/admin/switches"];

/** Adds a software passkey to the account, and returns the sign-in it makes into a fresh jar. */
async function storedPasskey(h: Harness, account: string): Promise<() => Promise<{ jar: Jar; status: number }>> {
  const key = await softwarePasskey();
  await key.store(h, account);
  return () => key.signIn(h);
}

async function admin(h: Harness, email: string) {
  const signedUp = await h.signUp(email);
  h.deps.config.admin.accounts.push(signedUp.account);
  return signedUp;
}

describe("the admin passkey rule", () => {
  test("[R-MODERATION-012] given an admin signed in by email code, when any admin route is asked, then it is refused as not-legal for want of a passkey, and the account reply does not offer the admin page", async () => {
    const h = harness({ config: testConfig({ testing: { captureOtp: true } }) });
    const { jar } = await admin(h, "owner@example.com");
    for (const path of ADMIN_ROUTES) {
      const reply = await h.call(path, { jar });
      expect({ path, status: reply.status, body: await reply.json() }).toEqual({ path, status: 403, body: { ok: false, code: "not-legal", detail: ADMIN_PASSKEY_DETAIL } });
    }
    expect(await (await h.call("/api/account", { jar })).json()).toMatchObject({ ok: true, account: { admin: false } });
    expect(h.tables.session.map((row) => row["signedInWith"])).toEqual(["email-code"]);
  });

  test("[R-MODERATION-012] given the same admin signed in with a passkey, when the admin routes are asked, then each answers, and the account reply offers the admin page", async () => {
    const h = harness({ config: testConfig({ testing: { captureOtp: true } }) });
    const { account } = await admin(h, "owner@example.com");
    const signIn = await storedPasskey(h, account);
    const { jar, status } = await signIn();
    expect(status).toBe(200);
    for (const path of ADMIN_ROUTES) expect({ path, status: (await h.call(path, { jar })).status }).toEqual({ path, status: 200 });
    expect(await (await h.call("/api/account", { jar })).json()).toMatchObject({ ok: true, account: { admin: true } });
    expect(h.tables.session.map((row) => row["signedInWith"])).toEqual(["email-code", "passkey"]);
  });

  test("[R-MODERATION-012] given a player off the admin list signed in with a passkey, when an admin route is asked, then it does not exist", async () => {
    const h = harness({ config: testConfig({ testing: { captureOtp: true } }) });
    const { account } = await h.signUp("player@example.com");
    const { jar, status } = await (await storedPasskey(h, account))();
    expect(status).toBe(200);
    for (const path of ADMIN_ROUTES) expect({ path, status: (await h.call(path, { jar })).status }).toEqual({ path, status: 404 });
    expect(await (await h.call("/api/account", { jar })).json()).toMatchObject({ ok: true, account: { admin: false } });
  });

  test("[R-MODERATION-012] given the auth library on Drizzle's adapter and Postgres, when an admin signs in by code and then with a passkey, then the session row keeps how each was opened and only the passkey one reaches the admin routes", async () => {
    const connection = await connectPglite();
    try {
      const h = harness({ config: testConfig({ testing: { captureOtp: true } }), stores: { ...memoryStores(), ...pgStores(connection.handle) }, adapter: drizzleAuthAdapter(connection.db) });
      const { jar: byCode, account } = await admin(h, "owner@example.com");
      expect((await h.call("/api/admin/alarms", { jar: byCode })).status).toBe(403);
      const { jar, status } = await (await storedPasskey(h, account))();
      expect(status).toBe(200);
      expect((await h.call("/api/admin/alarms", { jar })).status).toBe(200);
      const rows = await (await h.auth.$context).adapter.findMany<{ signedInWith: string | null }>({ model: "session", where: [{ field: "userId", value: account }] });
      expect(rows.map((row) => row.signedInWith).sort()).toEqual(["email-code", "passkey"]);
    } finally {
      await connection.close();
    }
  });
});
