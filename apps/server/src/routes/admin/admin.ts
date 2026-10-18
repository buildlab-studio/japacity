// The admin page's data (server:rejections-write-nothing, server:rollback-check-finds-divergence, server:daily-money-report, server:ledger-alarm-lists-suspects).
// Only a session whose account is in `config.admin.accounts` may read it; to
// anyone else, signed in or not, every route here does not exist. An admin
// whose session has not shown a passkey recently is refused (moderation:admin-view-for-admin-list).
import type { ServerRejection } from "@japacity/api";
import { time } from "@japacity/sim";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";

import { listAlarms } from "../../ops/alarm";
import { rejectionCounts } from "../../ops/rejections";
import { rollbackCheck } from "../../ops/rollback";
import type { ServerDeps } from "../../deps";

const WHOLE = /^\d{1,9}$/;

export const ADMIN_PASSKEY_DETAIL = "The admin view needs your passkey again.";

/** What every admin route knows once the gate has let a request through: the admin's account. */
export interface AdminEnv {
  Variables: { admin: string };
}

/** moderation:admin-view-for-admin-list, server:ledger-alarm-lists-suspects: the gate before every admin route. */
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
    const day = asked === undefined ? time.utcDay(deps.now()) - 1 : Number(asked);
    return c.json({ ok: true, report: await deps.stores.ledger.day(day) });
  });

  admin.get("/alarms", async (c) => c.json({ ok: true, alarms: await listAlarms(deps) }));

  admin.get("/rejections", (c) => c.json({ ok: true, counts: rejectionCounts() }));

  admin.get("/rollback/:character", async (c) => c.json(await rollbackCheck(deps, c.req.param("character"))));

  return admin;
}
