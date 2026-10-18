// `GET /api/admin/analytics?day=YYYY-MM-DD` (analytics.md R-ANALYTICS-009 to
// 011): the dashboard's data, a page of the admin view. As with the other
// admin routes, to anyone not in `config.admin.accounts` it does not exist.
import { time } from "@japacity/sim";
import { Hono } from "hono";

import { dashboard, WINDOW_DAYS } from "../../analytics/dashboard";
import type { ServerDeps } from "../../deps";
import { adminOnly } from "./admin";
import type { AdminEnv } from "./admin";

export function adminAnalyticsRoutes(deps: ServerDeps): Hono<AdminEnv> {
  const admin = new Hono<AdminEnv>();

  admin.use("/analytics", adminOnly(deps));

  admin.get("/analytics", async (c) => {
    const asked = c.req.query("day");
    const last = asked === undefined ? time.utcDay(deps.now()) : time.dayNumber(asked);
    if (last === null) return c.json({ ok: false, detail: "day is a date, YYYY-MM-DD." }, 400);
    const totals = await deps.stores.counters.days(time.dayName(last - WINDOW_DAYS), time.dayName(last));
    return c.json({ ok: true, dashboard: dashboard(deps.contents.current, time.dayName(last), totals) });
  });

  return admin;
}
