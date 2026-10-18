// `GET /api/world` (clock:client-gets-current-world-only, clock:world-fetch-is-jittered): the world
// of the current tick, the same for everyone. Kept in the server's cache (the
// Cache API beside the Worker) by its tick until the next tick (server.md
// server:public-replies-cached), so the database is read for it once per tick per location,
// and public to the browser for as long. Needs no session. Never the book, never a later tick.
import type { WorldReply } from "@japacity/api";
import { int, time } from "@japacity/sim";
import { Hono } from "hono";

import { tickAt, tickStartsAt } from "../clock/view";
import type { ServerDeps } from "../deps";
import type { SessionEnv } from "../limits/limit";
import { limit } from "../limits/limit";
import { tickRow } from "../world/ticks";
import type { EdgeCache, Made } from "./cache";
import { edgeCache, edgeKey, JSON_TYPE, sent, throughEdge } from "./cache";

/** clock:client-gets-current-world-only: the reply for the tick of `at`, and the seconds it may be cached. */
async function worldReply(deps: ServerDeps, at: number): Promise<{ reply: WorldReply; maxAge: number }> {
  const tick = tickAt(deps.config.clock, at);
  const row = await tickRow(deps, tick);
  const nextTickAt = tickStartsAt(deps.config.clock, tick + 1);
  return { reply: { tick, world: row.world, nextTickAt }, maxAge: int.divCeil(nextTickAt - at, time.SECOND_MS) };
}

/** clock:world-fetch-is-jittered, server:public-replies-cached: the limit first, then the cache by the tick, then the database once. */
export function worldRoute(deps: ServerDeps, edge: EdgeCache | null = edgeCache()): Hono<SessionEnv> {
  const route = new Hono<SessionEnv>();
  route.get("/api/world", limit(deps, "reads"), async (c) => {
    const now = deps.now();
    const key = edgeKey(new URL(c.req.url).origin, ["world", tickAt(deps.config.clock, now)]);
    const served = await throughEdge(edge, key, now, async (): Promise<Made> => {
      const { reply } = await worldReply(deps, now);
      return { body: JSON.stringify(reply), type: JSON_TYPE, freshUntil: reply.nextTickAt };
    });
    return sent(c, served);
  });
  return route;
}
