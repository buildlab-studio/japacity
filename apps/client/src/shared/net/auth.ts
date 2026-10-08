// Signing in, the age screen's answer and deleting the account, behind one
// seam so the screens never touch the auth library and tests fake it whole.
// Better Auth's client, version 1.7, as its docs describe it (read 8 Oct 2026):
// https://www.better-auth.com/docs/concepts/client
// https://www.better-auth.com/docs/plugins/email-otp
// https://www.better-auth.com/docs/plugins/passkey
// https://www.better-auth.com/docs/authentication/google
// https://www.better-auth.com/docs/plugins/captcha
// https://www.better-auth.com/docs/concepts/users-accounts (deleting a user)
import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";

import { REFUSED_COOKIE, type AgeReply, type AgeRequest, type ServerRejection } from "./contract";
import type { Fetch } from "./http";

export type AuthFailure = "not-fresh" | "wrong-code" | "expired" | "too-many" | "cancelled" | "unreachable" | "refused";

export type AuthResult = { ok: true } | { ok: false; why: AuthFailure };

export type AgeStanding = "unasked" | "passed" | "refused" | "region-closed";

/** R-SERVER-032: sign-ups are switched off; ask again after `retryAfter` seconds. */
export interface Full {
  full: true;
  retryAfter: number;
}

/** What the age screen's answer can be beyond a standing: a date the server did not believe, or a bot check that did not pass. */
export type AgeAnswer = AgeStanding | Full | "bad-date" | "bot-check";

export interface AccountApi {
  /** R-ACCOUNT-011, R-ACCOUNT-012, R-SERVER-032: where this browser stands before any sign-in method. */
  ageStatus(): Promise<AgeStanding | Full>;
  /** R-ACCOUNT-012, R-ACCOUNT-013: sends the date as typed, with the bot check's token. The server decides and keeps no date of birth. */
  declareAge(birth: string, bot: string | null): Promise<AgeAnswer>;
  /** R-ACCOUNT-002. `bot` is the Turnstile token, sent wherever an account could be made (R-ACCOUNT-013). */
  sendCode(email: string, bot: string | null): Promise<AuthResult>;
  signInWithCode(email: string, code: string, bot: string | null): Promise<AuthResult>;
  /** Leaves the page for Google and comes back signed in. */
  signInWithGoogle(bot: string | null): Promise<AuthResult>;
  signInWithPasskey(): Promise<AuthResult>;
  /** R-ACCOUNT-003: only from a signed-in session. */
  addPasskey(): Promise<AuthResult>;
  /** The signed-in account's email, where it has one. */
  email(): Promise<string | null>;
  /** R-ACCOUNT-016: `not-fresh` when the session is too old and the player must sign in again first. */
  deleteAccount(): Promise<AuthResult>;
  signOut(): Promise<void>;
}

/** The header Better Auth's captcha plugin reads the Turnstile token from. */
export const CAPTCHA_HEADER = "x-captcha-response";

interface LibraryError {
  code?: string | undefined;
  status: number;
}

/** The library's error codes this game tells apart; every other one is a plain refusal. */
const FAILURES: Record<string, AuthFailure> = {
  SESSION_NOT_FRESH: "not-fresh",
  INVALID_OTP: "wrong-code",
  OTP_EXPIRED: "expired",
  TOO_MANY_ATTEMPTS: "too-many",
  AUTH_CANCELLED: "cancelled",
  REGISTRATION_CANCELLED: "cancelled",
};

function failure(error: LibraryError): AuthFailure {
  const known = error.code === undefined ? undefined : FAILURES[error.code];
  return known ?? (error.status === 429 ? "too-many" : "refused");
}

async function attempt(run: () => Promise<{ error: LibraryError | null }>): Promise<AuthResult> {
  try {
    const { error } = await run();
    return error === null ? { ok: true } : { ok: false, why: failure(error) };
  } catch {
    return { ok: false, why: "unreachable" };
  }
}

const botHeaders = (bot: string | null) => (bot === null ? {} : { headers: { [CAPTCHA_HEADER]: bot } });

/** R-SERVER-032: the server's wait before asking again, from the refusal or its Retry-After header, in seconds. */
const FULL_RETRY_FALLBACK_S = 30;

