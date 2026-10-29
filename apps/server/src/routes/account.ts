// account:one-character-per-account, account:player-deletes-account, account:guest-and-secured-states, account:social-needs-secured-account, account:guest-secures-the-life, account:username-and-unconfirmed-email, account:sign-in-without-secret and account:guest-floods-are-capped: `POST /api/guest`, the guest start after the
// age screen, and the username step's start of a life that came by the code; `DELETE /api/new-life`, which drops this
// browser's proof of an address; `GET /api/account`, the account's own row; `PUT /api/account`,
// its one setting the player changes here (analytics:player-can-stop-usage-counts);
// `PUT /api/account/username`; `GET /api/username/available`, the box's check while the player types
// (account:username-typed-and-checked); and `DELETE /api/account`, confirmed by a fresh
// session or a fresh email code. The guest gates are mounted here, before
// every route they guard (account/guest.ts).
// https://better-auth.com/docs/concepts/users-accounts#delete-user
// https://better-auth.com/docs/plugins/anonymous
import type { AccountReply, AccountView, DeleteReply, DeleteRequest, NameProblem, NameReply, ServerRejection, UsernameFreeReply } from "@japacity/api";
import { NEW_LIFE_PATH, USERNAME_FREE_PATH } from "@japacity/api";
import { splitSetCookieHeader } from "better-auth/cookies";
import { isAPIError } from "better-auth/api";
import type { AccountRow } from "@japacity/store";
import { time, toHex } from "@japacity/sim";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";

import { PASS_COOKIE, readCookie } from "../account/age";
import { deletionStatus, requestDeletion } from "../account/deletion";
import { DEVICE_COOKIE, countGuest, guestGates, tooManyGuests } from "../account/guest";
import { dropProof, heldProof, NEW_LIFE_COOKIE, NEW_LIFE_COOKIE_PATH } from "../account/newlife";
import { GUEST_NAME_HEADER, GUEST_PROVED_HEADER, PROOF_TAKEN_HEADER } from "../account/signup";
import { checkTurnstile } from "../account/turnstile";
import { nameProblem, renameFrom } from "../account/username";
import { countSecured } from "../analytics/live";
import type { Accounts, Auth } from "../auth/auth";
import { headersWithoutSession } from "../auth/stale";
import type { ServerDeps } from "../dependencies";
import type { SessionEnv } from "../limits/limit";
import { limit, overLimit, sessionOf } from "../limits/limit";
import { leavePlaces } from "../postgres";
import { switchedOff } from "../switches/switches";
import { PASS_PATH } from "./age";
import { rejection } from "./reply";

/** How long the device cookie of account:guest-floods-are-capped is kept: the longest a browser keeps one. */
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

/** A guest's ways back in: none but its own session (account:guest-and-secured-states). */
const NO_WAYS: AccountView["ways"] = { google: null, email: null, passkeys: 0 };

/**
 * account:guest-secures-the-life, account:guest-reminded-to-secure: the ways a secured account opens by. The library signs a code in by the user's own
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

/**
 * moderation:admin-view-for-admin-list: `adminNeedsPasskey` is in the row only for an account on the admin list, so no one
 * else's reply differs from what it would be with no admin view at all.
 */
function viewOf(row: AccountRow, deps: Pick<ServerDeps, "config">, passkey: boolean, ways: AccountView["ways"]): AccountView {
  const { id, country, age, createdAt, character, sendUsageCounts, state, username } = row;
  const listed = deps.config.admin.accounts.includes(id);
  return {
    id,
    country,
    age: { passed: age.passed, method: age.method },
    createdAt,
    character,
    sendUsageCounts,
    admin: passkey && listed,
    ...(listed ? { adminNeedsPasskey: !passkey } : {}),
    state,
    username,
    renameFrom: renameFrom(row, deps.config),
    ways,
  };
}

function nameRefused(name: NameProblem): ServerRejection & { name: NameProblem } {
  const said: Record<NameProblem, string> = {
    format: "A username is 3 to 20 letters, digits or underscores.",
    reserved: "That username is for the game's own people.",
    blocked: "That username is not allowed.",
    taken: "That username is taken.",
    wait: "The username can change again later.",
  };
  return { ...rejection("not-legal", said[name]), name };
}

function usernameOf(body: unknown): unknown {
  return typeof body === "object" && body !== null && Object.keys(body).join(",") === "username" ? (body as { username: unknown }).username : null;
}

/** The body of `POST /api/guest`: the username, and `proved` on a start that came by the code (account:sign-in-without-secret); null when it is neither. */
function guestStartOf(body: unknown): { username: unknown; proved: boolean } | null {
  if (typeof body !== "object" || body === null) return null;
  const keys = Object.keys(body).sort().join(",");
  if (keys === "username") return { username: (body as { username: unknown }).username, proved: false };
  if (keys === "proved,username" && (body as { proved: unknown }).proved === true) return { username: (body as { username: unknown }).username, proved: true };
  return null;
}

/** account:sign-in-without-secret: a start that came by the code and found no live proof on this browser. */
const PROOF_GONE = rejection("proof-gone", "Your code ran out. Send a new one.");

/** The library's refusal of the guest start as the route answers it. */
function guestRefusal(error: unknown): { status: 400 | 403 | 409; body: NameReply } {
  const code = isAPIError(error) ? (error.body as { code?: unknown } | undefined)?.code : undefined;
  if (code === "name-taken") return { status: 409, body: nameRefused("taken") };
  if (code === "no-age-pass") return { status: 403, body: rejection("expired", "Answer the age question again first.") };
  if (code === "not-legal") return { status: 400, body: nameRefused("format") };
  if (code === "proof-gone") return { status: 403, body: PROOF_GONE };
  if (code === "taken") return { status: 409, body: rejection("taken", "That email already has an account. Sign in instead.") };
  if (code === "not-possible") return { status: 403, body: rejection("not-possible", "This sign-in cannot make an account.") };
  throw error;
}

