// The admin page's data (R-SERVER-005, R-SERVER-008, R-SERVER-011, R-SERVER-012).
// Only a session whose account is in `config.admin.accounts` may read it; to
// anyone else, signed in or not, every route here does not exist.
import { Hono } from "hono";

import { listAlarms } from "../admin/alarm";
import { utcDay } from "../admin/day";
import { rejectionCounts } from "../admin/rejections";
import { rollbackCheck } from "../admin/rollback";
import type { ServerDeps } from "../deps";

const WHOLE = /^\d{1,9}$/;

export function adminRoutes(deps: ServerDeps): Hono {
  const admin = new Hono();

  admin.use("*", async (c, next) => {
    const session = await deps.session(c.req.raw);
    if (session === null || !deps.config.admin.accounts.includes(session.account)) return c.notFound();
    await next();
    return undefined;
  });

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
