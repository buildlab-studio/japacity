// `POST /api/command` (docs/rules/server.md R-SERVER-001): the only way a
// command reaches `step` online.
import { Hono } from "hono";

import { refusal } from "../authority/answer";
import { sendCommand } from "../authority/command";
import type { ServerDeps } from "../deps";
import type { SessionEnv } from "../limits/limit";
import { limit, sessionOf } from "../limits/limit";

export function commandRoute(deps: ServerDeps): Hono<SessionEnv> {
  const route = new Hono<SessionEnv>();
  route.post("/api/command", limit(deps, "commands"), async (c) => {
    const session = sessionOf(c);
    const body: unknown = await c.req.json().catch(() => null);
    const answer = session === null ? refusal(401, "signed-out", "Sign in to play.") : await sendCommand(deps, session.account, body);
    return c.json(answer.body, answer.status);
  });
  return route;
}
