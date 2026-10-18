// A software passkey for the account tests: it registers (account:passkey-needs-signed-in-session) and
// signs in (moderation:admin-view-for-admin-list) through the real auth library, building the
// WebAuthn messages a browser would send. Never imported by the Worker.
// https://www.w3.org/TR/webauthn-3/#sctn-registering-a-new-credential
// https://www.w3.org/TR/webauthn-3/#sctn-verifying-assertion
// https://www.w3.org/TR/webauthn-3/#sctn-none-attestation
import { fromBase64Url, toBase64Url } from "../bytes";
import { makeJar, SITE } from "./auth.testing";
import type { Harness, Jar } from "./auth.testing";

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

/** A CBOR text string shorter than 24 bytes. */
function cborText(text: string): number[] {
  const bytes = [...new TextEncoder().encode(text)];
  return [0x60 + bytes.length, ...bytes];
}

/** A CBOR byte string shorter than 65,536 bytes. */
function cborBytes(bytes: Uint8Array): number[] {
  const head = bytes.length < 24 ? [0x40 + bytes.length] : bytes.length < 256 ? [0x58, bytes.length] : [0x59, bytes.length >> 8, bytes.length & 255];
  return [...head, ...bytes];
}

/** User present, user verified; with the attested credential data flag when a credential follows. */
const FLAGS = { signIn: 0x05, register: 0x45 };

export interface SoftwarePasskey {
  /** The credential id, base64url, as the passkey row stores it. */
  id: string;
  /** Stores the passkey on the account directly, as if it had been registered earlier. */
  store: (h: Harness, account: string) => Promise<void>;
  /** Registers the passkey through the library from the jar's session, running `between` after the options are given; the status and body of the verification. */
  register: (h: Harness, jar: Jar, between?: () => Promise<void>) => Promise<{ options: number; status: number; body: Record<string, unknown> }>;
  /** Signs in with the passkey into `jar` (a fresh one unless given), running `between` after the options are given. */
  signIn: (h: Harness, jar?: Jar, between?: () => Promise<void>) => Promise<{ jar: Jar; status: number }>;
}

export async function softwarePasskey(id = "c29mdHdhcmUtcGFzc2tleQ"): Promise<SoftwarePasskey> {
  const keys = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", keys.publicKey)) as JsonWebKey;
  const publicKey = coseKey(fromBase64Url(jwk.x ?? ""), fromBase64Url(jwk.y ?? ""));
  const rpIdHash = await sha256(new TextEncoder().encode(new URL(SITE).hostname));
  let counter = 0;

  const store: SoftwarePasskey["store"] = async (h, account) => {
    await (await h.auth.$context).adapter.create({
      model: "passkey",
      data: { name: "software", userId: account, publicKey: btoa(String.fromCharCode(...publicKey)), credentialID: id, counter: 0, deviceType: "singleDevice", backedUp: false, transports: "internal", createdAt: new Date() },
    });
  };

  const register: SoftwarePasskey["register"] = async (h, jar, between) => {
    const asked = await h.call("/api/auth/passkey/generate-register-options", { jar });
    if (asked.status !== 200) return { options: asked.status, status: asked.status, body: await asked.json<Record<string, unknown>>() };
    const { challenge } = await asked.json<{ challenge: string }>();
    await between?.();
    const clientData = new TextEncoder().encode(JSON.stringify({ type: "webauthn.create", challenge, origin: SITE, crossOrigin: false }));
    const credential = fromBase64Url(id);
    const authData = Uint8Array.from([...rpIdHash, FLAGS.register, 0, 0, 0, 0, ...new Uint8Array(16), credential.length >> 8, credential.length & 255, ...credential, ...publicKey]);
    const attestation = Uint8Array.from([0xa3, ...cborText("fmt"), ...cborText("none"), ...cborText("attStmt"), 0xa0, ...cborText("authData"), ...cborBytes(authData)]);
    const response = {
      id,
      rawId: id,
      type: "public-key",
      response: { clientDataJSON: toBase64Url(clientData), attestationObject: toBase64Url(attestation), transports: ["internal"] },
      clientExtensionResults: {},
    };
    const reply = await h.call("/api/auth/passkey/verify-registration", { method: "POST", jar, json: { response } });
    return { options: asked.status, status: reply.status, body: await reply.json<Record<string, unknown>>() };
  };

  const signIn: SoftwarePasskey["signIn"] = async (h, jar = makeJar(), between) => {
    const options = await (await h.call("/api/auth/passkey/generate-authenticate-options", { jar })).json<{ challenge: string }>();
    await between?.();
    const clientData = new TextEncoder().encode(JSON.stringify({ type: "webauthn.get", challenge: options.challenge, origin: SITE, crossOrigin: false }));
    counter += 1;
    const authenticatorData = Uint8Array.from([...rpIdHash, FLAGS.signIn, 0, 0, 0, counter]);
    const signed = Uint8Array.from([...authenticatorData, ...(await sha256(clientData))]);
    const signature = der(new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keys.privateKey, signed)));
    const response = {
      id,
      rawId: id,
      type: "public-key",
      response: { clientDataJSON: toBase64Url(clientData), authenticatorData: toBase64Url(authenticatorData), signature: toBase64Url(signature) },
      clientExtensionResults: {},
    };
    const reply = await h.call("/api/auth/passkey/verify-authentication", { method: "POST", jar, json: { response } });
    return { jar, status: reply.status };
  };

  return { id, store, register, signIn };
}
