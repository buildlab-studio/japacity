// `GET /api/view?since=<v>` (docs/rules/clock.md R-CLOCK-003): the view after
// the load and the turn grant, with the clock, and the lines of the rows after
// version `since` that the player did not send (lottery.md R-LOTTERY-017).
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
    const asked = c.req.query("since");
    const since = asked === undefined || asked === "" ? null : /^(0|[1-9]\d{0,14})$/.test(asked) ? Number(asked) : Number.NaN;
    if (Number.isNaN(since)) return c.json(refusal(400, "not-legal", "since is a version: a whole number.").body, 400);
    const answer = session === null ? refusal(401, "signed-out", "Sign in to play.") : await readView(deps, session.account, since);
    return c.json(answer.body, answer.status);
  });
  return route;
}
