// Signing in, the age screen's answer and deleting the account, behind one
// seam so the screens never touch the auth library and tests fake it whole.
// Better Auth's client, version 1.7, as its docs describe it (read 8 Oct 2026):
// https://www.better-auth.com/docs/concepts/client
// https://www.better-auth.com/docs/plugins/email-otp
// https://www.better-auth.com/docs/plugins/passkey
// https://www.better-auth.com/docs/authentication/google
// https://www.better-auth.com/docs/plugins/captcha
// Deleting goes to the server's own `DELETE /api/account` (account:player-deletes-account), never the library's.
import { passkeyClient } from "@better-auth/passkey/client";
import type {
  AccountView,
  AgeReply,
  AgeRequest,
  AgeStatus,
  DeleteReply,
  DeleteRequest,
  GuestRequest,
  NameProblem,
  NameReply,
  ServerCode,
  ServerRejection,
  UsernameRequest,
} from "@japacity/api";
import { createAuthClient } from "better-auth/client";
import { emailOTPClient } from "better-auth/client/plugins";

import { forgetAccount, putUsageCounts, readAccount } from "./account";
import { api, type Fetch, pageFetch, requestFetch } from "./http";
import { providerOf } from "./providers";
import { pageWall, type WallGuard } from "./wall";

/**
 * `no-life`: a way in with no life behind it; a life starts as a guest (account:guest-and-secured-states, account:start-screen-over-live-city).
 * `taken`: that sign-in already has a life, so securing with it joins nothing (account:guest-secures-the-life).
 * `guest-only`: a passkey waits until the life is secured (account:guest-secures-the-life).
 * `passkey-first`: account:passkey-needs-signed-in-session's refusal of a new passkey on an admin account from a session not opened with a passkey.
 * `not-linked`: Google on an address whose life was kept by a code, where the library would not join the two
 * (its `account_not_linked`); the player is pointed to the code (account:guest-secures-the-life).
 * `already-here`: this phone already holds a passkey for the account; `passkey-gone`: the phone offered a passkey the
 * account no longer has; `other-account`: the phone answered with a passkey of another account, never sent on
 * (account:passkey-errors-told-apart, account:player-deletes-account).
 * `sign-out`: a sign-out that did not reach the server (account:sign-out-ends-the-session).
 */
type AuthFailure =
  | "not-fresh"
  | "bad-code"
  | "wrong-code"
  | "expired"
  | "too-many"
  | "cancelled"
  | "unreachable"
  | "refused"
  | "no-life"
  | "taken"
  | "guest-only"
  | "passkey-first"
  | "not-linked"
  | "already-here"
  | "passkey-gone"
  | "other-account"
  | "sign-out";

/** Why the page leaves for Google: to keep a guest's life (account:guest-secures-the-life), or to sign back in to a kept one. */
type GoogleTrip = "keep" | "sign-in";

/** A trip to Google that went through: the guest's life kept, or a kept life signed back in to. */
type GoogleDone = "kept" | "signed-in";

export type AuthResult = { ok: true } | { ok: false; why: AuthFailure };

/** account:passkeys-listed-and-removed: one passkey of the signed-in account as its sheet lists it. */
export interface PasskeyRow {
  /** The passkey row's id, which removing it names. */
  id: string;
  /** The provider's name from the passkey's AAGUID, or null where the authenticator does not say (an iPhone's, among others). */
  provider: string | null;
  /** When it was added, in ms since 1970. */
  addedAt: number;
}

/** account:passkeys-listed-and-removed: a passkey removed, and whether this phone's session lived through it. */
export type RemoveAnswer = { ok: true; signedIn: boolean } | { ok: false; why: AuthFailure };

export type AgeStanding = "unasked" | "passed" | "refused";

/** server:signups-off-shows-full: sign-ups are switched off; ask again after `retryAfter` seconds. */
export interface Full {
  full: true;
  retryAfter: number;
}

/** What the age screen's answer can be beyond a standing: a date the server did not believe. */
export type AgeAnswer = AgeStanding | Full | "bad-date" | "bot-check";

/** Why a guest life was not started (account:bot-check-on-guest-creation, account:guest-and-secured-states, account:username-and-unconfirmed-email, account:guest-floods-are-capped): a username problem, the bot check, the flood limits, an age pass that ran out, or the server's own state. */
export type GuestFailure = NameProblem | "bot-check" | "too-many" | "expired" | "full" | "unreachable" | "refused";

