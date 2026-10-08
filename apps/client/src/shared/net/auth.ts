// Signing in, the age screen's answer and deleting the account, behind one
// seam so the screens never touch the auth library and tests fake it whole.
// Better Auth's client, version 1.7, as its docs describe it (read 8 Oct 2026):
// https://www.better-auth.com/docs/concepts/client
// https://www.better-auth.com/docs/plugins/email-otp
// https://www.better-auth.com/docs/plugins/passkey
// https://www.better-auth.com/docs/authentication/google
// https://www.better-auth.com/docs/plugins/captcha
// Deleting goes to the server's own `DELETE /api/account` (R-ACCOUNT-016), never the library's.
import { passkeyClient } from "@better-auth/passkey/client";
import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";

import {
  type AccountView,
  type AgeReply,
  type AgeRequest,
  type AgeStatus,
  type DeleteReply,
  type DeleteRequest,
  type GuestRequest,
  type NameProblem,
  type NameReply,
  type ServerCode,
  type ServerRejection,
  type UsernameRequest,
} from "./contract";
import { forgetAccount, putUsageCounts, readAccount } from "./account";
import { api, type Fetch } from "./http";

/**
 * `no-life`: a way in with no life behind it; a life starts as a guest (R-ACCOUNT-021, R-ACCOUNT-029).
 * `taken`: that sign-in already has a life, so securing with it joins nothing (R-ACCOUNT-023).
 * `guest-only`: a passkey waits until the life is secured (R-ACCOUNT-023).
 * `passkey-first`: R-ACCOUNT-003's refusal of a new passkey on an admin account from a session not opened with a passkey.
 */
export type AuthFailure = "not-fresh" | "bad-code" | "wrong-code" | "expired" | "too-many" | "cancelled" | "unreachable" | "refused" | "no-life" | "taken" | "guest-only" | "passkey-first";

export type AuthResult = { ok: true } | { ok: false; why: AuthFailure };

export type AgeStanding = "unasked" | "passed" | "refused" | "region-closed";

/** R-SERVER-032: sign-ups are switched off; ask again after `retryAfter` seconds. */
export interface Full {
  full: true;
  retryAfter: number;
}

/** What the age screen's answer can be beyond a standing: a date the server did not believe. */
export type AgeAnswer = AgeStanding | Full | "bad-date" | "bot-check";

/** Why a guest life was not started (R-ACCOUNT-013, 021, 024, 025): a username problem, the bot check, the flood limits, an age pass that ran out, or the server's own state. */
export type GuestFailure = NameProblem | "bot-check" | "too-many" | "expired" | "region-closed" | "full" | "unreachable" | "refused";

export type GuestAnswer = { ok: true } | { ok: false; why: GuestFailure };

/** Why a username change was refused (R-ACCOUNT-024). */
export type NameAnswer = { ok: true } | { ok: false; why: NameProblem | "unreachable" | "refused" };

