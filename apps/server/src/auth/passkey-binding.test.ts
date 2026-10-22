// account:passkey-needs-signed-in-session and moderation:admin-view-for-admin-list: who may add or remove a passkey, and what every
// addition leaves behind, so whoever gets into an admin's email cannot add the
// passkey the admin pages need.
// Through the real auth library with a software passkey.
import { describe, expect, test } from "vitest";

import { testConfig } from "../config";
import { accountHash, ADMIN_PASSKEY_BIND_DETAIL, ADMIN_REMOVAL_DETAIL, PASSKEY_ROWS } from "./hooks";
import type { PasskeyNote } from "./hooks";
import { softwarePasskey } from "./passkey.testing";
import { harness, makeJar, withGoogle } from "./auth.testing";
import type { Harness } from "./auth.testing";

async function signedUp(h: Harness, email: string, admin: boolean) {
  const result = await h.signUp(email);
  if (admin) h.deps.config.admin.accounts.push(result.account);
  return result;
}

async function notes(h: Harness): Promise<PasskeyNote[]> {
  return (await h.deps.stores.audit.list(PASSKEY_ROWS)).map((row) => JSON.parse(row.note) as PasskeyNote);
}

/** account:deletion-keeps-anonymous-totals: no audit row of a passkey holds the account's id itself. */
async function namesNoOne(h: Harness, account: string): Promise<void> {
  const rows = await h.deps.stores.audit.list(PASSKEY_ROWS);
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) expect(JSON.stringify(row)).not.toContain(account);
}

function passkeysOf(h: Harness, account: string): unknown[] {
  return h.tables.passkey.filter((row) => row["userId"] === account).map((row) => row["credentialID"]);
}

