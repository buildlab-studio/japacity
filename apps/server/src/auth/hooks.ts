// The auth library's request hooks: the code sends per email (R-ACCOUNT-014)
// and the sessions that end when a method is removed (R-ACCOUNT-006).
// https://better-auth.com/docs/concepts/hooks
// https://better-auth.com/docs/concepts/rate-limit
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from "better-auth/api";

import type { ServerDeps } from "../deps";

/** The library's rate-limit table, which the `database` store keeps (R-ACCOUNT-014). */
export const RATE_LIMIT_MODEL = "rateLimit";

/** Keys of the per-email rows; the address itself is never stored, only its hash. */
export const EMAIL_LIMIT_PREFIX = "otp-email:";

/** The window of the per-email count, the same 60 seconds as the per-address one. */
export const EMAIL_LIMIT_WINDOW_MS = 60_000;

const SEND_PATH = "/email-otp/send-verification-otp";
const UNLINK_PATHS = new Set(["/unlink-account", "/passkey/delete-passkey"]);

interface LimitRow {
  key: string;
  count: number;
  lastRequest: number | bigint;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** R-ACCOUNT-014: at most `auth.limits.otpSendPer60s` code sends to one email in 60 seconds, from any address. */
export function emailSendLimit(deps: ServerDeps) {
  return createAuthMiddleware(async (ctx) => {
    if (ctx.path !== SEND_PATH) return;
    const body = ctx.body as { email?: unknown } | undefined;
    if (typeof body?.email !== "string") return;
    const key = EMAIL_LIMIT_PREFIX + (await sha256Hex(body.email.trim().toLowerCase()));
    const adapter = ctx.context.adapter;
    const now = deps.now();
    const where = [{ field: "key", value: key }];
    const row = await adapter.findOne<LimitRow>({ model: RATE_LIMIT_MODEL, where });
    if (row === null) {
      await adapter.create({ model: RATE_LIMIT_MODEL, data: { key, count: 1, lastRequest: now } });
      return;
    }
    if (now - Number(row.lastRequest) >= EMAIL_LIMIT_WINDOW_MS) {
      await adapter.update({ model: RATE_LIMIT_MODEL, where, update: { count: 1, lastRequest: now } });
      return;
    }
    if (row.count >= deps.config.auth.limits.otpSendPer60s) {
      throw new APIError("TOO_MANY_REQUESTS", { message: "Too many codes for this email. Try again in a minute." });
    }
    await adapter.update({ model: RATE_LIMIT_MODEL, where, update: { count: row.count + 1 } });
  });
}

/** R-ACCOUNT-006: removing a linked Google account or a passkey ends every session of that account. */
export function endSessionsOnUnlink() {
  return createAuthMiddleware(async (ctx) => {
    if (!UNLINK_PATHS.has(ctx.path ?? "")) return;
    if (isAPIError(ctx.context.returned)) return;
    const session = await getSessionFromCtx(ctx);
    if (session === null) return;
    await ctx.context.internalAdapter.deleteUserSessions(session.user.id);
  });
}

/** R-ACCOUNT-017: rate-limit rows past every window, so none outlives its use. */
export async function pruneLimitRows(adapter: { deleteMany: (input: { model: string; where: { field: string; operator: "lt"; value: number }[] }) => Promise<number> }, now: number): Promise<void> {
  await adapter.deleteMany({ model: RATE_LIMIT_MODEL, where: [{ field: "lastRequest", operator: "lt", value: now - EMAIL_LIMIT_WINDOW_MS }] });
}
