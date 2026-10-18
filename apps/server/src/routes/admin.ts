// The admin page's data (R-SERVER-005, R-SERVER-008, R-SERVER-011, R-SERVER-012).
// Only a session whose account is in `config.admin.accounts` may read it; to
// anyone else, signed in or not, every route here does not exist. An admin
// whose session was not opened with a passkey is refused (R-MODERATION-012).
import type { ServerRejection } from "@japacity/api";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";

import { listAlarms } from "../admin/alarm";
import { utcDay } from "../admin/day";
import { rejectionCounts } from "../admin/rejections";
import { rollbackCheck } from "../admin/rollback";
import type { ServerDeps } from "../deps";

const WHOLE = /^\d{1,9}$/;

export const ADMIN_PASSKEY_DETAIL = "The admin view needs a session opened with a passkey; sign in again with yours.";

/** What every admin route knows once the gate has let a request through: the admin's account. */
export interface AdminEnv {
  Variables: { admin: string };
}

/** R-MODERATION-012, R-SERVER-012: the gate before every admin route. */
export function adminOnly(deps: ServerDeps): MiddlewareHandler<AdminEnv> {
  return async (c, next) => {
    const session = await deps.session(c.req.raw);
    if (session === null || !deps.config.admin.accounts.includes(session.account)) return c.notFound();
    if (!session.passkey) return c.json<ServerRejection>({ ok: false, code: "not-legal", detail: ADMIN_PASSKEY_DETAIL }, 403);
    c.set("admin", session.account);
    await next();
    return undefined;
  };
}

export function adminRoutes(deps: ServerDeps): Hono<AdminEnv> {
  const admin = new Hono<AdminEnv>();

  admin.use("*", adminOnly(deps));

  admin.get("/report", async (c) => {
    const asked = c.req.query("day");
    if (asked !== undefined && !WHOLE.test(asked)) return c.json({ ok: false, detail: "day is a whole number of UTC days since 1970." }, 400);
    const day = asked === undefined ? utcDay(deps.now()) - 1 : Number(asked);
    return c.json({ ok: true, report: await deps.stores.ledger.day(day) });
  });

  admin.get("/alarms", async (c) => c.json({ ok: true, alarms: await listAlarms(deps) }));

  admin.get("/rejections", (c) => c.json({ ok: true, counts: rejectionCounts() }));

  admin.get("/rollback/:character", async (c) => c.json(await rollbackCheck(deps, c.req.param("character"))));

  return admin;
}
