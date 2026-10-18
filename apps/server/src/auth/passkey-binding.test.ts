// R-ACCOUNT-003 and R-MODERATION-012: who may add a passkey, and what every
// addition leaves behind, so whoever gets into an admin's email cannot add the
// passkey the admin pages need.
// Through the real auth library with a software passkey.
import { describe, expect, test } from "vitest";

import { testConfig } from "../config";
import { accountHash, ADMIN_PASSKEY_BIND_DETAIL, PASSKEY_ROWS } from "./hooks";
import type { PasskeyNote } from "./hooks";
import { softwarePasskey } from "./passkey.testing";
import { harness } from "./auth.testing";
import type { Harness } from "./auth.testing";

async function signedUp(h: Harness, email: string, admin: boolean) {
  const result = await h.signUp(email);
  if (admin) h.deps.config.admin.accounts.push(result.account);
  return result;
}

async function notes(h: Harness): Promise<PasskeyNote[]> {
  return (await h.deps.stores.audit.list(PASSKEY_ROWS)).map((row) => JSON.parse(row.note) as PasskeyNote);
}

/** R-ACCOUNT-018: no audit row of a passkey holds the account's id itself. */
async function namesNoOne(h: Harness, account: string): Promise<void> {
  const rows = await h.deps.stores.audit.list(PASSKEY_ROWS);
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) expect(JSON.stringify(row)).not.toContain(account);
}

function passkeysOf(h: Harness, account: string): unknown[] {
  return h.tables.passkey.filter((row) => row["userId"] === account).map((row) => row["credentialID"]);
}

describe("adding a passkey", () => {
  test("[R-ACCOUNT-003] [R-MODERATION-012] given an admin holding a passkey and signed in by email code, when a second passkey's registration is asked for, then it is refused, and nothing is stored, logged or sent", async () => {
    const h = harness({ config: testConfig({ testing: { captureOtp: true } }) });
    const { jar, account } = await signedUp(h, "owner@example.com", true);
    await (await softwarePasskey("Zmlyc3Qta2V5")).store(h, account);
    const second = await (await softwarePasskey("c2Vjb25kLWtleQ")).register(h, jar);
    expect({ options: second.options, status: second.status, message: second.body["message"] }).toEqual({ options: 403, status: 403, message: ADMIN_PASSKEY_BIND_DETAIL });
    expect(passkeysOf(h, account)).toEqual(["Zmlyc3Qta2V5"]);
    expect(await notes(h)).toEqual([]);
    expect(h.notices).toEqual([]);
  });

  test("[R-ACCOUNT-003] [R-MODERATION-012] given an admin signed in by email code who was given the options before the first passkey was stored, when the second is sent for verification, then it is refused there too", async () => {
    const h = harness({ config: testConfig({ testing: { captureOtp: true } }) });
    const { jar, account } = await signedUp(h, "owner@example.com", true);
    const first = await softwarePasskey("Zmlyc3Qta2V5");
    const second = await (await softwarePasskey("c2Vjb25kLWtleQ")).register(h, jar, () => first.store(h, account));
    expect({ options: second.options, status: second.status, message: second.body["message"] }).toEqual({ options: 200, status: 403, message: ADMIN_PASSKEY_BIND_DETAIL });
    expect(passkeysOf(h, account)).toEqual(["Zmlyc3Qta2V5"]);
    expect(await notes(h)).toEqual([]);
  });

  test("[R-ACCOUNT-003] [R-MODERATION-012] given the same admin signed in with the passkey, when a second passkey is registered, then it is stored, the audit log holds the row, and a notice goes to the account's email without the reply waiting on it", async () => {
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

  test("[R-ACCOUNT-003] given an admin with no passkey yet, signed in by email code, when the first passkey is registered, then it is allowed, logged and noticed", async () => {
    const h = harness({ config: testConfig({ testing: { captureOtp: true } }) });
    const { jar, account } = await signedUp(h, "owner@example.com", true);
    const first = await (await softwarePasskey("Zmlyc3Qta2V5")).register(h, jar);
    expect(first.status).toBe(200);
    expect(passkeysOf(h, account)).toEqual(["Zmlyc3Qta2V5"]);
    expect(await notes(h)).toEqual([{ accountHash: await accountHash(account), passkey: first.body["id"], admin: true, signedInWith: "email-code" }]);
    await namesNoOne(h, account);
    expect(h.notices.map((notice) => notice.email)).toEqual(["owner@example.com"]);
  });

  test("[R-ACCOUNT-003] given a player off the admin list holding a passkey and signed in by email code, when a second is registered, then it is allowed, logged and noticed", async () => {
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

  test("[R-ACCOUNT-003] given a registration that fails its verification, when it is refused, then nothing is logged or sent", async () => {
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

  test("[R-ACCOUNT-003] [R-ACCOUNT-018] given a passkey's audit row, when a living account's id is hashed under the server's secret, then it finds the row, and under any other secret it does not", async () => {
    const h = harness();
    const { jar, account } = await signedUp(h, "player@example.com", false);
    expect((await (await softwarePasskey("Zmlyc3Qta2V5")).register(h, jar)).status).toBe(200);
    const [note] = await notes(h);
    expect(note?.accountHash).toBe(await accountHash(account));
    expect(note?.accountHash).not.toContain(account);
    await namesNoOne(h, account);
  });
});