describe("adding a passkey", () => {
  test("[account:passkey-needs-signed-in-session] given a kept account, when a passkey's registration options are asked for, then the phone must keep the passkey itself and lists it under the account's email", async () => {
    const h = harness();
    const { jar } = await signedUp(h, "ada@example.com", false);
    const asked = await h.call("/api/auth/passkey/generate-register-options", { jar });
    expect(asked.status).toBe(200);
    const options = await asked.json<{ user: { name: string; displayName: string }; authenticatorSelection: Record<string, unknown> }>();
    expect(options.authenticatorSelection).toMatchObject({ residentKey: "required", requireResidentKey: true, userVerification: "preferred" });
    expect(options.user).toMatchObject({ name: "ada@example.com", displayName: "ada@example.com" });
  });

  test("[account:passkey-needs-signed-in-session] [moderation:admin-view-for-admin-list] given an admin holding a passkey and signed in by email code, when a second passkey's registration is asked for, then it is refused, and nothing is stored, logged or sent", async () => {
    const h = harness({ config: testConfig({ testing: { captureOtp: true } }) });
    const { jar, account } = await signedUp(h, "owner@example.com", true);
    await (await softwarePasskey("Zmlyc3Qta2V5")).store(h, account);
    const second = await (await softwarePasskey("c2Vjb25kLWtleQ")).register(h, jar);
    expect({ options: second.options, status: second.status, message: second.body["message"] }).toEqual({ options: 403, status: 403, message: ADMIN_PASSKEY_BIND_DETAIL });
    expect(passkeysOf(h, account)).toEqual(["Zmlyc3Qta2V5"]);
    expect(await notes(h)).toEqual([]);
    expect(h.notices).toEqual([]);
  });

  test("[account:passkey-needs-signed-in-session] [moderation:admin-view-for-admin-list] given an admin signed in by email code who was given the options before the first passkey was stored, when the second is sent for verification, then it is refused there too", async () => {
    const h = harness({ config: testConfig({ testing: { captureOtp: true } }) });
    const { jar, account } = await signedUp(h, "owner@example.com", true);
    const first = await softwarePasskey("Zmlyc3Qta2V5");
    const second = await (await softwarePasskey("c2Vjb25kLWtleQ")).register(h, jar, () => first.store(h, account));
    expect({ options: second.options, status: second.status, message: second.body["message"] }).toEqual({ options: 200, status: 403, message: ADMIN_PASSKEY_BIND_DETAIL });
    expect(passkeysOf(h, account)).toEqual(["Zmlyc3Qta2V5"]);
    expect(await notes(h)).toEqual([]);
  });

  test("[account:passkey-needs-signed-in-session] [moderation:admin-view-for-admin-list] given the same admin signed in with the passkey, when a second passkey is registered, then it is stored, the audit log holds the row, and a notice goes to the account's email without the reply waiting on it", async () => {
    const h = harness({ config: testConfig({ testing: { captureOtp: true } }) });
    const { account } = await signedUp(h, "owner@example.com", true);
    const first = await softwarePasskey("Zmlyc3Qta2V5");
    await first.store(h, account);
    const { jar, status } = await first.signIn(h);
    expect(status).toBe(200);
    const background = h.background.length;
    const second = await (await softwarePasskey("c2Vjb25kLWtleQ")).register(h, jar);
    expect(second.status).toBe(200);
    expect(passkeysOf(h, account)).toEqual(["Zmlyc3Qta2V5", "c2Vjb25kLWtleQ"]);
    const id = second.body["id"];
    expect(typeof id).toBe("string");
    expect(await notes(h)).toEqual([{ accountHash: await accountHash(account), passkey: id, admin: true, signedInWith: "passkey" }]);
    await namesNoOne(h, account);
    expect(h.notices).toEqual([{ email: "owner@example.com", kind: "passkey-added", at: expect.any(Number) as number }]);
    expect(h.background).toHaveLength(background + 1);
  });

  test("[account:passkey-needs-signed-in-session] given an admin with no passkey yet, signed in by email code, when the first passkey is registered, then it is allowed, logged and noticed", async () => {
    const h = harness({ config: testConfig({ testing: { captureOtp: true } }) });
    const { jar, account } = await signedUp(h, "owner@example.com", true);
    const first = await (await softwarePasskey("Zmlyc3Qta2V5")).register(h, jar);
    expect(first.status).toBe(200);
    expect(passkeysOf(h, account)).toEqual(["Zmlyc3Qta2V5"]);
    expect(await notes(h)).toEqual([{ accountHash: await accountHash(account), passkey: first.body["id"], admin: true, signedInWith: "email-code" }]);
    await namesNoOne(h, account);
    expect(h.notices.map((notice) => notice.email)).toEqual(["owner@example.com"]);
  });

  test("[account:passkey-needs-signed-in-session] given a player off the admin list holding a passkey and signed in by email code, when a second is registered, then it is allowed, logged and noticed", async () => {
    const h = harness({ config: testConfig({ testing: { captureOtp: true } }) });
    const { jar, account } = await signedUp(h, "player@example.com", false);
    await (await softwarePasskey("Zmlyc3Qta2V5")).store(h, account);
    const second = await (await softwarePasskey("c2Vjb25kLWtleQ")).register(h, jar);
    expect(second.status).toBe(200);
    expect(passkeysOf(h, account)).toEqual(["Zmlyc3Qta2V5", "c2Vjb25kLWtleQ"]);
    expect(await notes(h)).toEqual([{ accountHash: await accountHash(account), passkey: second.body["id"], admin: false, signedInWith: "email-code" }]);
    await namesNoOne(h, account);
    expect(h.notices.map((notice) => notice.email)).toEqual(["player@example.com"]);
  });

  test("[account:passkey-needs-signed-in-session] given a registration that fails its verification, when it is refused, then nothing is logged or sent", async () => {
    const h = harness({ config: testConfig({ testing: { captureOtp: true } }) });
    const { jar } = await signedUp(h, "player@example.com", false);
    const asked = await h.call("/api/auth/passkey/generate-register-options", { jar });
    expect(asked.status).toBe(200);
    const reply = await h.call("/api/auth/passkey/verify-registration", { method: "POST", jar, json: { response: { id: "eA", rawId: "eA", type: "public-key", response: { clientDataJSON: "e30", attestationObject: "oA" }, clientExtensionResults: {} } } });
    // The library answers any failed verification 500 with its own code.
    expect({ status: reply.status, code: (await reply.json<{ code?: string }>()).code }).toEqual({ status: 500, code: "FAILED_TO_VERIFY_REGISTRATION" });
    expect(h.tables.passkey).toEqual([]);
    expect(await notes(h)).toEqual([]);
    expect(h.notices).toEqual([]);
  });

  test("[account:passkey-needs-signed-in-session] [account:deletion-keeps-anonymous-totals] given a passkey's audit row, when a living account's id is hashed under the server's secret, then it finds the row, and under any other secret it does not", async () => {
    const h = harness();
    const { jar, account } = await signedUp(h, "player@example.com", false);
    expect((await (await softwarePasskey("Zmlyc3Qta2V5")).register(h, jar)).status).toBe(200);
    const [note] = await notes(h);
    expect(note?.accountHash).toBe(await accountHash(account));
    expect(note?.accountHash).not.toContain(account);
    await namesNoOne(h, account);
  });
});

