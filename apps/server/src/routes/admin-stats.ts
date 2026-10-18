// `GET /api/admin/stats` (analytics.md R-ANALYTICS-012): the
// numbers an investor asks for, live, for the admin view's Numbers tab. As
// with the other admin routes, to anyone not in `config.admin.accounts` it
// does not exist. No public page reads it.
import type { StatsReply } from "@japacity/api";
import type { NumbersLog } from "@japacity/store";
import { Hono } from "hono";

import { dayStart, utcDay } from "../admin/day";
import { dayName } from "../analytics/day";
import { buildStats, statsFrom } from "../analytics/stats";
import type { ServerDeps } from "../deps";
import { onlineAt } from "../jobs/online";
import { adminOnly } from "./admin";
import type { AdminEnv } from "./admin";

/** `log` reads the command log by its time: Postgres in the Worker (index.ts), the memory stores in tests. */
export function adminStatsRoutes(deps: ServerDeps, log: NumbersLog): Hono<AdminEnv> {
  const admin = new Hono<AdminEnv>();

  admin.use("/stats", adminOnly(deps));

  admin.get("/stats", async (c) => {
    const now = deps.now();
    const today = utcDay(now);
    const [totals, online, todayPlayers] = await Promise.all([deps.stores.counters.days(dayName(statsFrom(today)), dayName(today)), onlineAt(log, now), log.players(dayStart(today), now + 1)]);
    return c.json<StatsReply>({ ok: true, stats: buildStats(deps.contents.current, { now, today, totals, online, todayPlayers }) });
  });

  return admin;
}
