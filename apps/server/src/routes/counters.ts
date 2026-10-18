// `POST /api/counters` (analytics.md R-ANALYTICS-003 to 007): the client's
// batch, sent as a beacon. It always answers 204 with no body, whatever it
// dropped, so a failed batch is never something the player sees. Only the
// day's totals are written: the account, the session and the request's
// headers go no further than this handler.
import type { CounterTotal } from "@japacity/store";
import { Hono } from "hono";

import { utcDay } from "../ops/day";
import { advertRegion } from "../advert/campaign";
import { addAdvertCounters, withinAccountDay } from "../advert/counts";
import { checkBatch, isDoorRow } from "../analytics/batch";
import { dayName } from "../analytics/day";
import type { DropReason } from "../analytics/list";
import { NO_REGION } from "../analytics/list";
import { batchAllowed } from "../analytics/rate";
import { usageCountsOn } from "../analytics/usage";
import type { ServerDeps } from "../deps";
import { overLimit } from "../limits/limit";
import { countryOf } from "./place";

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
      // R-SERVER-026: a batch with no session is looked at only within the address limit.
      if ((await overLimit(deps, "reads", null, c.req.header("cf-connecting-ip") ?? null)) !== null) return done();
      // R-ANALYTICS-004: the door's three screens may arrive signed out, since the door is
      // before any account; they are counted under the request's region. Nothing else may: it is dropped signed out.
      const checked = checkBatch(deps.contents.current, await c.req.text());
      const door = checked.rows.filter(isDoorRow);
      const refused = checked.rows.length - door.length;
      const country = countryOf(c.req.raw);
      const region = country !== null && /^[A-Z]{2}$/.test(country) ? country : NO_REGION;
      const dropped = refused > 0 || door.length === 0 ? { ...checked.dropped, "signed-out": 1 } : checked.dropped;
      await deps.stores.counters.add([...door.map((row) => ({ day, region, name: row.name, key: row.key, count: row.count })), ...droppedRows(day, NO_REGION, dropped)]);
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
    // R-ADVERT-020: the advert rows also reach the campaign's daily totals, by the slot and the hour's campaign there,
    // up to one account's allowance for the day.
    const allowed = await withinAccountDay(deps, session.account, deps.now(), checked.rows);
    await addAdvertCounters(deps, advertRegion(deps.config.advert.regions, account.country), deps.now(), allowed);
    return done();
  });

  return route;
}
