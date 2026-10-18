// R-ACCOUNT-015, 016, 021 to 025: `POST /api/guest`, the guest start after the
// age screen; `GET /api/account`, the account's own row; `PUT /api/account`,
// its one setting the player changes here (R-ANALYTICS-006);
// `PUT /api/account/username`; and `DELETE /api/account`, confirmed by a fresh
// session or a fresh email code. The guest gates are mounted here, before
// every route they guard (account/guest.ts).
// https://better-auth.com/docs/concepts/users-accounts#delete-user
// https://better-auth.com/docs/plugins/anonymous
import type { AccountReply, AccountView, DeleteReply, DeleteRequest, NameProblem, NameReply, ServerRejection } from "@japacity/api";
import { splitSetCookieHeader } from "better-auth/cookies";
import { isAPIError } from "better-auth/api";
import type { AccountRow } from "@japacity/store";
import { time, toHex } from "@japacity/sim";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";

import { PASS_COOKIE, readCookie } from "../account/age";
import { deletionStatus, requestDeletion } from "../account/deletion";
import { DEVICE_COOKIE, countGuest, guestGates, tooManyGuests } from "../account/guest";
import { GUEST_NAME_HEADER } from "../account/signup";
import { checkTurnstile } from "../account/turnstile";
import { nameProblem, renameFrom } from "../account/username";
import type { Accounts, Auth } from "../auth/auth";
import { headersWithoutSession } from "../auth/stale";
import type { ServerDeps } from "../deps";
import type { SessionEnv } from "../limits/limit";
import { limit, sessionOf } from "../limits/limit";
import { switchedOff } from "../switches/switches";
import { PASS_PATH } from "./age";
import { rejection } from "./reply";

/** How long the device cookie of R-ACCOUNT-025 is kept: the longest a browser keeps one. */
const DEVICE_COOKIE_S = 400 * time.DAY_S;

/** A reply's `Set-Cookie` lines. */
function setCookies(headers: Headers): string[] {
  return splitSetCookieHeader(headers.get("set-cookie") ?? "");
}

/** A `Cookie` header made from a reply's `Set-Cookie` lines. */
function cookiesFrom(headers: Headers): Headers {
  const pairs = setCookies(headers).map((line) => line.split(";")[0] ?? "");
  return new Headers({ cookie: pairs.filter((pair) => pair !== "").join("; ") });
}

/** A guest's ways back in: none but its own session (R-ACCOUNT-021). */
const NO_WAYS: AccountView["ways"] = { google: null, email: null, passkeys: 0 };

/**
 * R-ACCOUNT-023, R-ACCOUNT-027: the ways a secured account opens by. The library signs a code in by the user's own
 * address, so the code's address is the user's email whatever way the life was kept. Google joins an account only by
 * the same verified address (a guest's own link, or the library's linking by email), so a linked Google account's
 * address is that email too. Read-only: the subject id and the tokens on the Google row stay on the server.
 */
async function waysOf(auth: Auth, row: AccountRow): Promise<AccountView["ways"]> {
  if (row.state === "guest") return NO_WAYS;
  const context = await auth.$context;
  const user = await context.internalAdapter.findUserById(row.id);
  const email = user === null || user.email === "" ? null : user.email;
  const methods = await context.internalAdapter.findAccounts(row.id);
  const passkeys = await context.adapter.count({ model: "passkey", where: [{ field: "userId", value: row.id }] });
  return { google: methods.some((method) => method.providerId === "google") ? email : null, email, passkeys };
}

function viewOf(row: AccountRow, deps: Pick<ServerDeps, "config">, passkey: boolean, ways: AccountView["ways"]): AccountView {
  const { id, country, age, createdAt, character, sendUsageCounts, state, username } = row;
  return {
    id,
    country,
    age: { passed: age.passed, method: age.method },
    createdAt,
    character,
    sendUsageCounts,
    admin: passkey && deps.config.admin.accounts.includes(id),
    state,
    username,
    renameFrom: renameFrom(row, deps.config),
    ways,
  };
}

function nameRefused(name: NameProblem): ServerRejection & { name: NameProblem } {
  const said: Record<NameProblem, string> = {
    format: "A username is 3 to 20 letters, digits or underscores.",
    reserved: "That username is kept for the game's own people.",
    blocked: "That username is not allowed.",
    taken: "That username is taken.",
    wait: "The username can change again later.",
  };
  return { ...rejection("not-legal", said[name]), name };
}

