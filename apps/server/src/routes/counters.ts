// `POST /api/counters` (analytics.md R-ANALYTICS-003 to 007): the client's
// batch, sent as a beacon. It always answers 204 with no body, whatever it
// dropped, so a failed batch is never something the player sees. Only the
// day's totals are written: the account, the session and the request's
// headers go no further than this handler.
import type { CounterTotal } from "@japacity/store";
import { Hono } from "hono";

import { utcDay } from "../admin/day";
import { checkBatch } from "../analytics/batch";
import { dayName } from "../analytics/day";
import type { DropReason } from "../analytics/list";
import { NO_REGION } from "../analytics/list";
import { batchAllowed } from "../analytics/rate";
import { usageCountsOn } from "../analytics/usage";
import type { ServerDeps } from "../deps";
import { overLimit } from "../limits/limit";

export type { CounterBatch, CounterRow } from "../analytics/batch";

const DROPPED = "analytics/dropped";

function droppedRows(day: string, region: string, dropped: Partial<Record<DropReason, number>>): CounterTotal[] {
  return Object.entries(dropped).map(([key, count]) => ({ day, region, name: DROPPED, key, count }));
}

export function countersRoute(deps: ServerDeps): Hono {
  const route = new Hono();

  route.post("/api/counters", async (c) => {
    const done = () => c.body(null, 204);
    const day = dayName(utcDay(deps.now()));
    const session = await deps.session(c.req.raw);
    if (session === null) {
      // R-SERVER-026: a batch with no session is counted as dropped only within the address limit.
      if ((await overLimit(deps, "reads", null, c.req.header("cf-connecting-ip") ?? null)) === null) await deps.stores.counters.add(droppedRows(day, NO_REGION, { "signed-out": 1 }));
      return done();
    }
    const account = await deps.stores.account.get(session.account);
    if (account === null) {
      await deps.stores.counters.add(droppedRows(day, NO_REGION, { "signed-out": 1 }));
      return done();
    }
    // R-ANALYTICS-006: a player who stopped the counters is not counted at all, not even as dropped.
    if (!usageCountsOn(account)) return done();
    const region = account.country === "" ? NO_REGION : account.country;
    if (!batchAllowed(deps.stores.counters, session.account, deps.now(), deps.contents.current.tuning.analytics.batchesPerHour)) {
      await deps.stores.counters.add(droppedRows(day, region, { rate: 1 }));
      return done();
    }
    const checked = checkBatch(deps.contents.current, await c.req.text());
    const counted = checked.rows.map((row) => ({ day, region, name: row.name, key: row.key, count: row.count }));
    await deps.stores.counters.add([...counted, ...droppedRows(day, region, checked.dropped)]);
    return done();
  });

  return route;
}