export type GuestAnswer = { ok: true } | { ok: false; why: GuestFailure };

/** Why a username change was refused (account:username-and-unconfirmed-email). */
type NameAnswer = { ok: true } | { ok: false; why: NameProblem | "unreachable" | "refused" };

export interface AccountApi {
  /** account:sign-up-open-everywhere, account:age-screen-refuses-minors, server:signups-off-shows-full: where this browser stands before any sign-in method. */
  ageStatus(): Promise<AgeStanding | Full>;
  /** account:age-screen-refuses-minors: sends the date as typed. The server decides and keeps no date of birth. */
  declareAge(birth: string): Promise<AgeAnswer>;
  /** account:email-code-is-short-lived. `bot` is the Turnstile token, sent wherever an account could be made (account:bot-check-on-guest-creation). */
  sendCode(email: string, bot: string | null): Promise<AuthResult>;
  signInWithCode(email: string, code: string, bot: string | null): Promise<AuthResult>;
  /** account:guest-and-secured-states, account:bot-check-on-guest-creation: `POST /api/guest` with the username and the bot check's token, after the age screen. */
  startGuest(username: string, bot: string | null): Promise<GuestAnswer>;
  /** The account as the server says it now, or null when it cannot say. */
  view(): Promise<AccountView | null>;
  /** account:username-and-unconfirmed-email: `PUT /api/account/username`. */
  rename(username: string): Promise<NameAnswer>;
  /**
   * Leaves the page for Google and comes back signed in. From a guest's
   * session this secures the guest (account:guest-secures-the-life), `trip` "keep"; a refusal
   * comes back as `?error=` on the page and a success as `?google=` with the
   * trip, both read by `returnedFromGoogle`.
   */
  signInWithGoogle(bot: string | null, trip?: GoogleTrip): Promise<AuthResult>;
  /** What the last trip to Google came back with, once: a failure, a success by its trip, or null when there was none. */
  returnedFromGoogle(): AuthFailure | GoogleDone | null;
  signInWithPasskey(): Promise<AuthResult>;
  /** account:passkey-in-email-autofill: the passkey offered in the email field's autofill; resolves once one is picked, or with why it stopped. */
  signInWithPasskeyAutofill?(): Promise<AuthResult>;
  /** account:passkey-needs-signed-in-session: only from a signed-in session; a session older than the server's fresh age is told `not-fresh`. */
  addPasskey(): Promise<AuthResult>;
  /** account:passkey-offered-where-it-works: whether this browser can make a passkey on this phone or through a phone nearby. */
  passkeysWork(): Promise<boolean>;
  /** account:passkeys-listed-and-removed: the signed-in account's passkeys, oldest first, or null when the server cannot say. */
  passkeys(): Promise<PasskeyRow[] | null>;
  /** account:passkeys-listed-and-removed: removes one of the account's passkeys. */
  removePasskey(id: string): Promise<RemoveAnswer>;
  /**
   * account:player-deletes-account, account:passkey-needs-signed-in-session: signs in again with one of the signed-in account's own
   * passkeys, for a fresh session. The phone's answer is checked against the account's passkeys before it goes to the
   * server, so a passkey of another account never opens a session here (`other-account`).
   */
  confirmWithPasskey(): Promise<AuthResult>;
  /** The signed-in account's email, where it has one. */
  email(): Promise<string | null>;
  /** analytics:player-can-stop-usage-counts: the account's "Send usage counts", or null when the server does not say. */
  usageCounts(): Promise<boolean | null>;
  /** analytics:player-can-stop-usage-counts: true once the server keeps the new setting. */
  setUsageCounts(on: boolean): Promise<boolean>;
  /**
   * account:player-deletes-account: `DELETE /api/account`. `code`, the email code sent with `sendCode`, confirms a
   * session that is no longer fresh. `not-fresh`: sign in again or send a code; `bad-code`: that code did not work.
   */
  deleteAccount(code: string | null): Promise<AuthResult>;
  /** account:sign-out-ends-the-session: ends this session on the server; `sign-out` when the server was not reached. */
  signOut(): Promise<AuthResult>;
  /** account:sign-out-ends-the-session: ends every session of the account, this one too. */
  signOutEverywhere(): Promise<AuthResult>;
}

/** The header Better Auth's captcha plugin reads the Turnstile token from. */
export const CAPTCHA_HEADER = "x-captcha-response";

