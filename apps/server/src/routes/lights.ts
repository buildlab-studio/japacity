// `GET /api/lights` (account:two-lights-and-wink-lines): the two lights over
// the start screen, the lives at home and abroad and those back this month,
// the whole game's, rounded to the nearest ten. Counts only: no session is
// read, nothing about the asker enters the reply or the key, and nothing is
// logged. Counted against the address limit first (server:anonymous-limit-by-address), then kept in
// the server's cache by the hour (server:public-replies-cached) and public to the
// browser until the hour ends, so the counters are read at most once an hour
// in each location the Worker runs in.
import type { LightsReply } from "@japacity/api";
import { int, time } from "@japacity/sim";
import { Hono } from "hono";

import { lightsOf } from "../analytics/lights";
import type { ServerDeps } from "../dependencies";
import { overLimit } from "../limits/limit";
import type { EdgeCache, Made } from "./cache";
import { edgeCache, edgeKey, JSON_TYPE, sent, throughEdge } from "./cache";

const LIGHTS_PATH = "/api/lights";

/** Before any counter was kept: the first day the read asks for. */
const EVER = "2000-01-01";

/** The first day of the UTC month of `now`, `YYYY-MM-DD`. */
function monthOf(now: number): string {
  return `${time.dayName(time.utcDay(now)).slice(0, 7)}-01`;
}

export function lightsRoute(deps: ServerDeps, edge: EdgeCache | null = edgeCache()): Hono {
  const route = new Hono();
  route.get(LIGHTS_PATH, async (c) => {
    // server:anonymous-limit-by-address: no session is read here, so every asker counts against the address limit.
    const refused = await overLimit(deps, "reads", null, c.req.header("cf-connecting-ip") ?? null);
    if (refused !== null) return c.json(refused, 429);
    const now = deps.now();
    const hour = int.divFloor(now, time.HOUR_MS);
    const key = edgeKey(new URL(c.req.url).origin, ["lights", hour]);
    const served = await throughEdge(edge, key, now, async (): Promise<Made> => {
      const totals = await deps.stores.counters.days(EVER, time.dayName(time.utcDay(now)));
      const reply: LightsReply = { ok: true, ...lightsOf({ totals, monthFrom: monthOf(now) }) };
      return { body: JSON.stringify(reply), type: JSON_TYPE, freshUntil: (hour + 1) * time.HOUR_MS };
    });
    return sent(c, served);
  });
  return route;
}
