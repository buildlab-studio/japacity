// The invite routes (pair:invite-card-contents, pair:invite-link-single-use and pair:invite-rewards-never-cash):
// `POST /api/invite`, `GET /api/invite`, `GET /api/invite/:code` (no session
// needed: the card is what a link shows before sign-up) and
// `POST /api/invite/:code/accept`.
import { Hono } from "hono";

import type { ServerDeps } from "../deps";
import type { SessionEnv } from "../limits/limit";
import { limit, sessionOf } from "../limits/limit";
import { refused } from "../pair/codes";
import { acceptInvite, listInvites, makeInvite, showInvite } from "../pair/invite";

const SIGNED_OUT = "Sign in to play.";

export function inviteRoutes(deps: ServerDeps): Hono<SessionEnv> {
  const route = new Hono<SessionEnv>();
  route.post("/api/invite", limit(deps, "commands"), async (c) => {
    const session = sessionOf(c);
    const body: unknown = await c.req.json().catch(() => null);
    const answer = session === null ? refused(401, "signed-out", SIGNED_OUT) : await makeInvite(deps, session.account, body);
    return c.json(answer.body, answer.status);
  });
  route.get("/api/invite", limit(deps, "reads"), async (c) => {
    const session = sessionOf(c);
    const answer = session === null ? refused(401, "signed-out", SIGNED_OUT) : await listInvites(deps, session.account);
    return c.json(answer.body, answer.status);
  });
  route.get("/api/invite/:code", limit(deps, "reads"), async (c) => {
    const answer = await showInvite(deps, c.req.param("code"));
    return c.json(answer.body, answer.status);
  });
  route.post("/api/invite/:code/accept", limit(deps, "commands"), async (c) => {
    const session = sessionOf(c);
    const body: unknown = await c.req.json().catch(() => null);
    const answer = session === null ? refused(401, "signed-out", "Sign up and pass the age screen to take the card.") : await acceptInvite(deps, session.account, c.req.param("code"), body);
    return c.json(answer.body, answer.status);
  });
  return route;
}
