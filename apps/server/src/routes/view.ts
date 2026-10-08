// `GET /api/view` (docs/rules/clock.md R-CLOCK-003): the view after the load
// and the turn grant, with the clock.
import { Hono } from "hono";

import { refusal } from "../authority/answer";
import { readView } from "../authority/command";
import type { ServerDeps } from "../deps";
import type { SessionEnv } from "../limits/limit";
import { limit, sessionOf } from "../limits/limit";

export function viewRoute(deps: ServerDeps): Hono<SessionEnv> {
  const route = new Hono<SessionEnv>();
  route.get("/api/view", limit(deps, "reads"), async (c) => {
    const session = sessionOf(c);
    const answer = session === null ? refusal(401, "signed-out", "Sign in to play.") : await readView(deps, session.account);
    return c.json(answer.body, answer.status);
  });
  return route;
}
