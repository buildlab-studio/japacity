// The auth library's request hooks: the code sends per email (R-ACCOUNT-014),
// the guest start reached only through the game's route (R-ACCOUNT-013), no
// passkey for a guest (R-ACCOUNT-023), the sessions that end when a method is
// removed (R-ACCOUNT-006), and who may add a passkey and what each addition
// leaves behind (R-ACCOUNT-003).
// https://better-auth.com/docs/concepts/hooks
// https://better-auth.com/docs/concepts/rate-limit
// https://pages.nist.gov/800-63-4/sp800-63b/events/ (4.1.2.1, 4.6)
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from "better-auth/api";

import { GUEST_PATH } from "../account/signup";
import type { ServerDeps } from "../deps";
import type { AuthKeys } from "./auth";
import type { SignedInWith } from "./session";

/** The library's rate-limit table, which the `database` store keeps (R-ACCOUNT-014). */
export const RATE_LIMIT_MODEL = "rateLimit";

/** Keys of the per-email rows; the address itself is never stored, only its hash. */
export const EMAIL_LIMIT_PREFIX = "otp-email:";

/** The window of the per-email count, the same 60 seconds as the per-address one. */
export const EMAIL_LIMIT_WINDOW_MS = 60_000;

const SEND_PATH = "/email-otp/send-verification-otp";
const UNLINK_PATHS = new Set(["/unlink-account", "/passkey/delete-passkey"]);
const VERIFY_REGISTRATION_PATH = "/passkey/verify-registration";
const REGISTER_PATHS = new Set(["/passkey/generate-register-options", VERIFY_REGISTRATION_PATH]);

export const ADMIN_PASSKEY_BIND_DETAIL = "A new passkey on an admin account is added only from a session opened with a passkey; sign in with yours first.";

/**
 * R-ACCOUNT-003: the audit rows that hold passkey registrations are filed
 * under this name instead of a character id; each row's note is a
 * `PasskeyNote` as JSON and its row lists are empty.
 */
export const PASSKEY_ROWS = "auth.passkeys";

