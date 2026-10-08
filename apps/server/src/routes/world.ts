// `GET /api/world` (docs/rules/clock.md R-CLOCK-018, R-CLOCK-019): the world
// of the current tick, the same for everyone, cached at the edge until the
// next tick. Needs no session. Never the book, never a later tick.
import { int, time } from "@japacity/sim";
import { Hono } from "hono";

import { tickAt, tickStartsAt } from "../clock/view";
import type { ServerDeps } from "../deps";
import type { SessionEnv } from "../limits/limit";
import { limit } from "../limits/limit";
import type { WorldReply } from "../types";
import { tickRow } from "../world/ticks";

/** R-CLOCK-018: the reply for the tick of `at`, and the seconds it may be cached. */
export async function worldReply(deps: ServerDeps, at: number): Promise<{ reply: WorldReply; maxAge: number }> {
  const tick = tickAt(deps.config.clock, at);
  const row = await tickRow(deps, tick);
  const nextTickAt = tickStartsAt(deps.config.clock, tick + 1);
  return { reply: { tick, world: row.world, nextTickAt }, maxAge: int.divCeil(nextTickAt - at, time.SECOND_MS) };
}

export function worldRoute(deps: ServerDeps): Hono<SessionEnv> {
  const route = new Hono<SessionEnv>();
  route.get("/api/world", limit(deps, "reads"), async (c) => {
    const { reply, maxAge } = await worldReply(deps, deps.now());
    c.header("cache-control", `public, max-age=${String(maxAge)}`);
    return c.json(reply);
  });
  return route;
}