describe("removing a way in", () => {
  test("[account:passkey-needs-signed-in-session] [moderation:admin-view-for-admin-list] given an admin holding a passkey and signed in with it in one browser, when someone with only the admin's email signs in by code and removes that passkey, then it is refused, the passkey and the admin's session stay, and no passkey of theirs can be added", async () => {
    const h = harness({ config: testConfig({ testing: { captureOtp: true } }) });
    const { account } = await signedUp(h, "owner@example.com", true);
    const owners = await softwarePasskey("b3duZXJzLXBhc3NrZXk");
    await owners.store(h, account);
    const ownerBrowser = (await owners.signIn(h)).jar;
    expect((await h.call("/api/admin/alarms", { jar: ownerBrowser })).status).toBe(200);
    const intruder = makeJar();
    const code = await h.codeFor("owner@example.com", intruder, "198.51.100.9");
    expect((await h.call("/api/auth/sign-in/email-otp", { method: "POST", jar: intruder, ip: "198.51.100.9", json: { email: "owner@example.com", otp: code } })).status).toBe(200);
    const listed = await (await h.call("/api/auth/passkey/list-user-passkeys", { jar: intruder })).json<{ id: string }[]>();
    const removed = await h.call("/api/auth/passkey/delete-passkey", { method: "POST", jar: intruder, json: { id: listed[0]?.id } });
    expect({ status: removed.status, message: (await removed.json<Record<string, unknown>>())["message"] }).toEqual({ status: 403, message: ADMIN_REMOVAL_DETAIL });
    expect(passkeysOf(h, account)).toEqual(["b3duZXJzLXBhc3NrZXk"]);
    expect((await h.call("/api/account", { jar: ownerBrowser })).status).toBe(200);
    const theirs = await (await softwarePasskey("aW50cnVkZXJzLWtleQ")).register(h, intruder);
    expect({ options: theirs.options, status: theirs.status }).toEqual({ options: 403, status: 403 });
    expect((await h.call("/api/admin/alarms", { jar: intruder })).status).toBe(403);
  });

  test("[account:passkey-needs-signed-in-session] [moderation:admin-view-for-admin-list] given an admin holding a passkey and two Google links, signed in by email code, when one Google link is removed, then it is refused and both links and the other session stay", async () => {
    const h = harness({ config: testConfig({ testing: { captureOtp: true } }) });
    const { jar, account } = await signedUp(h, "owner@example.com", true);
    await (await softwarePasskey("Zmlyc3Qta2V5")).store(h, account);
    const googleBrowser = makeJar();
    await withGoogle(h, googleBrowser, { sub: "google-subject-1", email: "owner@example.com" });
    expect((await h.call("/api/account", { jar: googleBrowser })).status).toBe(200);
    // A second link stored as if made earlier, so the library would let one go.
    await (await h.auth.$context).adapter.create({ model: "account", data: { userId: account, providerId: "google", accountId: "google-subject-0", createdAt: new Date(), updatedAt: new Date() } });
    const linked = h.tables.account.find((row) => row["accountId"] === "google-subject-1");
    const unlinked = await h.call("/api/auth/unlink-account", { method: "POST", jar, json: { accountId: linked?.["id"] } });
    expect({ status: unlinked.status, message: (await unlinked.json<Record<string, unknown>>())["message"] }).toEqual({ status: 403, message: ADMIN_REMOVAL_DETAIL });
    expect(h.tables.account.filter((row) => row["userId"] === account).map((row) => row["accountId"]).sort()).toEqual(["google-subject-0", "google-subject-1"]);
    expect((await h.call("/api/account", { jar: googleBrowser })).status).toBe(200);
  });

  test("[account:passkey-needs-signed-in-session] [moderation:admin-view-for-admin-list] given an admin signed in with a user-verified passkey, when it removes a passkey, then it is removed and its other sessions end", async () => {
    const h = harness({ config: testConfig({ testing: { captureOtp: true } }) });
    const { jar: codeBrowser, account } = await signedUp(h, "owner@example.com", true);
    const first = await softwarePasskey("Zmlyc3Qta2V5");
    await first.store(h, account);
    await (await softwarePasskey("c2Vjb25kLWtleQ")).store(h, account);
    const { jar } = await first.signIn(h);
    const second = h.tables.passkey.find((row) => row["credentialID"] === "c2Vjb25kLWtleQ");
    const removed = await h.call("/api/auth/passkey/delete-passkey", { method: "POST", jar, json: { id: second?.["id"] } });
    expect(removed.status).toBe(200);
    expect(passkeysOf(h, account)).toEqual(["Zmlyc3Qta2V5"]);
    expect((await h.call("/api/account", { jar })).status).toBe(200);
    expect((await h.call("/api/account", { jar: codeBrowser })).status).toBe(401);
  });
});
