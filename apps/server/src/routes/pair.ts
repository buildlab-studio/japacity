// The pair record as one side reads it (pair:who-may-read-a-record):
// `GET /api/pair/:pair`.
import { Hono } from "hono";

import type { ServerDeps } from "../deps";
import type { SessionEnv } from "../limits/limit";
import { limit, sessionOf } from "../limits/limit";
import { refused } from "../pair/codes";
import { readPair } from "../pair/conversation";

export function pairRoutes(deps: ServerDeps): Hono<SessionEnv> {
  const route = new Hono<SessionEnv>();
  route.get("/api/pair/:pair", limit(deps, "reads"), async (c) => {
    const session = sessionOf(c);
    const answer = session === null ? refused(401, "signed-out", "Sign in to play.") : await readPair(deps, session.account, c.req.param("pair"));
    return c.json(answer.body, answer.status);
  });
  return route;
}