interface LibraryError {
  code?: string | undefined;
  status: number;
}

/** The refusal the seam itself gives a passkey of another account, in place of the server's answer (account:player-deletes-account). */
const OTHER_ACCOUNT = "OTHER_ACCOUNT";

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
  // account:passkey-errors-told-apart: SimpleWebAuthn's codes. The browser's NotAllowedError (a cancel, a timeout, no passkey found)
  // comes through as the pass-through code; an abort as the ceremony's.
  ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY: "cancelled",
  ERROR_CEREMONY_ABORTED: "cancelled",
  ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED: "already-here",
  PASSKEY_NOT_FOUND: "passkey-gone",
  [OTHER_ACCOUNT]: "other-account",
  // The library's OAuth callback says its refusal with spaces made underscores (better-auth's oauth2/link-account).
  account_not_linked: "not-linked",
};

/**
 * The mark Google's callback carries back on a success: the library sends the page to the `callbackURL` it was given,
 * so the trip's own answer rides in that address, and a refusal goes to `errorCallbackURL` with `?error=` instead.
 */
const GOOGLE_BACK = "google";
const GOOGLE_DONE: Record<GoogleTrip, string> = { keep: "kept", "sign-in": "in" };

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

/** The parts of the WebAuthn statics this game asks for; each may be missing in an older browser, whatever the types say. */
interface PasskeyStatics {
  getClientCapabilities?: () => Promise<Record<string, boolean | undefined>>;
  isUserVerifyingPlatformAuthenticatorAvailable?: () => Promise<boolean>;
  signalUnknownCredential?: (options: { rpId: string; credentialId: string }) => Promise<void>;
}

function passkeyStatics(): PasskeyStatics | null {
  const statics = (globalThis as { PublicKeyCredential?: PasskeyStatics }).PublicKeyCredential;
  return typeof statics === "function" ? statics : null;
}

/**
 * account:passkey-offered-where-it-works: a passkey can be made where the phone has its own authenticator or can use a phone
 * nearby (https://developer.mozilla.org/en-US/docs/Web/API/PublicKeyCredential/getClientCapabilities_static); a
 * browser without the capabilities call is asked for its own authenticator alone.
 */
async function passkeysWork(): Promise<boolean> {
  const statics = passkeyStatics();
  if (statics === null) return false;
  try {
    if (statics.getClientCapabilities !== undefined) {
      const can = await statics.getClientCapabilities();
      return can["passkeyPlatformAuthenticator"] === true || can["hybridTransport"] === true;
    }
    return (await statics.isUserVerifyingPlatformAuthenticatorAvailable?.()) === true;
  } catch {
    return false;
  }
}

/**
 * account:passkey-errors-told-apart: a passkey the server no longer holds is named to the phone, so its list stops offering it
 * (https://developer.chrome.com/docs/identity/webauthn-signal-api). The relying party is the page's own host
 * (account:passkey-needs-signed-in-session). A browser without the call, or one that refuses it, changes nothing.
 */
function signalGone(credentialId: string): void {
  const signal = passkeyStatics()?.signalUnknownCredential;
  if (signal === undefined || typeof location === "undefined") return;
  void signal({ rpId: location.hostname, credentialId }).catch(() => undefined);
}