/** R-ACCOUNT-003: one registration as the audit log keeps it. */
export interface PasskeyNote {
  account: string;
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

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Keys of the per-email day rows. A day row's
 * `lastRequest` holds when its window ends, not when it began, so the prune of
 * rows 60 seconds past their last use keeps it for the whole day.
 */
export const EMAIL_DAY_PREFIX = "otp-email-day:";

/** The window of the per-email day count. */
export const EMAIL_DAY_WINDOW_MS = 24 * 60 * EMAIL_LIMIT_WINDOW_MS;

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
 * R-ACCOUNT-014: at most `auth.limits.otpSendPer60s` code sends to one email
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

/** How the request's session was opened, from the field the session hook set (session.ts). */
function openedWith(session: { session: Record<string, unknown> }): SignedInWith {
  const method = session.session["signedInWith"];
  return method === "passkey" || method === "email-code" || method === "google" ? method : "other";
}

/**
 * R-ACCOUNT-003, R-MODERATION-012: an account on the admin list that already
 * holds a passkey adds another only from a session opened with a passkey.
 * Checked when the options are asked for and again at the verification,
 * which is where the passkey is stored.
 */
async function guardAdminPasskeys(deps: ServerDeps, ctx: HookContext): Promise<void> {
  if (!REGISTER_PATHS.has(ctx.path ?? "")) return;
  const session = await getSessionFromCtx(ctx);
  if (session === null || !deps.config.admin.accounts.includes(session.user.id)) return;
  if (openedWith(session) === "passkey") return;
  const held = await ctx.context.adapter.count({ model: "passkey", where: [{ field: "userId", value: session.user.id }] });
  if (held > 0) throw new APIError("FORBIDDEN", { message: ADMIN_PASSKEY_BIND_DETAIL });
}

/** R-ACCOUNT-013, R-ACCOUNT-025: the anonymous sign-in is reached only through `POST /api/guest`, with its bot check and limits; a browser's own call is refused. */
function guestStartCheck(ctx: HookContext): void {
  if (ctx.path === GUEST_PATH && ctx.request !== undefined) throw new APIError("NOT_FOUND", { message: "Start a life through the guest start." });
}

/** R-ACCOUNT-023: a passkey is registered only once the account is secured. */
async function guardGuestPasskeys(ctx: HookContext): Promise<void> {
  if (!REGISTER_PATHS.has(ctx.path ?? "")) return;
  const session = await getSessionFromCtx(ctx, { disableRefresh: true }).catch(() => null);
  if ((session?.user as { isAnonymous?: unknown } | undefined)?.isAnonymous === true) {
    throw new APIError("FORBIDDEN", { code: "guest-only", message: "Secure this life with Google or an email code first; then add a passkey." });
  }
}

/** The hooks run before every library route. */
export function beforeAuth(deps: ServerDeps) {
  return createAuthMiddleware(async (ctx) => {
    guestStartCheck(ctx);
    await guardGuestPasskeys(ctx);
    await limitEmailSends(deps, ctx);
    await guardAdminPasskeys(deps, ctx);
  });
}

/** The passkey row a successful verification answers with. */
function storedPasskey(returned: unknown): { id: string; userId: string } | null {
  if (typeof returned !== "object" || returned === null || isAPIError(returned)) return null;
  const { id, userId } = returned as { id?: unknown; userId?: unknown };
  return typeof id === "string" && typeof userId === "string" ? { id, userId } : null;
}

/**
 * R-ACCOUNT-003: every passkey stored is written to the audit log, and a
 * notice goes to the account's email by the send, never awaited by the reply
 * (NIST SP 800-63B-4 4.1.2.1: a mechanism independent of the binding).
 */
async function notePasskey(deps: ServerDeps, keys: AuthKeys, ctx: HookContext): Promise<void> {
  if (ctx.path !== VERIFY_REGISTRATION_PATH) return;
  const passkey = storedPasskey(ctx.context.returned);
  if (passkey === null) return;
  const session = await getSessionFromCtx(ctx);
  const note: PasskeyNote = { account: passkey.userId, passkey: passkey.id, admin: deps.config.admin.accounts.includes(passkey.userId), signedInWith: session === null ? "other" : openedWith(session) };
  const at = deps.now();
  await deps.stores.audit.retire({ character: PASSKEY_ROWS, why: "passkey", at, note: JSON.stringify(note), segments: [], log: [], snapshots: [] });
  const user = await ctx.context.internalAdapter.findUserById(passkey.userId);
  if (user === null || user.email === "") return;
  keys.background(keys.sendNotice({ email: user.email, kind: "passkey-added", at }));
}

/** R-ACCOUNT-006: removing a linked Google account or a passkey ends every session of that account. */
async function endSessionsOnUnlink(ctx: HookContext): Promise<void> {
  if (!UNLINK_PATHS.has(ctx.path ?? "")) return;
  if (isAPIError(ctx.context.returned)) return;
  const session = await getSessionFromCtx(ctx);
  if (session === null) return;
  await ctx.context.internalAdapter.deleteUserSessions(session.user.id);
}

/** The hooks run after every library route. */
export function afterAuth(deps: ServerDeps, keys: AuthKeys) {
  return createAuthMiddleware(async (ctx) => {
    await endSessionsOnUnlink(ctx);
    await notePasskey(deps, keys, ctx);
  });
}

/** R-ACCOUNT-017: rate-limit rows past every window, so none outlives its use. A day row is kept until its window ends (`EMAIL_DAY_PREFIX`). */
export async function pruneLimitRows(adapter: { deleteMany: (input: { model: string; where: { field: string; operator: "lt"; value: number }[] }) => Promise<number> }, now: number): Promise<void> {
  await adapter.deleteMany({ model: RATE_LIMIT_MODEL, where: [{ field: "lastRequest", operator: "lt", value: now - EMAIL_LIMIT_WINDOW_MS }] });
}
