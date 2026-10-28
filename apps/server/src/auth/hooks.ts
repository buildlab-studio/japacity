// The auth library's request hooks: the code sends per email (account:sign-in-routes-rate-limited), a send only to an address
// an account uses, or one marked for a new life with it (account:sign-in-without-secret),
// the guest start reached only through the game's route (account:bot-check-on-guest-creation), no
// passkey for a guest (account:guest-secures-the-life), the other sessions that end when a method is
// removed (account:session-is-secure-cookie), who may add or remove a passkey and what each addition
// leaves behind (account:passkey-needs-signed-in-session), and the passkey step-up of a signed-in
// session (moderation:admin-view-for-admin-list).
// https://better-auth.com/docs/concepts/hooks
// https://better-auth.com/docs/concepts/rate-limit
// https://pages.nist.gov/800-63-4/sp800-63b/events/ (4.1.2.1, 4.6)
import { time, toHex } from "@japacity/sim";
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from "better-auth/api";

import { NEW_LIFE_MARK } from "../account/newlife";
import { GUEST_PATH } from "../account/signup";
import type { ServerDeps } from "../dependencies";
import { emailIdentity, isBanned } from "../moderation/identities";
import { leavePlaces } from "../postgres";
import type { AuthKeys } from "./auth";
import { passkeyShown } from "./session";
import type { SignedInWith } from "./session";

/** The library's rate-limit table, which the `database` store keeps (account:sign-in-routes-rate-limited). */
export const RATE_LIMIT_MODEL = "rateLimit";

/** Keys of the per-email rows; the address itself is never stored, only its hash. */
const EMAIL_LIMIT_PREFIX = "otp-email:";

/** The window of the per-email count, the same 60 seconds as the per-address one. */
export const EMAIL_LIMIT_WINDOW_MS = 60_000;

const SEND_PATH = "/email-otp/send-verification-otp";
const UNLINK_PATHS = new Set(["/unlink-account", "/passkey/delete-passkey"]);
const REVOKE_PATH = "/revoke-sessions";
const VERIFY_REGISTRATION_PATH = "/passkey/verify-registration";
const VERIFY_AUTHENTICATION_PATH = "/passkey/verify-authentication";
const REGISTER_PATHS = new Set(["/passkey/generate-register-options", VERIFY_REGISTRATION_PATH]);

export const ADMIN_PASSKEY_BIND_DETAIL = "A new passkey on an admin account is added only from a session that has shown a passkey; use yours first.";
export const ADMIN_REMOVAL_DETAIL = "A passkey or a linked sign-in on an admin account is removed only from a session that has shown a passkey; use yours first.";

/** The code and words of a passkey that belongs to another account than the signed-in one (moderation:admin-view-for-admin-list). */
export const OTHER_ACCOUNT = "other-account";
export const OTHER_ACCOUNT_DETAIL = "That passkey is for another account. Use the one for this account.";

/**
 * account:passkey-needs-signed-in-session: the audit rows that hold passkey registrations are filed
 * under this name instead of a character id; each row's note is a
 * `PasskeyNote` as JSON and its row lists are empty.
 */
export const PASSKEY_ROWS = "auth.passkeys";

/** account:passkey-needs-signed-in-session: one registration as the audit log keeps it, the account only as a hash (account:deletion-keeps-anonymous-totals). */
export interface PasskeyNote {
  /** `accountHash` of the account: a living account is found by hashing its id; a deleted one leaves nothing that names it. */
  accountHash: string;
  /** The passkey row's id. */
  passkey: string;
  /** Whether the account was on the admin list when the passkey was added. */
  admin: boolean;
  /** How the session that added it was opened. */
  signedInWith: SignedInWith;
}

type HookContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

interface LimitRow {
  key: string;
  count: number;
  lastRequest: number | bigint;
}

/**
 * account:passkey-needs-signed-in-session, account:deletion-keeps-anonymous-totals: the SHA-256 of an account id, as hex, the same hash the deletion audit keeps:
 * an id is random, so a plain hash names nobody, and a rotated secret never breaks the tie to older rows.
 */
export async function accountHash(account: string): Promise<string> {
  return sha256Hex(account);
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return toHex(new Uint8Array(digest));
}

