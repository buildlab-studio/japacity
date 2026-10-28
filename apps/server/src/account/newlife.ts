// account:sign-in-without-secret, account:guest-secures-the-life: a new life kept with an email from the start. On the ways back
// in, an address no account uses is offered a new life with it: a code goes to it, and the right code proves the address
// before the life starts. The code is checked and spent in one step, as the auth library checks its own sign-in codes,
// and a proof of the address is kept in the library's verification table under its own prefix, holding the address
// alone, for 30 minutes, and named only by an httpOnly cookie on this browser. The guest start consumes it.
// https://better-auth.com/docs/plugins/email-otp
import { time, toHex } from "@japacity/sim";
import type { AuthContext } from "better-auth";

import { readCookie } from "./age";

/** The body field of a code's send that asks for a new life with the address: the send then skips the account check and refuses an address an account uses. */
export const NEW_LIFE_MARK = "newLife";

/** The cookie that names this browser's proof; never in a URL or the page's storage. */
export const NEW_LIFE_COOKIE = "japacity-new-life";

/** The verification-row prefix of a proof. */
export const NEW_LIFE_PREFIX = "japacity-new-life-";

/** How long a proof waits for the guest start: the age screen and the door, with room to read. */
export const NEW_LIFE_TTL_MS = 30 * time.MINUTE_MS;

/** The cookie's path: the guest start that reads it and the route that sets it, as the age pass's. */
export const NEW_LIFE_COOKIE_PATH = "/api";

type Internal = AuthContext["internalAdapter"];

/** What a code checked here came to: the library's own answers, in the game's words. */
export type CodeSpent = "ok" | "wrong" | "expired" | "used-up";

/** The library's identifier of a sign-in code for an address (its email-otp `toOTPIdentifier`). */
function codeIdentifier(email: string): string {
  return `sign-in-otp-${email}`;
}

/** A code as the library stores it with `storeOTP: "hashed"`: SHA-256, base64url with no padding. */
async function codeHash(code: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code)));
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Two texts compared in a time that does not depend on where they differ. */
function sameText(one: string, two: string): boolean {
  if (one.length !== two.length) return false;
  let differ = 0;
  for (let at = 0; at < one.length; at += 1) differ |= one.charCodeAt(at) ^ two.charCodeAt(at);
  return differ === 0;
}

/**
 * account:email-code-is-short-lived: checks and spends a sign-in code in one step, as the library's `atomicVerifyOTP` does: an
 * expired code is deleted; the row is consumed before it is judged, so a right code is accepted once; a wrong one is put
 * back with one more try counted, and a code whose tries are used up stays consumed. The library's `check-verification-otp`
 * is never used: it leaves the code usable.
 */
export async function spendCode(internal: Internal, email: string, code: string, allowed: number, now: number): Promise<CodeSpent> {
  const identifier = codeIdentifier(email);
  const existing = await internal.findVerificationValue(identifier);
  if (existing !== null && new Date(existing.expiresAt).getTime() < now) {
    await internal.deleteVerificationByIdentifier(identifier);
    return "expired";
  }
  const consumed = await internal.consumeVerificationValue(identifier);
  if (consumed === null) return "wrong";
  const at = consumed.value.lastIndexOf(":");
  const stored = at === -1 ? consumed.value : consumed.value.slice(0, at);
  const used = Number.parseInt(at === -1 ? "0" : consumed.value.slice(at + 1), 10) || 0;
  if (used >= allowed) return "used-up";
  if (!sameText(await codeHash(code), stored)) {
    await internal.createVerificationValue({ identifier, value: `${stored}:${String(used + 1)}`, expiresAt: consumed.expiresAt });
    return "wrong";
  }
  return "ok";
}

/** Keeps a proof of `email` for 30 minutes; returns the cookie's value that names it. */
export async function keepProof(internal: Internal, email: string, now: number, bytes: (count: number) => Uint8Array): Promise<string> {
  const nonce = toHex(bytes(16));
  await internal.createVerificationValue({ identifier: NEW_LIFE_PREFIX + nonce, value: email, expiresAt: new Date(now + NEW_LIFE_TTL_MS) });
  return nonce;
}

/** A proof taken from the table: the address it holds, and its row as it stood, so a start refused after taking it can put it back. */
export interface Proof {
  email: string;
  identifier: string;
  expiresAt: Date;
}

/** The live proof named by this request's cookie, consumed; null with no cookie, a spent proof or an expired one. */
export async function takeProof(internal: Internal, cookie: string | null | undefined, now: number): Promise<Proof | null> {
  const nonce = readCookie(cookie, NEW_LIFE_COOKIE);
  if (nonce === null || nonce === "") return null;
  const identifier = NEW_LIFE_PREFIX + nonce;
  const proof = await internal.consumeVerificationValue(identifier);
  if (proof === null || new Date(proof.expiresAt).getTime() <= now) return null;
  return { email: proof.value, identifier, expiresAt: new Date(proof.expiresAt) };
}

/** A proof taken by a start that was then refused, put back as it stood: the same row, address and expiry, so the next Begin still starts kept. */
export async function putProofBack(internal: Internal, proof: Proof | null): Promise<void> {
  if (proof === null) return;
  await internal.createVerificationValue({ identifier: proof.identifier, value: proof.email, expiresAt: proof.expiresAt });
}
