// A pair's conversation in preset phrases (docs/rules/pair.md R-PAIR-011,
// R-PAIR-013): `POST /api/pair/:pair/say` and
// `GET /api/pair/:pair/conversation?after=`.
import { Hono } from "hono";

import type { ServerDeps } from "../deps";
import type { SessionEnv } from "../limits/limit";
import { limit, sessionOf } from "../limits/limit";
import { refused } from "../pair/codes";
import { readConversation, say } from "../pair/conversation";

export function conversationRoutes(deps: ServerDeps): Hono<SessionEnv> {
  const route = new Hono<SessionEnv>();
  route.post("/api/pair/:pair/say", limit(deps, "commands"), async (c) => {
    const session = sessionOf(c);
    const body: unknown = await c.req.json().catch(() => null);
    const answer = session === null ? refused(401, "signed-out", "Sign in to play.") : await say(deps, session.account, c.req.param("pair"), body);
    return c.json(answer.body, answer.status);
  });
  route.get("/api/pair/:pair/conversation", limit(deps, "reads"), async (c) => {
    const session = sessionOf(c);
    const after = c.req.query("after") ?? null;
    const answer = session === null ? refused(401, "signed-out", "Sign in to play.") : await readConversation(deps, session.account, c.req.param("pair"), after === "" ? null : after);
    return c.json(answer.body, answer.status);
  });
  return route;
}