function usernameOf(body: unknown): unknown {
  return typeof body === "object" && body !== null && Object.keys(body).join(",") === "username" ? (body as { username: unknown }).username : null;
}

/** The library's refusal of the guest start as the route answers it. */
function guestRefusal(error: unknown): { status: 400 | 403 | 409; body: NameReply } {
  const code = isAPIError(error) ? (error.body as { code?: unknown } | undefined)?.code : undefined;
  if (code === "name-taken") return { status: 409, body: nameRefused("taken") };
  if (code === "no-age-pass") return { status: 403, body: rejection("expired", "Answer the age question again first.") };
  if (code === "not-legal") return { status: 400, body: nameRefused("format") };
  throw error;
}

export function accountRoutes(deps: ServerDeps, { auth, keys }: Accounts): Hono<SessionEnv> {
  const app = new Hono<SessionEnv>();
  app.route("/", guestGates(deps));

  // R-ACCOUNT-021, 013, 025: a guest life from a username, after the age screen; the bot check and the limits come before the account exists.
  app.post("/api/guest", limit(deps, "commands"), async (c) => {
    if (sessionOf(c) !== null) return c.json<NameReply>(rejection("not-possible", "This browser already has a life."), 409);
    const request = c.req.raw;
    const username = usernameOf(await c.req.json().catch(() => null));
    const problem = nameProblem(username);
    if (problem !== null || typeof username !== "string") return c.json<NameReply>(nameRefused(problem ?? "format"), 400);
    if ((await deps.stores.account.byUsername(username)) !== null) return c.json<NameReply>(nameRefused("taken"), 409);
    const pass = readCookie(request.headers.get("cookie"), PASS_COOKIE);
    if (pass === null || pass === "") return c.json<NameReply>(rejection("expired", "Answer the age question again first."), 403);

    const context = await auth.$context;
    const device = readCookie(request.headers.get("cookie"), DEVICE_COOKIE) ?? toHex(deps.randomBytes(16));
    setCookie(c, DEVICE_COOKIE, device, { path: "/api/guest", httpOnly: true, secure: true, sameSite: "Lax", maxAge: DEVICE_COOKIE_S });
    const address = request.headers.get("cf-connecting-ip");
    if (await tooManyGuests(deps, context.adapter, device, address)) return c.json<NameReply>(rejection("too-many", "Too many new lives from here today. Come back tomorrow."), 429);

    const check = await checkTurnstile(keys.turnstile, request.headers.get("x-captcha-response"), address, new URL(keys.siteUrl).hostname);
    if (!check.ok) return c.json<NameReply>(rejection("bot-check", check.reason), 403);

    // No session was found above, so any session cookie the browser sent is dead; the library must not see it (R-ACCOUNT-021).
    const headers = await headersWithoutSession(auth, request.headers);
    headers.set(GUEST_NAME_HEADER, username);
    const signed = await auth.api.signInAnonymous({ headers, returnHeaders: true }).catch((error: unknown) => ({ error }));
    if ("error" in signed) {
      if (isAPIError(signed.error) && (signed.error.body as { code?: unknown } | undefined)?.code === "switched-off") {
        c.header("Retry-After", String(switchedOff(deps, "signups").retryAfter ?? 0));
        return c.json<NameReply>(switchedOff(deps, "signups"), 503);
      }
      const refused = guestRefusal(signed.error);
      return c.json<NameReply>(refused.body, refused.status);
    }
    await countGuest(deps, context.adapter, device, address);
    for (const line of setCookies(signed.headers)) c.header("set-cookie", line, { append: true });
    deleteCookie(c, PASS_COOKIE, { path: PASS_PATH, secure: true });
    const row = await deps.stores.account.get(signed.response.user.id);
    if (row === null) throw new Error(`The guest ${signed.response.user.id} has no account row.`);
    return c.json<NameReply>({ ok: true, account: viewOf(row, deps, false, NO_WAYS) });
  });

  app.get("/api/account", limit(deps, "reads"), async (c) => {
    const session = await deps.session(c.req.raw);
    if (session === null) return c.json<AccountReply>(rejection("signed-out", "Sign in first."), 401);
    const row = await deps.stores.account.get(session.account);
    if (row === null) return c.json<AccountReply>(rejection("signed-out", "No account."), 401);
    return c.json<AccountReply>({ ok: true, account: viewOf(row, deps, session.passkey, await waysOf(auth, row)) });
  });

  app.put("/api/account", limit(deps, "commands"), async (c) => {
    const session = await deps.session(c.req.raw);
    if (session === null) return c.json<AccountReply>(rejection("signed-out", "Sign in first."), 401);
    const body: unknown = await c.req.json().catch(() => null);
    const asked = typeof body === "object" && body !== null && Object.keys(body).join(",") === "sendUsageCounts" ? (body as { sendUsageCounts: unknown }).sendUsageCounts : null;
    if (typeof asked !== "boolean") return c.json<AccountReply>(rejection("not-legal", "Send { sendUsageCounts: true | false }."), 400);
    const changed = await deps.stores.account.setUsageCounts(session.account, asked);
    if (!changed.ok) return c.json<AccountReply>(rejection("signed-out", "No account."), 401);
    return c.json<AccountReply>({ ok: true, account: viewOf(changed.value, deps, session.passkey, await waysOf(auth, changed.value)) });
  });

  // R-ACCOUNT-024: one free change, then one each `renameDays`.
  app.put("/api/account/username", limit(deps, "commands"), async (c) => {
    const session = await deps.session(c.req.raw);
    if (session === null) return c.json<NameReply>(rejection("signed-out", "Sign in first."), 401);
    const row = await deps.stores.account.get(session.account);
    if (row === null) return c.json<NameReply>(rejection("signed-out", "No account."), 401);
    const username = usernameOf(await c.req.json().catch(() => null));
    const problem = nameProblem(username);
    if (problem !== null || typeof username !== "string") return c.json<NameReply>(nameRefused(problem ?? "format"), 400);
    if (deps.now() < renameFrom(row, deps.config)) return c.json<NameReply>(nameRefused("wait"), 403);
    const changed = await deps.stores.account.setUsername(session.account, username, deps.now());
    if (!changed.ok) return changed.code === "conflict" ? c.json<NameReply>(nameRefused("taken"), 409) : c.json<NameReply>(rejection("signed-out", "No account."), 401);
    return c.json<NameReply>({ ok: true, account: viewOf(changed.value, deps, session.passkey, await waysOf(auth, changed.value)) });
  });

  app.delete("/api/account", limit(deps, "commands"), async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (session === null) return c.json<DeleteReply>(rejection("signed-out", "Sign in first."), 401);

    // A guest has no email and no other way in, so its own session is the whole of its confirmation.
    if ((session.user as { isAnonymous?: unknown }).isAnonymous === true) {
      const out = await auth.api.signOut({ headers: c.req.raw.headers, returnHeaders: true });
      await requestDeletion(deps, session.user.id);
      await (await auth.$context).internalAdapter.deleteUser(session.user.id);
      for (const line of setCookies(out.headers)) c.header("set-cookie", line, { append: true });
      const status = await deletionStatus(deps, session.user.id);
      if (status === null) throw new Error(`No deletion was recorded for ${session.user.id}.`);
      return c.json<DeleteReply>({ ok: true, dueAt: status.dueAt });
    }

    const body = (await c.req.json().catch(() => ({}))) as DeleteRequest | null;
    const code = typeof body?.code === "string" ? body.code : null;

    let headers = c.req.raw.headers;
    const fresh = deps.now() - new Date(session.session.createdAt).getTime() < deps.config.account.deleteFreshMs;
    if (!fresh) {
      if (code === null) return c.json<DeleteReply>(rejection("not-fresh", "Sign in again or send a code to your email."), 403);
      try {
        const signed = await auth.api.signInEmailOTP({ body: { email: session.user.email, otp: code }, headers, returnHeaders: true });
        if (signed.response.user.id !== session.user.id) return c.json<DeleteReply>(rejection("bad-code", "That code is not for this account."), 403);
        headers = cookiesFrom(signed.headers);
      } catch {
        return c.json<DeleteReply>(rejection("bad-code", "That code did not work."), 403);
      }
    }

    const deleted = await auth.api.deleteUser({ headers, body: {}, returnHeaders: true });
    for (const line of setCookies(deleted.headers)) c.header("set-cookie", line, { append: true });
    const status = await deletionStatus(deps, session.user.id);
    if (status === null) throw new Error(`No deletion was recorded for ${session.user.id}.`);
    return c.json<DeleteReply>({ ok: true, dueAt: status.dueAt });
  });

  return app;
}