export interface AccountApi {
  /** R-ACCOUNT-011, R-ACCOUNT-012, R-SERVER-032: where this browser stands before any sign-in method. */
  ageStatus(): Promise<AgeStanding | Full>;
  /** R-ACCOUNT-012: sends the date as typed. The server decides and keeps no date of birth. */
  declareAge(birth: string): Promise<AgeAnswer>;
  /** R-ACCOUNT-002. `bot` is the Turnstile token, sent wherever an account could be made (R-ACCOUNT-013). */
  sendCode(email: string, bot: string | null): Promise<AuthResult>;
  signInWithCode(email: string, code: string, bot: string | null): Promise<AuthResult>;
  /** R-ACCOUNT-021, 013: `POST /api/guest` with the username and the bot check's token, after the age screen. */
  startGuest(username: string, bot: string | null): Promise<GuestAnswer>;
  /** The account as the server says it now, or null when it cannot say. */
  view(): Promise<AccountView | null>;
  /** R-ACCOUNT-024: `PUT /api/account/username`. */
  rename(username: string): Promise<NameAnswer>;
  /**
   * Leaves the page for Google and comes back signed in. From a guest's
   * session this secures the guest (R-ACCOUNT-023); a refusal comes back as
   * `?error=` on the page, read by `returnedFromGoogle`.
   */
  signInWithGoogle(bot: string | null): Promise<AuthResult>;
  /** What the last trip to Google came back with, once: null when it went through or there was none. */
  returnedFromGoogle(): AuthFailure | null;
  signInWithPasskey(): Promise<AuthResult>;
  /** R-ACCOUNT-003: only from a signed-in session. */
  addPasskey(): Promise<AuthResult>;
  /** The signed-in account's email, where it has one. */
  email(): Promise<string | null>;
  /** R-ANALYTICS-006: the account's "Send usage counts", or null when the server does not say. */
  usageCounts(): Promise<boolean | null>;
  /** R-ANALYTICS-006: true once the server keeps the new setting. */
  setUsageCounts(on: boolean): Promise<boolean>;
  /**
   * R-ACCOUNT-016: `DELETE /api/account`. `code`, the email code sent with `sendCode`, confirms a
   * session that is no longer fresh. `not-fresh`: sign in again or send a code; `bad-code`: that code did not work.
   */
  deleteAccount(code: string | null): Promise<AuthResult>;
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
  "method-taken": "taken",
  // apps/server/src/account/signup.ts: a way in that would make a new account; a life starts as a guest.
  "no-account": "no-life",
  "guest-only": "guest-only",
  SESSION_NOT_FRESH: "not-fresh",
  INVALID_OTP: "wrong-code",
  OTP_EXPIRED: "expired",
  TOO_MANY_ATTEMPTS: "too-many",
  AUTH_CANCELLED: "cancelled",
  REGISTRATION_CANCELLED: "cancelled",
};

function failure(error: LibraryError, byStatus: Partial<Record<number, AuthFailure>>): AuthFailure {
  const known = error.code === undefined ? undefined : FAILURES[error.code];
  return known ?? byStatus[error.status] ?? (error.status === 429 ? "too-many" : "refused");
}