/**
 * Keys of the per-email day rows, which cap the codes sent to one address in a
 * day so it cannot be sent codes without end. A day row's
 * `lastRequest` holds when its window ends, not when it began, so the prune of
 * rows 60 seconds past their last use keeps it for the whole day.
 */
const EMAIL_DAY_PREFIX = "otp-email-day:";

/** The window of the per-email day count. */
export const EMAIL_DAY_WINDOW_MS = time.DAY_MS;

type Adapter = HookContext["context"]["adapter"];

/** One counted window: whether it is full, and how to count a send in it. */
interface Window {
  over: (max: number) => boolean;
  write: () => Promise<unknown>;
}

async function minuteWindow(adapter: Adapter, key: string, now: number): Promise<Window> {
  const where = [{ field: "key", value: key }];
  const row = await adapter.findOne<LimitRow>({ model: RATE_LIMIT_MODEL, where });
  const fresh = row === null || now - Number(row.lastRequest) >= EMAIL_LIMIT_WINDOW_MS;
  return {
    over: (max) => !fresh && row.count >= max,
    write: () =>
      row === null
        ? adapter.create({ model: RATE_LIMIT_MODEL, data: { key, count: 1, lastRequest: now } })
        : adapter.update({ model: RATE_LIMIT_MODEL, where, update: fresh ? { count: 1, lastRequest: now } : { count: row.count + 1 } }),
  };
}

async function dayWindow(adapter: Adapter, key: string, now: number): Promise<Window> {
  const where = [{ field: "key", value: key }];
  const row = await adapter.findOne<LimitRow>({ model: RATE_LIMIT_MODEL, where });
  const fresh = row === null || now >= Number(row.lastRequest);
  return {
    over: (max) => !fresh && row.count >= max,
    write: () =>
      row === null
        ? adapter.create({ model: RATE_LIMIT_MODEL, data: { key, count: 1, lastRequest: now + EMAIL_DAY_WINDOW_MS } })
        : adapter.update({ model: RATE_LIMIT_MODEL, where, update: fresh ? { count: 1, lastRequest: now + EMAIL_DAY_WINDOW_MS } : { count: row.count + 1 } }),
  };
}

/**
 * account:sign-in-routes-rate-limited: at most `auth.limits.otpSendPer60s` code sends to one email
 * in 60 seconds, and at most `auth.limits.otpSendPerDay` in a day, from any
 * address. A refused send is counted in neither.
 */
async function limitEmailSends(deps: ServerDeps, ctx: HookContext): Promise<void> {
  if (ctx.path !== SEND_PATH) return;
  const body = ctx.body as { email?: unknown } | undefined;
  if (typeof body?.email !== "string") return;
  const hash = await sha256Hex(body.email.trim().toLowerCase());
  const adapter = ctx.context.adapter;
  const now = deps.now();
  const { otpSendPer60s, otpSendPerDay } = deps.config.auth.limits;
  const minute = await minuteWindow(adapter, EMAIL_LIMIT_PREFIX + hash, now);
  if (minute.over(otpSendPer60s)) throw new APIError("TOO_MANY_REQUESTS", { message: "Too many codes for this email. Try again in a minute." });
  const day = await dayWindow(adapter, EMAIL_DAY_PREFIX + hash, now);
  if (day.over(otpSendPerDay)) throw new APIError("TOO_MANY_REQUESTS", { message: "Too many codes for this email today. Try again tomorrow." });
  await minute.write();
  await day.write();
}

/**
 * account:sign-in-routes-rate-limited: the one send the game uses sends only sign-in codes. The library would also send a
 * code to verify an email, reset a password or change the email, which the game never asks for.
 */
function signInCodesOnly(ctx: HookContext): void {
  if (ctx.path !== SEND_PATH) return;
  if ((ctx.body as { type?: unknown } | undefined)?.type !== "sign-in") throw new APIError("BAD_REQUEST", { message: "Only a sign-in code is sent." });
}

/** The code a send to an address no account uses is refused with, and the code of a new life's send to an address one does. */
export const NO_ACCOUNT = "no-account";
export const EMAIL_TAKEN = "taken";