function full(rejection: ServerRejection): Full {
  return { full: true, retryAfter: rejection.retryAfter ?? FULL_RETRY_FALLBACK_S };
}

/** The age screen's answer from `POST /api/age` (apps/server/src/routes/age.ts). */
export function standing(reply: AgeReply): AgeAnswer {
  if (reply.ok) return "passed";
  if (reply.code === "region-closed") return "region-closed";
  if (reply.code === "under-age") return "refused";
  if (reply.code === "switched-off") return full(reply);
  if (reply.code === "bad-date" || reply.code === "bot-check") return reply.code;
  // Anything else (a rate limit, a server fault) is a failure the screen says plainly.
  throw new Error(reply.detail);
}

/** True when the page holds the server's refusal cookie (R-ACCOUNT-012): the screen refuses without asking again. */
export function refusedHere(cookie: string): boolean {
  return cookie.split(";").some((part) => part.trim().startsWith(`${REFUSED_COOKIE}=`));
}

/** Reads the server's 503 for the age screen while sign-ups are off; anything else leaves the screen to ask. */
function switchedOff(reply: unknown, status: number): Full | null {
  if (status !== 503 || typeof reply !== "object" || reply === null) return null;
  const refusal = reply as Partial<ServerRejection>;
  return refusal.code === "switched-off" ? { full: true, retryAfter: refusal.retryAfter ?? FULL_RETRY_FALLBACK_S } : null;
}

export function betterAuthApi({ baseUrl, fetch, cookie = () => (typeof document === "undefined" ? "" : document.cookie) }: { baseUrl: string; fetch?: Fetch; cookie?: () => string }): AccountApi {
  const base = baseUrl.replace(/\/+$/, "");
  const send: Fetch = fetch ?? ((input, init) => globalThis.fetch(input, init));
  // the server mounts Better Auth at /api/auth, its default base path.
  const client = createAuthClient({
    baseURL: `${base}/api/auth`,
    fetchOptions: { credentials: "include" },
    plugins: [emailOTPClient(), passkeyClient()],
  });
  const home = () => (typeof location === "undefined" ? "/" : `${location.origin}/`);

  return {
    async ageStatus() {
      if (refusedHere(cookie())) return "refused";
      // The server answers no read of the age screen; its switch gate does, with 503 while sign-ups are off (R-SERVER-031).
      try {
        const response = await send(`${base}/api/age`, { method: "GET", credentials: "include", headers: { accept: "application/json" } });
        const reply: unknown = await response.json().catch(() => null);
        const closed = switchedOff(reply, response.status);
        if (closed !== null) return closed;
        if (typeof reply === "object" && reply !== null && (reply as Partial<ServerRejection>).code === "region-closed") return "region-closed";
      } catch {
        // Unreachable now: the age screen says so when it sends.
      }
      return "unasked";
    },
    async declareAge(birth, bot) {
      const request: AgeRequest = { dateOfBirth: birth };
      const response = await send(`${base}/api/age`, {
        method: "POST",
        credentials: "include",
        headers: { accept: "application/json", "content-type": "application/json", ...(bot === null ? {} : { [CAPTCHA_HEADER]: bot }) },
        body: JSON.stringify(request),
      });
      const reply = (await response.json()) as AgeReply;
      return standing(reply);
    },
    sendCode: (email, bot) => attempt(() => client.emailOtp.sendVerificationOtp({ email, type: "sign-in", fetchOptions: botHeaders(bot) })),
    signInWithCode: (email, otp, bot) => attempt(() => client.signIn.emailOtp({ email, otp, fetchOptions: botHeaders(bot) })),
    signInWithGoogle: (bot) => attempt(() => client.signIn.social({ provider: "google", callbackURL: home(), fetchOptions: botHeaders(bot) })),
    // A button, not the browser's autofill: autofill needs a field this game does not have.
    signInWithPasskey: () => attempt(() => client.signIn.passkey({ autoFill: false })),
    addPasskey: () => attempt(() => client.passkey.addPasskey({})),
    async email() {
      try {
        const { data } = await client.getSession();
        return data?.user.email ?? null;
      } catch {
        return null;
      }
    },
    deleteAccount: () => attempt(() => client.deleteUser({})),
    async signOut() {
      await attempt(() => client.signOut());
    },
  };
}
