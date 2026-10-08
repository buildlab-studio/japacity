// R-ACCOUNT-015, 016: `GET /api/account`, the account's own row, and
// `DELETE /api/account`, confirmed by a fresh session or a fresh email code.
// https://better-auth.com/docs/concepts/users-accounts#delete-user
import { splitSetCookieHeader } from "better-auth/cookies";
import { Hono } from "hono";

import { deletionStatus } from "../account/deletion";
import { rejection } from "../account/reply";
import type { AccountRejection } from "../account/reply";
import type { Accounts } from "../auth/auth";
import type { ServerDeps } from "../deps";

/** The account as its owner sees it: no age date (R-ACCOUNT-020), no email (the auth library's session holds that). */
export interface AccountView {
  id: string;
  country: string;
  age: { passed: boolean; method: "declared" | "verified" };
  createdAt: number;
  character: string | null;
  /** R-MODERATION-012: the account is on `config.admin.accounts`, so the client mounts the admin page. */
  admin: boolean;
}

export type AccountReply = { ok: true; account: AccountView } | AccountRejection;

/** The body of `DELETE /api/account`; `code` is an email code sent with type `sign-in`, needed once the session is not fresh. */
export interface DeleteRequest {
  code?: string;
}

/** `dueAt`: the removal of R-ACCOUNT-017 happens by then. */
export type DeleteReply = { ok: true; dueAt: number } | AccountRejection;

/** A reply's `Set-Cookie` lines. */
function setCookies(headers: Headers): string[] {
  return splitSetCookieHeader(headers.get("set-cookie") ?? "");
}

/** A `Cookie` header made from a reply's `Set-Cookie` lines. */
function cookiesFrom(headers: Headers): Headers {
  const pairs = setCookies(headers).map((line) => line.split(";")[0] ?? "");
  return new Headers({ cookie: pairs.filter((pair) => pair !== "").join("; ") });
}

export function accountRoutes(deps: ServerDeps, { auth }: Accounts): Hono {
  const app = new Hono();

  app.get("/api/account", async (c) => {
    const session = await deps.session(c.req.raw);
    if (session === null) return c.json<AccountReply>(rejection("signed-out", "Sign in first."), 401);
    const row = await deps.stores.account.get(session.account);
    if (row === null) return c.json<AccountReply>(rejection("signed-out", "No account."), 401);
    const { id, country, age, createdAt, character } = row;
    return c.json<AccountReply>({ ok: true, account: { id, country, age: { passed: age.passed, method: age.method }, createdAt, character, admin: deps.config.admin.accounts.includes(session.account) } });
  });

  app.delete("/api/account", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (session === null) return c.json<DeleteReply>(rejection("signed-out", "Sign in first."), 401);
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