/**
 * account:sign-in-without-secret, account:email-code-is-short-lived: signed out, a code goes only where it can lead somewhere.
 * A send to an address no account uses is refused `no-account` and nothing is mailed; one marked for a new life with the
 * address (`NEW_LIFE_MARK`) skips that check and is refused `taken` where an account uses it (account:guest-secures-the-life).
 * Runs after the send limits, so every check is counted by them, a refused one too. A send from a live session (a guest
 * keeping its life, an account confirming itself) is not checked, and a banned address keeps its own answer at the sign-in
 * (moderation:ban-survives-as-hash).
 */
async function checkAddress(deps: ServerDeps, ctx: HookContext): Promise<void> {
  if (ctx.path !== SEND_PATH) return;
  const body = ctx.body as Record<string, unknown> | undefined;
  if (typeof body?.["email"] !== "string") return;
  if ((await getSessionFromCtx(ctx, { disableRefresh: true }).catch(() => null)) !== null) return;
  const email = body["email"].toLowerCase();
  if (await isBanned(deps, [emailIdentity(email)])) return;
  const used = (await ctx.context.internalAdapter.findUserByEmail(email)) !== null;
  if (body[NEW_LIFE_MARK] === true) {
    if (used) throw new APIError("FORBIDDEN", { code: EMAIL_TAKEN, message: "That email already has an account. Sign in instead." });
    return;
  }
  if (!used) throw new APIError("FORBIDDEN", { code: NO_ACCOUNT, message: "No account uses this email." });
}

/** How the request's session was opened, from the field the session hook set (session.ts). */
function openedWith(session: { session: Record<string, unknown> }): SignedInWith {
  const method = session.session["signedInWith"];
  return method === "passkey" || method === "passkey-unverified" || method === "email-code" || method === "google" ? method : "other";
}

/**
 * account:passkey-needs-signed-in-session, moderation:admin-view-for-admin-list: an account on the admin list that already
 * holds a passkey adds another only from a session that has shown a passkey.
 * Checked when the options are asked for and again at the verification,
 * which is where the passkey is stored. Removing one of its passkeys or a linked sign-in needs the same session, or
 * whoever got into the admin's email would remove the admin's passkey and then add their own as the first.
 */
async function guardAdminPasskeys(deps: ServerDeps, ctx: HookContext): Promise<void> {
  const path = ctx.path ?? "";
  const adding = REGISTER_PATHS.has(path);
  if (!adding && !UNLINK_PATHS.has(path)) return;
  const session = await getSessionFromCtx(ctx);
  if (session === null || !deps.config.admin.accounts.includes(session.user.id)) return;
  if (passkeyShown(session.session, deps.now(), deps.config.admin.passkeyMs)) return;
  const held = await ctx.context.adapter.count({ model: "passkey", where: [{ field: "userId", value: session.user.id }] });
  if (held > 0) throw new APIError("FORBIDDEN", { message: adding ? ADMIN_PASSKEY_BIND_DETAIL : ADMIN_REMOVAL_DETAIL });
}

/**
 * The library's routes the game never calls that would write or send something, each by the rule it would get around:
 * the password, its reset and linking a method outside the sign-in routes the game uses (account:sign-in-without-secret),
 * the email change and the code routes past the one send the game uses (account:sign-in-routes-rate-limited), a name,
 * a picture or a passkey's name (account:only-needed-data-kept), ending sessions outside sign-out or listing them with
 * their tokens to page script (account:session-is-secure-cookie), deleting outside the game's deletion route (account:player-deletes-account), and
 * Google's tokens, which no account keeps (account:only-needed-data-kept).
 * Matched on the library's own route, so no spelling of the address reaches one.
 */
export const CLOSED_PATHS: ReadonlySet<string> = new Set([
  "/request-password-reset",
  "/reset-password",
  "/reset-password/:token",
  "/change-password",
  "/verify-password",
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
  "/email-otp/reset-password",
  "/change-email",
  "/email-otp/request-email-change",
  "/email-otp/change-email",
  "/send-verification-email",
  "/verify-email",
  "/email-otp/verify-email",
  "/email-otp/check-verification-otp",
  "/update-user",
  "/passkey/update-passkey",
  "/link-social",
  "/update-session",
  "/revoke-session",
  "/revoke-other-sessions",
  "/list-sessions",
  "/delete-user",
  "/delete-user/callback",
  "/delete-anonymous-user",
  "/account-info",
  "/get-access-token",
  "/refresh-token",
]);

