// Web Push on WebCrypto alone: the message encrypted for the browser (RFC 8291,
// the aes128gcm coding of RFC 8188) and the server named by a signed token
// (VAPID, RFC 8292). The two keys are deployment secrets.
// https://developer.mozilla.org/en-US/docs/Web/API/Push_API
// https://www.rfc-editor.org/rfc/rfc8291 https://www.rfc-editor.org/rfc/rfc8292
import { int, time } from "@japacity/sim";
import type { PushSubscriptionJson } from "@japacity/store";

import type { ServerConfig } from "../config";

export type Fetch = (input: string, init: RequestInit) => Promise<Response>;

/** R-CLOCK-031: the deployment's VAPID pair, both base64url: the public point (65 bytes) and the private scalar (32 bytes). */
export interface PushKeys {
  publicKey: string;
  privateKey: string;
  /** A `mailto:` or `https:` address the push services can reach the game's operator at. */
  subject: string;
  fetch: Fetch;
  /** `config.notify`: how long a push service keeps the notice for an offline device, and a token's life. */
  numbers: Pick<ServerConfig["notify"], "pushTtlDays" | "tokenHours">;
}

/** The time to live a push request carries, in seconds. */
export function ttlSeconds(keys: Pick<PushKeys, "numbers">): number {
  return keys.numbers.pushTtlDays * int.divFloor(time.DAY_MS, time.SECOND_MS);
}

/** The one record a notice fits in; RFC 8188's default. */
const RECORD_SIZE = 4096;

/** RFC 8292: a token lives at most a day; `config.notify.tokenHours` keeps it under that. */
function tokenSeconds(keys: Pick<PushKeys, "numbers">): number {
  return keys.numbers.tokenHours * int.divFloor(time.HOUR_MS, time.SECOND_MS);
}

const encoder = new TextEncoder();

export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const base = text.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base + "=".repeat((4 - (base.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const joined = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    joined.set(part, at);
    at += part.length;
  }
  return joined;
}

/** A label of RFC 8291 section 3: the words and one zero byte. */
export function label(words: string): Uint8Array<ArrayBuffer> {
  return concat(encoder.encode(words), Uint8Array.of(0));
}

export async function hkdf(salt: Uint8Array<ArrayBuffer>, secret: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, bytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
}

/** RFC 8291 section 3.4: the key and nonce of the one record, from the shared secret and the two public points. */
export async function recordKeys(shared: Uint8Array<ArrayBuffer>, auth: Uint8Array<ArrayBuffer>, receiver: Uint8Array, sender: Uint8Array, salt: Uint8Array<ArrayBuffer>) {
  const secret = await hkdf(auth, shared, concat(label("WebPush: info"), receiver, sender), 32);
  return {
    key: await hkdf(salt, secret, label("Content-Encoding: aes128gcm"), 16),
    nonce: await hkdf(salt, secret, label("Content-Encoding: nonce"), 12),
  };
}

/**
 * RFC 8291: `plain` sealed for the browser in one aes128gcm record, under a
 * fresh sender key and the 16-byte `salt`. The header carries the salt, the
 * record size and the sender's public point.
 */
export async function encrypt(device: PushSubscriptionJson, plain: Uint8Array, salt: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const receiver = fromBase64Url(device.keys.p256dh);
  const auth = fromBase64Url(device.keys.auth);
  const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const sender = new Uint8Array((await crypto.subtle.exportKey("raw", local.publicKey)) as ArrayBuffer);
  const theirs = await crypto.subtle.importKey("raw", receiver, { name: "ECDH", namedCurve: "P-256" }, false, []);
  // The Workers types call the peer key `$public`; the runtime, like the standard, reads `public`.
  const agreement = { name: "ECDH", public: theirs } as unknown as SubtleCryptoDeriveKeyAlgorithm;
  const shared = new Uint8Array(await crypto.subtle.deriveBits(agreement, local.privateKey, 256));
  const { key, nonce } = await recordKeys(shared, auth, receiver, sender, salt);
  const sealing = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt"]);
  // The 2 marks the last record (RFC 8188 section 2).
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, sealing, concat(plain, Uint8Array.of(2))));
  const size = new Uint8Array(4);
  new DataView(size.buffer).setUint32(0, RECORD_SIZE);
  return concat(salt, size, Uint8Array.of(sender.length), sender, sealed);
}

/** RFC 8292: the private key as a JWK, its public point split into x and y. */
function signingJwk(keys: PushKeys): JsonWebKey {
  const point = fromBase64Url(keys.publicKey);
  return { kty: "EC", crv: "P-256", d: keys.privateKey, x: toBase64Url(point.slice(1, 33)), y: toBase64Url(point.slice(33, 65)), ext: true };
}

/** RFC 8292 section 2: an ES256 token for the push service at `audience`, good for `config.notify.tokenHours` from `now`. */
export async function vapidToken(keys: PushKeys, audience: string, now: number): Promise<string> {
  const part = (value: object) => toBase64Url(encoder.encode(JSON.stringify(value)));
  const unsigned = `${part({ typ: "JWT", alg: "ES256" })}.${part({ aud: audience, exp: int.divFloor(now, time.SECOND_MS) + tokenSeconds(keys), sub: keys.subject })}`;
  const signing = await crypto.subtle.importKey("jwk", signingJwk(keys), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signing, encoder.encode(unsigned)));
  return `${unsigned}.${toBase64Url(signature)}`;
}

/** The request RFC 8030 section 5 asks for: the sealed body, the token and the public key, the coding and the TTL. */
export async function pushRequest(keys: PushKeys, device: PushSubscriptionJson, payload: string, now: number, salt: Uint8Array<ArrayBuffer>): Promise<RequestInit> {
  const body = await encrypt(device, encoder.encode(payload), salt);
  const token = await vapidToken(keys, new URL(device.endpoint).origin, now);
  return {
    method: "POST",
    headers: {
      authorization: `vapid t=${token}, k=${keys.publicKey}`,
      "content-encoding": "aes128gcm",
      "content-type": "application/octet-stream",
      ttl: String(ttlSeconds(keys)),
      urgency: "normal",
    },
    body,
  };
}

/** `gone`: the push service no longer knows the device (404 or 410), so its row is removed. */
export type PushOutcome = "sent" | "gone" | "failed";

export async function sendPush(keys: PushKeys, device: PushSubscriptionJson, payload: string, now: number, salt: Uint8Array<ArrayBuffer>): Promise<PushOutcome> {
  try {
    const response = await keys.fetch(device.endpoint, await pushRequest(keys, device, payload, now, salt));
    if (response.ok) return "sent";
    return response.status === 404 || response.status === 410 ? "gone" : "failed";
  } catch {
    return "failed";
  }
}