export function accountRoutes(deps: ServerDeps, { auth, keys }: Accounts): Hono<SessionEnv> {
  const app = new Hono<SessionEnv>();
  app.route("/", guestGates(deps));

  // account:guest-and-secured-states, account:bot-check-on-guest-creation, account:guest-floods-are-capped: a guest life from a username, after the age screen; the bot check and the limits come before the account exists.
  app.post("/api/guest", limit(deps, "commands"), async (c) => {
    if (sessionOf(c) !== null) return c.json<NameReply>(rejection("not-possible", "This browser already has a life."), 409);
    const request = c.req.raw;
    const asked = guestStartOf(await c.req.json().catch(() => null));
    const username = asked?.username ?? null;
    const problem = nameProblem(username);
    if (problem !== null || typeof username !== "string" || asked === null) return c.json<NameReply>(nameRefused(problem ?? "format"), 400);
    if ((await deps.stores.account.byUsername(username)) !== null) return c.json<NameReply>(nameRefused("taken"), 409);
    const pass = readCookie(request.headers.get("cookie"), PASS_COOKIE);
    if (pass === null || pass === "") return c.json<NameReply>(rejection("expired", "Answer the age question again first."), 403);

    const context = await auth.$context;
    // account:sign-in-without-secret: a start by the code with no live proof is told so before the bot check spends its token; the birth takes the proof itself.
    if (asked.proved && (await heldProof(context.internalAdapter, request.headers.get("cookie"), deps.now())) === null) return c.json<NameReply>(PROOF_GONE, 403);
    const device = readCookie(request.headers.get("cookie"), DEVICE_COOKIE) ?? toHex(deps.randomBytes(16));
    setCookie(c, DEVICE_COOKIE, device, { path: "/api/guest", httpOnly: true, secure: true, sameSite: "Lax", maxAge: DEVICE_COOKIE_S });
    const address = request.headers.get("cf-connecting-ip");
    if (await tooManyGuests(deps, context.adapter, device, address)) return c.json<NameReply>(rejection("too-many", "Too many new lives from here today. Come back tomorrow."), 429);

    const check = await checkTurnstile(keys.turnstile, request.headers.get("x-captcha-response"), address, new URL(keys.siteUrl).hostname);
    if (!check.ok) return c.json<NameReply>(rejection("bot-check", check.reason), 403);

    // No session was found above, so any session cookie the browser sent is dead; the library must not see it (account:guest-and-secured-states).
    const headers = await headersWithoutSession(auth, request.headers);
    headers.set(GUEST_NAME_HEADER, username);
    if (asked.proved) headers.set(GUEST_PROVED_HEADER, "1");
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
    // account:guest-secures-the-life: the proof was consumed by the birth, whatever it came to.
    if (readCookie(request.headers.get("cookie"), NEW_LIFE_COOKIE) !== null) deleteCookie(c, NEW_LIFE_COOKIE, { path: NEW_LIFE_COOKIE_PATH, secure: true });
    const row = await deps.stores.account.get(signed.response.user.id);
    if (row === null) throw new Error(`The guest ${signed.response.user.id} has no account row.`);
    if (row.state === "guest") return c.json<NameReply>({ ok: true, account: viewOf(row, deps, false, NO_WAYS), ...(signed.headers.get(PROOF_TAKEN_HEADER) === null ? {} : { emailTaken: true as const }) });
    // Born secured by a proved address: the same marks as a guest that kept its life (account/link.ts).
    await deps.stores.boards.setListed(row.id, true);
    await countSecured(deps, row.id);
    return c.json<NameReply>({ ok: true, account: viewOf(row, deps, false, await waysOf(auth, row)) });
  });

  // account:sign-in-without-secret: "Use another email" on a new life's step drops this browser's proof and its cookie.
  app.delete(NEW_LIFE_PATH, limit(deps, "commands"), async (c) => {
    if (await dropProof((await auth.$context).internalAdapter, c.req.header("cookie"))) deleteCookie(c, NEW_LIFE_COOKIE, { path: NEW_LIFE_COOKIE_PATH, secure: true });
    return c.json<{ ok: true }>({ ok: true });
  });

  // account:username-typed-and-checked: whether a name is free, asked by the box as the player types, signed out at the door. Usernames
  // are public, so the answer tells nothing new; every check counts against its address, and a signed-in one against its
  // session too, so names cannot be listed in bulk from one place or one account.
  app.get(USERNAME_FREE_PATH, async (c) => {
    const session = await deps.session(c.req.raw);
    const address = c.req.header("cf-connecting-ip") ?? null;
    const over = (await overLimit(deps, "reads", null, address)) ?? (session === null ? null : await overLimit(deps, "reads", session.account, null));
    if (over !== null) return c.json<UsernameFreeReply>(over, 429);
    const name = c.req.query("name") ?? null;
    const problem = nameProblem(name);
    if (problem !== null || name === null) return c.json<UsernameFreeReply>(nameRefused(problem ?? "format"), 400);
    return c.json<UsernameFreeReply>({ ok: true, free: (await deps.stores.account.byUsername(name)) === null });
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

  // account:username-and-unconfirmed-email: one free change, then one each `renameDays`.
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
    // city:players-shown-present-not-tracked: the old name leaves the crowd at once; the socket the client opens again carries the new one.
    await leavePlaces(deps, session.account, row.username);
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