/** A browser's call to a closed route answers 404 before the library runs it; the server's own calls (the deletion route's) pass. */
function closedRouteCheck(ctx: HookContext): void {
  if (CLOSED_PATHS.has(ctx.path ?? "") && ctx.request !== undefined) throw new APIError("NOT_FOUND", { message: "Not found." });
}

/** account:bot-check-on-guest-creation, account:guest-floods-are-capped: the anonymous sign-in is reached only through `POST /api/guest`, with its bot check and limits; a browser's own call is refused. */
function guestStartCheck(ctx: HookContext): void {
  if (ctx.path === GUEST_PATH && ctx.request !== undefined) throw new APIError("NOT_FOUND", { message: "Start a life through the guest start." });
}

/** account:guest-secures-the-life: a passkey is registered only once the account is secured. */
async function guardGuestPasskeys(ctx: HookContext): Promise<void> {
  if (!REGISTER_PATHS.has(ctx.path ?? "")) return;
  const session = await getSessionFromCtx(ctx, { disableRefresh: true }).catch(() => null);
  if ((session?.user as { isAnonymous?: unknown } | undefined)?.isAnonymous === true) {
    throw new APIError("FORBIDDEN", { code: "guest-only", message: "Secure this life with Google or an email code first; then add a passkey." });
  }
}

/** The credential id a passkey assertion names, as the passkey row stores it. */
function assertedCredential(body: unknown): string | null {
  const id = (body as { response?: { id?: unknown } } | undefined)?.response?.id;
  return typeof id === "string" && id !== "" ? id : null;
}

/**
 * moderation:admin-view-for-admin-list: a passkey shown from a browser signed in to a kept account steps that account up,
 * so it must be one of that account's own passkeys; another account's is refused before anything is verified or opened.
 * A browser signed out, or holding a dead cookie (dropped before the library, stale.ts), signs in as ever, and a guest's
 * sign-in to another account is refused by the session hook (account:guest-secures-the-life).
 */
async function guardStepUp(ctx: HookContext): Promise<void> {
  if (ctx.path !== VERIFY_AUTHENTICATION_PATH) return;
  const credential = assertedCredential(ctx.body);
  if (credential === null) return;
  const session = await getSessionFromCtx(ctx, { disableRefresh: true });
  if (session === null || (session.user as { isAnonymous?: unknown }).isAnonymous === true) return;
  const passkey = await ctx.context.adapter.findOne<{ userId: string }>({ model: "passkey", where: [{ field: "credentialID", value: credential }] });
  if (passkey !== null && passkey.userId !== session.user.id) throw new APIError("FORBIDDEN", { code: OTHER_ACCOUNT, message: OTHER_ACCOUNT_DETAIL });
}

/** The hooks run before every library route. */
export function beforeAuth(deps: ServerDeps) {
  return createAuthMiddleware(async (ctx) => {
    closedRouteCheck(ctx);
    guestStartCheck(ctx);
    await guardGuestPasskeys(ctx);
    signInCodesOnly(ctx);
    await limitEmailSends(deps, ctx);
    await checkAddress(deps, ctx);
    await guardAdminPasskeys(deps, ctx);
    await guardStepUp(ctx);
  });
}

/** The passkey row a successful verification answers with. */
function storedPasskey(returned: unknown): { id: string; userId: string } | null {
  if (typeof returned !== "object" || returned === null || isAPIError(returned)) return null;
  const { id, userId } = returned as { id?: unknown; userId?: unknown };
  return typeof id === "string" && typeof userId === "string" ? { id, userId } : null;
}

/**
 * account:passkey-needs-signed-in-session: every passkey stored is written to the audit log, and a
 * notice goes to the account's email by the send, never awaited by the reply
 * (NIST SP 800-63B-4 4.1.2.1: a mechanism independent of the binding).
 */