/** The credential id a passkey's verification carries in its body, or null. */
function credentialSent(init: RequestInit | undefined): string | null {
  if (typeof init?.body !== "string") return null;
  try {
    const id = (JSON.parse(init.body) as { response?: { id?: unknown } }).response?.id;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

/** One passkey row as the library's `/passkey/list-user-passkeys` answers it. */
interface LibraryPasskey {
  id: string;
  credentialID: string;
  aaguid?: string | null;
  createdAt?: string | Date | null;
}

function passkeyRow(row: LibraryPasskey): PasskeyRow {
  const added = row.createdAt === undefined || row.createdAt === null ? Number.NaN : new Date(row.createdAt).getTime();
  return { id: row.id, provider: providerOf(row.aaguid), addedAt: Number.isFinite(added) ? added : 0 };
}

/** server:signups-off-shows-full: the server's wait before asking again, from the refusal or its Retry-After header, in seconds. */
const FULL_RETRY_FALLBACK_S = 30;

function full(rejection: ServerRejection): Full {
  return { full: true, retryAfter: rejection.retryAfter ?? FULL_RETRY_FALLBACK_S };
}

/** The age screen's answer from `POST /api/age` (apps/server/src/routes/age.ts). */
export function standing(reply: AgeReply): AgeAnswer {
  if (reply.ok) return "passed";
  if (reply.code === "under-age") return "refused";
  if (reply.code === "switched-off") return full(reply);
  if (reply.code === "bad-date" || reply.code === "bot-check") return reply.code;
  // Anything else (a rate limit, a server fault) is a failure the screen says plainly.
  throw new Error(reply.detail);
}

/** The server's answer to `POST /api/guest` as the username screen tells it. */
function guestAnswer(reply: NameReply): GuestAnswer {
  if (reply.ok) return { ok: true };
  if (reply.name !== undefined) return { ok: false, why: reply.name };
  const said: Partial<Record<ServerCode, GuestFailure>> = { "bot-check": "bot-check", "too-many": "too-many", "rate-limited": "too-many", expired: "expired", "switched-off": "full" };
  return { ok: false, why: said[reply.code] ?? "refused" };
}

/** The server's answer to `DELETE /api/account` as the settings tell it. */
function deleted(reply: DeleteReply): AuthResult {
  if (reply.ok) return { ok: true };
  if (reply.code === "not-fresh" || reply.code === "bad-code") return { ok: false, why: reply.code };
  // Every other refusal, `signed-out` among them, is said as a plain one.
  return { ok: false, why: reply.code === "rate-limited" ? "too-many" : "refused" };
}

/** A refusal from `GET /api/age`: the server's 503 while sign-ups are off (server:signups-off-shows-full). */
function isRejection(reply: AgeStatus | ServerRejection): reply is ServerRejection {
  return "ok" in reply && reply.ok === false;
}

/**
 * `wall`: what a login wall sets off (account:session-is-secure-cookie), the page's one reload or a test's. Every request here, the auth
 * library's among them, goes through the one request function (engine:browser-authority-for-dev-only): its clock, same origin, no redirect
 * followed, a wall or no answer sorted by its kind.
 */
export function betterAuthApi({ baseUrl, fetch, wall = pageWall }: { baseUrl: string; fetch?: Fetch; wall?: WallGuard }): AccountApi {
  const base = baseUrl.replace(/\/+$/, "");
  const send: Fetch = fetch ?? pageFetch;
  const server = api({ baseUrl: base, fetch: send, wall });
  const classified = requestFetch(send, wall);
  // The server mounts Better Auth at /api/auth, its default base path.
  const client = createAuthClient({
    baseURL: `${base}/api/auth`,
    // The seam's own fetch, so a test's stand-in server answers the library's routes too.
    fetchOptions: { credentials: "same-origin", customFetchImpl: (input, init) => classified(input instanceof Request ? input.url : String(input), init) },
    plugins: [emailOTPClient(), passkeyClient()],
  });
  const home = () => (typeof location === "undefined" ? "/" : `${location.origin}/`);
  const google = (trip: GoogleTrip) => ({ provider: "google" as const, callbackURL: `${home()}?${GOOGLE_BACK}=${GOOGLE_DONE[trip]}`, errorCallbackURL: home() });

  /** The signed-in account's passkeys as the library keeps them, or null when the server cannot say. */
  async function ownPasskeys(): Promise<LibraryPasskey[] | null> {
    try {
      const { data, error } = await client.passkey.listUserPasskeys();
      return error === null && Array.isArray(data) ? (data as LibraryPasskey[]) : null;
    } catch {
      return null;
    }
  }

  /**
   * A passkey sign-in, from the button or the email field's autofill; `only`, the credential ids that may answer: any other is refused here, before it reaches the
   * server, so no session is opened for it. A passkey the server no longer holds is named to the phone.
   */
  async function passkeySignIn(only: ReadonlySet<string> | null, autoFill = false): Promise<AuthResult> {
    const guard = (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const id = credentialSent(init);
      if (only !== null && (id === null || !only.has(id))) {
        return Promise.resolve(new Response(JSON.stringify({ code: OTHER_ACCOUNT, message: "That passkey is not this account's." }), { status: 403, headers: { "content-type": "application/json" } }));
      }
      return classified(input instanceof Request ? input.url : String(input), init);
    };
    let sent: string | null = null;
    const result = await attempt(async () => {
      const answer = await client.signIn.passkey({ autoFill, returnWebAuthnResponse: true, fetchOptions: { customFetchImpl: guard } });
      // The library hands back the phone's answer, failed or not, when asked to.
      sent = (answer as { webauthn?: { response: { id: string } } }).webauthn?.response.id ?? null;
      return answer;
    });
    if (!result.ok && result.why === "passkey-gone" && sent !== null) signalGone(sent);
    return result;
  }

  return {
    async ageStatus() {
      // `GET /api/age` reads the server's refusal cookie (account:age-screen-refuses-minors); its switch gate answers 503 first while sign-ups are off (server:four-off-switches).
      try {
        const reply = await server.get<AgeStatus | ServerRejection>("/api/age");
        if (!isRejection(reply)) return reply.refused === true ? "refused" : "unasked";
        if (reply.code === "switched-off") return full(reply);
        return "unasked";
      } catch {
        // Unreachable now (a wall has already reloaded the page): the age screen says so when it sends.
        return "unasked";
      }
    },
    async declareAge(birth) {
      const request: AgeRequest = { dateOfBirth: birth };
      return standing(await server.post<AgeReply>("/api/age", request));
    },
    async startGuest(username, bot) {
      const request: GuestRequest = { username };
      try {
        const reply = await server.post<NameReply>("/api/guest", request, bot === null ? {} : { [CAPTCHA_HEADER]: bot });
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
    signInWithGoogle: (bot, trip = "sign-in") => attempt(() => client.signIn.social({ ...google(trip), fetchOptions: botHeaders(bot) })),
    returnedFromGoogle() {
      if (typeof location === "undefined") return null;
      const url = new URL(location.href);
      const error = url.searchParams.get("error");
      const done = url.searchParams.get(GOOGLE_BACK);
      if (error === null && done === null) return null;
      for (const name of ["error", "error_description", GOOGLE_BACK]) url.searchParams.delete(name);
      if (typeof history !== "undefined") history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      if (error !== null) return FAILURES[error] ?? "refused";
      if (done === GOOGLE_DONE.keep) return "kept";
      return done === GOOGLE_DONE["sign-in"] ? "signed-in" : null;
    },
    // The button: the browser's own prompt. The field's autofill is the ask below, which the button's cancels.
    signInWithPasskey: async () => {
      const result = await passkeySignIn(null);
      forgetAccount(server);
      return result;
    },
    signInWithPasskeyAutofill: async () => {
      const result = await passkeySignIn(null, true);
      forgetAccount(server);
      return result;
    },
    // account:passkey-needs-signed-in-session: the server's only 403 on a passkey's registration is the admin's, which needs a passkey session
    // (apps/server/src/auth/hooks.ts); its freshness refusal carries its own code. No name is sent: the library names the passkey in the
    // phone's list with the account's email already, and a name sent here would be stored again on the passkey's row.
    addPasskey: () => attempt(() => client.passkey.addPasskey({}), { 403: "passkey-first" }),
    passkeysWork,
    async passkeys() {
      const rows = await ownPasskeys();
      if (rows === null) return null;
      return rows.map(passkeyRow).sort((a, b) => a.addedAt - b.addedAt);
    },
    async removePasskey(id) {
      const result = await attempt(() => client.passkey.deletePasskey({ id }));
      if (!result.ok) return result;
      forgetAccount(server);
      // Removing a way in may end this phone's session with the others (account:session-is-secure-cookie): the game's
      // own account route says so with its signed-out refusal. A reply that cannot be read leaves the sheet where it is.
      const reply = await readAccount(server);
      return { ok: true, signedIn: reply.ok || reply.code !== "signed-out" };
    },
    async confirmWithPasskey() {
      const rows = await ownPasskeys();
      if (rows === null) return { ok: false, why: "unreachable" };
      if (rows.length === 0) return { ok: false, why: "refused" };
      const result = await passkeySignIn(new Set(rows.map((row) => row.credentialID)));
      forgetAccount(server);
      return result;
    },
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
      const result = await attempt(() => client.signOut());
      return result.ok ? result : { ok: false, why: "sign-out" };
    },
    async signOutEverywhere() {
      const ended = await attempt(() => client.revokeSessions());
      if (!ended.ok) return { ok: false, why: "sign-out" };
      // Every session is gone on the server; signing out drops this browser's cookie too, and a failure leaves only a dead one.
      await attempt(() => client.signOut());
      return { ok: true };
    },
  };
}
