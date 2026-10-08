// R-MODERATION-012 through the real auth library: an admin session opened by
// email code is refused, one opened with a passkey is let in. The passkey is a
// software one that signs the WebAuthn assertion a browser would send.
// https://www.w3.org/TR/webauthn-3/#sctn-verifying-assertion
import { pgStores } from "@japacity/db";
import { connectPglite } from "@japacity/db/pglite";
import { describe, expect, test } from "vitest";

import { drizzleAuthAdapter } from "../auth/drizzle";
import { harness, makeJar, SITE } from "../auth/testing";
import { testConfig } from "../config";
import { memoryStores } from "../deps";
import type { Harness, Jar } from "../auth/testing";
import { ADMIN_PASSKEY_DETAIL } from "./admin";

const CREDENTIAL = "c29mdHdhcmUtcGFzc2tleQ";
const ADMIN_ROUTES = ["/api/admin/alarms", "/api/admin/report", "/api/admin/rejections", "/api/admin/analytics", "/api/admin/adverts/campaigns", "/api/admin/moderation/queue", "/api/admin/switches"];

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(text: string): Uint8Array {
  return Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
}

/** One ASN.1 INTEGER from a 32-byte big-endian value: leading zeros dropped, a zero added before a high bit. */
function derInteger(value: Uint8Array): number[] {
  let start = 0;
  while (start < value.length - 1 && value[start] === 0) start += 1;
  const body = [...value.subarray(start)];
  if ((body[0] ?? 0) >= 0x80) body.unshift(0);
  return [0x02, body.length, ...body];
}

/** WebCrypto signs as r then s; WebAuthn sends the DER sequence of the two. */
function der(raw: Uint8Array): Uint8Array {
  const body = [...derInteger(raw.subarray(0, 32)), ...derInteger(raw.subarray(32))];
  return Uint8Array.from([0x30, body.length, ...body]);
}

/** A P-256 key as the COSE map a passkey row stores: kty EC2, alg ES256, crv P-256, x, y. */
function coseKey(x: Uint8Array, y: Uint8Array): Uint8Array {
  return Uint8Array.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20, ...x, 0x22, 0x58, 0x20, ...y]);
}

/** Adds a software passkey to the account, and returns the sign-in it makes into a fresh jar. */
async function softwarePasskey(h: Harness, account: string): Promise<() => Promise<{ jar: Jar; status: number }>> {
  const keys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", keys.publicKey)) as JsonWebKey;
  const publicKey = coseKey(fromBase64url(jwk.x ?? ""), fromBase64url(jwk.y ?? ""));
  await (await h.auth.$context).adapter.create({
    model: "passkey",
    data: { name: "software", userId: account, publicKey: btoa(String.fromCharCode(...publicKey)), credentialID: CREDENTIAL, counter: 0, deviceType: "singleDevice", backedUp: false, transports: "internal", createdAt: new Date() },
  });
  let counter = 0;

  return async () => {
    const jar = makeJar();
    const options = await (await h.call("/api/auth/passkey/generate-authenticate-options", { jar })).json<{ challenge: string }>();
    const clientData = new TextEncoder().encode(JSON.stringify({ type: "webauthn.get", challenge: options.challenge, origin: SITE, crossOrigin: false }));
    counter += 1;
    // User present and verified, then the sign count.
    const authenticatorData = Uint8Array.from([...(await sha256(new TextEncoder().encode(new URL(SITE).hostname))), 0x05, 0, 0, 0, counter]);
    const signed = Uint8Array.from([...authenticatorData, ...(await sha256(clientData))]);
    const signature = der(new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, signed)));
    const response = {
      id: CREDENTIAL,
      rawId: CREDENTIAL,
      type: "public-key",
      response: { clientDataJSON: base64url(clientData), authenticatorData: base64url(authenticatorData), signature: base64url(signature) },
      clientExtensionResults: {},
    };
    const reply = await h.call("/api/auth/passkey/verify-authentication", { method: "POST", jar, json: { response } });
    return { jar, status: reply.status };
  };
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
    const signIn = await softwarePasskey(h, account);
    const { jar, status } = await signIn();
    expect(status).toBe(200);
    for (const path of ADMIN_ROUTES) expect({ path, status: (await h.call(path, { jar })).status }).toEqual({ path, status: 200 });
    expect(await (await h.call("/api/account", { jar })).json()).toMatchObject({ ok: true, account: { admin: true } });
    expect(h.tables.session.map((row) => row["signedInWith"])).toEqual(["email-code", "passkey"]);
  });

  test("[R-MODERATION-012] given a player off the admin list signed in with a passkey, when an admin route is asked, then it does not exist", async () => {
    const h = harness({ config: testConfig({ testing: { captureOtp: true } }) });
    const { account } = await h.signUp("player@example.com");
    const { jar, status } = await (await softwarePasskey(h, account))();
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
      const { jar, status } = await (await softwarePasskey(h, account))();
      expect(status).toBe(200);
      expect((await h.call("/api/admin/alarms", { jar })).status).toBe(200);
      const rows = await (await h.auth.$context).adapter.findMany<{ signedInWith: string | null }>({ model: "session", where: [{ field: "userId", value: account }] });
      expect(rows.map((row) => row.signedInWith).sort()).toEqual(["email-code", "passkey"]);
    } finally {
      await connection.close();
    }
  });
});