async function notePasskey(deps: ServerDeps, keys: AuthKeys, ctx: HookContext): Promise<void> {
  if (ctx.path !== VERIFY_REGISTRATION_PATH) return;
  const passkey = storedPasskey(ctx.context.returned);
  if (passkey === null) return;
  const session = await getSessionFromCtx(ctx);
  const note: PasskeyNote = { accountHash: await accountHash(passkey.userId), passkey: passkey.id, admin: deps.config.admin.accounts.includes(passkey.userId), signedInWith: session === null ? "other" : openedWith(session) };
  const at = deps.now();
  await deps.stores.audit.retire({ character: PASSKEY_ROWS, why: "passkey", at, note: JSON.stringify(note), segments: [], log: [], snapshots: [] });
  const user = await ctx.context.internalAdapter.findUserById(passkey.userId);
  if (user === null || user.email === "") return;
  keys.background(keys.sendNotice({ email: user.email, kind: "passkey-added", at }));
}

/** account:session-is-secure-cookie: removing a linked Google account or a passkey ends every other session of that account; the one that removed it stays. */
async function endSessionsOnUnlink(ctx: HookContext): Promise<void> {
  if (!UNLINK_PATHS.has(ctx.path ?? "")) return;
  if (isAPIError(ctx.context.returned)) return;
  const session = await getSessionFromCtx(ctx);
  if (session === null) return;
  const internal = ctx.context.internalAdapter;
  for (const other of await internal.listSessions(session.user.id)) if (other.token !== session.session.token) await internal.deleteSession(other.token);
}

/** The session and user a successful passkey sign-in answers with. */
function openedSession(returned: unknown): { token: string; userId: string } | null {
  if (typeof returned !== "object" || returned === null || isAPIError(returned)) return null;
  const { session } = returned as { session?: { token?: unknown; userId?: unknown } };
  return typeof session?.token === "string" && typeof session.userId === "string" ? { token: session.token, userId: session.userId } : null;
}

/**
 * moderation:admin-view-for-admin-list: a step-up opens a new session from the passkey and the browser's cookie moves to it,
 * so the session it stepped up from is ended (OWASP: a new session id on a change of privilege). Only a session of the same
 * account is ended; the request's cookie is read as it came, never refreshed.
 */
async function endSteppedUpSession(ctx: HookContext): Promise<void> {
  if (ctx.path !== VERIFY_AUTHENTICATION_PATH) return;
  const opened = openedSession(ctx.context.returned);
  if (opened === null) return;
  const token = await ctx.getSignedCookie(ctx.context.authCookies.sessionToken.name, ctx.context.secret);
  if (typeof token !== "string" || token === "" || token === opened.token) return;
  const internal = ctx.context.internalAdapter;
  const before = await internal.findSession(token);
  if (before?.session.userId === opened.userId) await internal.deleteSession(token);
}

/**
 * account:sign-out-ends-the-session, account:player-deletes-account: signing out on every phone ends every session, so the
 * account's place sockets, which those sessions opened, close with them and its name leaves the day's list.
 */
async function leavePlacesOnRevoke(deps: ServerDeps, ctx: HookContext): Promise<void> {
  if (ctx.path !== REVOKE_PATH || isAPIError(ctx.context.returned)) return;
  const account = ctx.context.session?.user.id;
  const row = account === undefined ? null : await deps.stores.account.get(account);
  if (row !== null) await leavePlaces(deps, row.id, row.username);
}

/** The hooks run after every library route. */
export function afterAuth(deps: ServerDeps, keys: AuthKeys) {
  return createAuthMiddleware(async (ctx) => {
    await endSessionsOnUnlink(ctx);
    await leavePlacesOnRevoke(deps, ctx);
    await endSteppedUpSession(ctx);
    await notePasskey(deps, keys, ctx);
  });
}

/** account:deleted-data-removed-within-month: rate-limit rows past every window, so none outlives its use. A day row is kept until its window ends (`EMAIL_DAY_PREFIX`). */
export async function pruneLimitRows(adapter: { deleteMany: (input: { model: string; where: { field: string; operator: "lt"; value: number }[] }) => Promise<number> }, now: number): Promise<void> {
  await adapter.deleteMany({ model: RATE_LIMIT_MODEL, where: [{ field: "lastRequest", operator: "lt", value: now - EMAIL_LIMIT_WINDOW_MS }] });
}
