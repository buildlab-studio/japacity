// moderation:admin-view-for-admin-list: the admin's passkey step-up through the real auth library, with software
// passkeys: the passkey shown from the signed-in browser opens a new session for the same account, the old one ends,
// and only a recent, user-verified passkey of that account opens the admin routes.
import { time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { testConfig } from "../config";
import { harness, makeJar } from "./auth.testing";
import type { Harness, Jar } from "./auth.testing";
import { ADMIN_PASSKEY_BIND_DETAIL, OTHER_ACCOUNT } from "./hooks";
import { softwarePasskey } from "./passkey.testing";
import { passkeyShown, userVerified } from "./session";

const ALARMS = "/api/admin/alarms";

/** A harness whose server clock a test can stop at a moment of its choosing. */
function clocked(): { h: Harness; stopAt: (at: number) => void } {
  let stopped: number | null = null;
  const h = harness({ config: testConfig({ testing: { captureOtp: true } }), now: () => stopped ?? Date.now() });
  return { h, stopAt: (at) => (stopped = at) };
}

/** An account on the admin list, signed in by email code. */
async function admin(h: Harness, email = "owner@example.com"): Promise<{ jar: Jar; account: string }> {
  const signedUp = await h.signUp(email);
  h.deps.config.admin.accounts.push(signedUp.account);
  return signedUp;
}

async function standing(h: Harness, jar: Jar): Promise<{ status: number; id?: unknown; admin?: unknown; adminNeedsPasskey?: unknown }> {
  const reply = await h.call("/api/account", { jar });
  if (reply.status !== 200) return { status: reply.status };
  const { account } = await reply.json<{ account: { id: string; admin: boolean; adminNeedsPasskey?: boolean } }>();
  return { status: 200, id: account.id, admin: account.admin, adminNeedsPasskey: "adminNeedsPasskey" in account ? account.adminNeedsPasskey : "absent" };
}

function sessionsOf(h: Harness, account: string): unknown[] {
  return h.tables.session.filter((row) => row["userId"] === account).map((row) => row["signedInWith"]);
}

function copy(jar: Jar): Jar {
  const held = makeJar();
  for (const [name, value] of jar.cookies) held.cookies.set(name, value);
  return held;
}

describe("the admin's passkey step-up", () => {
  test("[moderation:admin-view-for-admin-list] given an admin signed in by email code who holds a passkey, when the passkey is shown from that browser, then a new passkey session opens for the same account, the code session ends, and the admin routes answer", async () => {
    const { h } = clocked();
    const { jar, account } = await admin(h);
    const key = await softwarePasskey();
    await key.store(h, account);
    expect(await standing(h, jar)).toEqual({ status: 200, id: account, admin: false, adminNeedsPasskey: true });
    expect((await h.call(ALARMS, { jar })).status).toBe(403);
    const before = copy(jar);

    const { status } = await key.signIn(h, jar);
    expect(status).toBe(200);
    expect(await standing(h, jar)).toEqual({ status: 200, id: account, admin: true, adminNeedsPasskey: false });
    expect((await h.call(ALARMS, { jar })).status).toBe(200);
    expect(sessionsOf(h, account)).toEqual(["passkey"]);
    expect((await h.call("/api/account", { jar: before })).status).toBe(401);
  });

  test("[moderation:admin-view-for-admin-list] given an admin's passkey session, when the server's clock reaches the window's edge, then it still opens the admin routes, and a millisecond later it does not and the account asks for the passkey again", async () => {
    const { h, stopAt } = clocked();
    const { account } = await admin(h);
    const key = await softwarePasskey();
    await key.store(h, account);
    const { jar } = await key.signIn(h);
    const [row] = h.tables.session.filter((each) => each["signedInWith"] === "passkey");
    const opened = new Date(row?.["createdAt"] as Date).getTime();
    stopAt(opened + h.deps.config.admin.passkeyMs);
    expect((await h.call(ALARMS, { jar })).status).toBe(200);
    stopAt(opened + h.deps.config.admin.passkeyMs + 1);
    expect((await h.call(ALARMS, { jar })).status).toBe(403);
    expect(await standing(h, jar)).toMatchObject({ status: 200, admin: false, adminNeedsPasskey: true });

    // The passkey shown again opens the view again.
    stopAt(Date.now() + time.MINUTE_MS);
    expect((await key.signIn(h, jar)).status).toBe(200);
    expect((await h.call(ALARMS, { jar })).status).toBe(200);
  });

  test("[moderation:admin-view-for-admin-list] given a passkey that does not verify the person, when an admin signs in or steps up with it, then the session opens as a passkey that verified no one, and the admin routes stay shut", async () => {
    const { h } = clocked();
    const { jar, account } = await admin(h);
    const key = await softwarePasskey(undefined, { userVerified: false });
    await key.store(h, account);
    expect((await key.signIn(h, jar)).status).toBe(200);
    expect(sessionsOf(h, account)).toEqual(["passkey-unverified"]);
    expect((await h.call(ALARMS, { jar })).status).toBe(403);
    expect(await standing(h, jar)).toMatchObject({ status: 200, id: account, admin: false, adminNeedsPasskey: true });

    const fresh = await key.signIn(h);
    expect(fresh.status).toBe(200);
    expect((await h.call(ALARMS, { jar: fresh.jar })).status).toBe(403);
  });

  test("[moderation:admin-view-for-admin-list] given an admin signed in by email code, when another account's passkey is shown from that browser, then it is refused as another account's, nothing opens, and the browser stays the admin's code session", async () => {
    const { h } = clocked();
    const { jar, account } = await admin(h);
    const { account: other } = await h.signUp("player@example.com");
    const theirs = await softwarePasskey("dGhlaXJzLWtleQ");
    await theirs.store(h, other);
    const sessions = h.tables.session.length;

    const shown = await theirs.signIn(h, jar);
    expect({ status: shown.status, code: shown.body["code"] }).toEqual({ status: 403, code: OTHER_ACCOUNT });
    expect(h.tables.session).toHaveLength(sessions);
    expect(h.tables.passkey.find((row) => row["userId"] === other)?.["counter"]).toBe(0);
    expect(await standing(h, jar)).toEqual({ status: 200, id: account, admin: false, adminNeedsPasskey: true });
    expect((await h.call(ALARMS, { jar })).status).toBe(403);
  });

  test("[moderation:admin-view-for-admin-list] [account:dead-cookie-expired-on-first-read] given a browser holding a dead session cookie, when a passkey is shown, then it signs in as the passkey's account as any sign-in does, the dead session is not looked for, and the new session opens the admin routes", async () => {
    const { h } = clocked();
    const { jar, account } = await admin(h);
    const key = await softwarePasskey();
    await key.store(h, account);
    await (await h.auth.$context).internalAdapter.deleteUserSessions(account);

    const { status } = await key.signIn(h, jar);
    expect(status).toBe(200);
    expect(sessionsOf(h, account)).toEqual(["passkey"]);
    expect(await standing(h, jar)).toEqual({ status: 200, id: account, admin: true, adminNeedsPasskey: false });
  });

  test("[moderation:admin-view-for-admin-list] [account:guest-and-secured-states] given a browser whose dead cookie belonged to the admin, when another account's passkey is shown, then that account signs in, since a dead cookie holds no one", async () => {
    const { h } = clocked();
    const { jar, account } = await admin(h);
    const { account: other } = await h.signUp("player@example.com");
    const theirs = await softwarePasskey("dGhlaXJzLWtleQ");
    await theirs.store(h, other);
    await (await h.auth.$context).internalAdapter.deleteUserSessions(account);

    expect((await theirs.signIn(h, jar)).status).toBe(200);
    expect(await standing(h, jar)).toEqual({ status: 200, id: other, admin: false, adminNeedsPasskey: "absent" });
  });

  test("[account:passkey-needs-signed-in-session] [moderation:admin-view-for-admin-list] given an admin holding a passkey whose passkey session is past the window, or opened by a passkey that verified no one, when a second passkey's registration is asked for, then it is refused", async () => {
    for (const userVerifiedKey of [true, false]) {
      const { h, stopAt } = clocked();
      const { account } = await admin(h);
      const key = await softwarePasskey(undefined, { userVerified: userVerifiedKey });
      await key.store(h, account);
      const { jar } = await key.signIn(h);
      if (userVerifiedKey) stopAt(Date.now() + h.deps.config.admin.passkeyMs + time.SECOND_MS);
      const second = await (await softwarePasskey("c2Vjb25kLWtleQ")).register(h, jar);
      expect({ userVerifiedKey, status: second.status, message: second.body["message"] }).toEqual({ userVerifiedKey, status: 403, message: ADMIN_PASSKEY_BIND_DETAIL });
    }
  });
});

describe("what a session counts as", () => {
  test("[moderation:admin-view-for-admin-list] given a session, then it has shown a passkey only when a user-verified passkey opened it within the window, never one opened another way", () => {
    const now = Date.UTC(2026, 9, 18, 22, 0);
    const window = 15 * time.MINUTE_MS;
    const at = (signedInWith: string, ago: number) => passkeyShown({ signedInWith, createdAt: new Date(now - ago) }, now, window);
    expect(at("passkey", 0)).toBe(true);
    expect(at("passkey", window)).toBe(true);
    expect(at("passkey", window + 1)).toBe(false);
    for (const other of ["passkey-unverified", "email-code", "google", "other"]) expect(at(other, 0)).toBe(false);
  });

  test("[moderation:admin-view-for-admin-list] given an assertion's authenticator data, then the person counts as verified only when its flags byte carries the user-verified bit", () => {
    const data = (flags: number) => ({ response: { response: { authenticatorData: btoa(String.fromCharCode(...new Uint8Array(32), flags, 0, 0, 0, 1)).replace(/=+$/, "") } } });
    expect(userVerified(data(0x05))).toBe(true);
    expect(userVerified(data(0x04))).toBe(true);
    expect(userVerified(data(0x01))).toBe(false);
    expect(userVerified({ response: { response: {} } })).toBe(false);
    expect(userVerified(undefined)).toBe(false);
    expect(userVerified({ response: { response: { authenticatorData: "%%%" } } })).toBe(false);
  });
});
