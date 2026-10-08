// The gate's two checks: the invite code against the secret, and the cookie that remembers a
// phone. The cookie holds only the day it was given and a signature: nothing about the visitor.

/** The `__Host-` prefix makes the browser refuse it unless it is Secure, on Path=/, with no Domain. */
export const COOKIE = "__Host-japacity-gate";
export const YEAR_SECONDS = 31_536_000;

const encoder = new TextEncoder();
const LABEL = "japacity-gate/v1/";
const VALUE = /^(\d{1,12})\.([A-Za-z0-9_-]{43})$/;

async function digest(text: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", encoder.encode(text));
}

/** Both sides are hashed first so the comparison takes the same time whatever the code's length. */
export async function codeMatches(code: string, secret: string): Promise<boolean> {
  if (secret === "") return false;
  const [given, held] = await Promise.all([digest(code), digest(secret)]);
  return crypto.subtle.timingSafeEqual(given, held);
}

function signingKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

function toBase64Url(bytes: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** The Set-Cookie header for a phone admitted at `now` (seconds). */
export async function cookieFor(secret: string, now: number): Promise<string> {
  const issued = String(now);
  const signature = await crypto.subtle.sign("HMAC", await signingKey(secret), encoder.encode(`${LABEL}${issued}`));
  return `${COOKIE}=${issued}.${toBase64Url(signature)}; Max-Age=${String(YEAR_SECONDS)}; Path=/; Secure; HttpOnly; SameSite=Lax`;
}

function ourValue(cookieHeader: string): string | null {
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) return rest.join("=");
  }
  return null;
}

/** True when the request's Cookie header holds our cookie, signed with this secret, given within the last year. */
export async function admits(cookieHeader: string | null, secret: string, now: number): Promise<boolean> {
  if (secret === "" || cookieHeader === null) return false;
  const value = ourValue(cookieHeader);
  const match = value === null ? null : VALUE.exec(value);
  if (match === null) return false;
  const [, issued = "", signature = ""] = match;
  const age = now - Number(issued);
  if (age < 0 || age > YEAR_SECONDS) return false;
  // verify compares in constant time.
  return crypto.subtle.verify("HMAC", await signingKey(secret), fromBase64Url(signature), encoder.encode(`${LABEL}${issued}`));
}