/** `byStatus`: what a status means for this one route, where its code says nothing more. */
async function attempt(run: () => Promise<{ error: LibraryError | null }>, byStatus: Partial<Record<number, AuthFailure>> = {}): Promise<AuthResult> {
  try {
    const { error } = await run();
    return error === null ? { ok: true } : { ok: false, why: failure(error, byStatus) };
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

/** The server's answer to `POST /api/guest` as the username screen tells it. */
export function guestAnswer(reply: NameReply): GuestAnswer {
  if (reply.ok) return { ok: true };
  if (reply.name !== undefined) return { ok: false, why: reply.name };
  const said: Partial<Record<ServerCode, GuestFailure>> = { "bot-check": "bot-check", "too-many": "too-many", "rate-limited": "too-many", expired: "expired", "region-closed": "region-closed", "switched-off": "full" };
  return { ok: false, why: said[reply.code] ?? "refused" };
}

/** The server's answer to `DELETE /api/account` as the settings tell it. */
export function deleted(reply: DeleteReply): AuthResult {
  if (reply.ok) return { ok: true };
  if (reply.code === "not-fresh" || reply.code === "bad-code") return { ok: false, why: reply.code };
  // Every other refusal, `signed-out` among them, is said as a plain one.
  return { ok: false, why: reply.code === "rate-limited" ? "too-many" : "refused" };
}

/** Reads the server's 503 for the age screen while sign-ups are off; anything else leaves the screen to ask. */
function switchedOff(reply: unknown, status: number): Full | null {
  if (status !== 503 || typeof reply !== "object" || reply === null) return null;
  const refusal = reply as Partial<ServerRejection>;
  return refusal.code === "switched-off" ? { full: true, retryAfter: refusal.retryAfter ?? FULL_RETRY_FALLBACK_S } : null;
}

export function betterAuthApi({ baseUrl, fetch }: { baseUrl: string; fetch?: Fetch }): AccountApi {
  const base = baseUrl.replace(/\/+$/, "");
  const send: Fetch = fetch ?? ((input, init) => globalThis.fetch(input, init));
  const server = api({ baseUrl: base, fetch: send });
  // the server mounts Better Auth at /api/auth, its default base path.
  const client = createAuthClient({
    baseURL: `${base}/api/auth`,
    // The seam's own fetch, so a test's stand-in server answers the library's routes too.
    fetchOptions: { credentials: "include", customFetchImpl: (input, init) => send(input instanceof Request ? input.url : String(input), init) },
    plugins: [emailOTPClient(), passkeyClient()],
  });
  const home = () => (typeof location === "undefined" ? "/" : `${location.origin}/`);
  const google = () => ({ provider: "google" as const, callbackURL: home(), errorCallbackURL: home() });

  return {
    async ageStatus() {
      // `GET /api/age` reads the server's refusal cookie (R-ACCOUNT-012); its switch gate answers 503 first while sign-ups are off (R-SERVER-031).
      try {
        const response = await send(`${base}/api/age`, { method: "GET", credentials: "include", headers: { accept: "application/json" } });
        const reply: unknown = await response.json().catch(() => null);
        const closed = switchedOff(reply, response.status);
        if (closed !== null) return closed;
        if (typeof reply === "object" && reply !== null && (reply as Partial<ServerRejection>).code === "region-closed") return "region-closed";
        if (response.ok && (reply as Partial<AgeStatus> | null)?.refused === true) return "refused";
      } catch {
        // Unreachable now: the age screen says so when it sends.
      }
      return "unasked";
    },
    async declareAge(birth) {
      const request: AgeRequest = { dateOfBirth: birth };
      const response = await send(`${base}/api/age`, {
        method: "POST",
        credentials: "include",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      const reply = (await response.json()) as AgeReply;
      return standing(reply);
    },
    async startGuest(username, bot) {
      const request: GuestRequest = { username };
      try {
        const response = await send(`${base}/api/guest`, {
          method: "POST",
          credentials: "include",
          headers: { accept: "application/json", "content-type": "application/json", ...(bot === null ? {} : { [CAPTCHA_HEADER]: bot }) },
          body: JSON.stringify(request),
        });
        const reply = (await response.json()) as NameReply;
        forgetAccount(server);
        return guestAnswer(reply);
      } catch {
        return { ok: false, why: "unreachable" };
      }
    },
    async view() {
      forgetAccount(server);
      const reply = await readAccount(server);
      return reply.ok ? reply.account : null;
    },
    async rename(username) {
      const request: UsernameRequest = { username };
      try {
        const reply = await server.put<NameReply>("/api/account/username", request);
        forgetAccount(server);
        if (reply.ok) return { ok: true };
        return { ok: false, why: reply.name ?? "refused" };
      } catch {
        return { ok: false, why: "unreachable" };
      }
    },
    sendCode: (email, bot) => attempt(() => client.emailOtp.sendVerificationOtp({ email, type: "sign-in", fetchOptions: botHeaders(bot) })),
    signInWithCode: async (email, otp, bot) => {
      const result = await attempt(() => client.signIn.emailOtp({ email, otp, fetchOptions: botHeaders(bot) }));
      forgetAccount(server);
      return result;
    },
    signInWithGoogle: (bot) => attempt(() => client.signIn.social({ ...google(), fetchOptions: botHeaders(bot) })),
    returnedFromGoogle() {
      if (typeof location === "undefined") return null;
      const url = new URL(location.href);
      const error = url.searchParams.get("error");
      if (error === null) return null;
      url.searchParams.delete("error");
      url.searchParams.delete("error_description");
      if (typeof history !== "undefined") history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      return FAILURES[error] ?? "refused";
    },
    // A button, not the browser's autofill: autofill needs a field this game does not have.
    signInWithPasskey: () => attempt(() => client.signIn.passkey({ autoFill: false })),
    // R-ACCOUNT-003: the server's only 403 on a passkey's registration is the admin's, which needs a passkey session (apps/server/src/auth/hooks.ts).
    addPasskey: () => attempt(() => client.passkey.addPasskey({}), { 403: "passkey-first" }),
    async email() {
      try {
        const { data } = await client.getSession();
        return data?.user.email ?? null;
      } catch {
        return null;
      }
    },
    async usageCounts() {
      const reply = await readAccount(server);
      return reply.ok ? (reply.account.sendUsageCounts ?? null) : null;
    },
    async setUsageCounts(on) {
      return (await putUsageCounts(server, on)).ok;
    },
    async deleteAccount(code) {
      const request: DeleteRequest = code === null ? {} : { code };
      try {
        const reply = await server.delete<DeleteReply>("/api/account", request);
        return deleted(reply);
      } catch {
        return { ok: false, why: "unreachable" };
      }
    },
    async signOut() {
      await attempt(() => client.signOut());
    },
  };
}
