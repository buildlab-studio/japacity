// Block and report (moderation:block-refuses-both-ways, moderation:block-ends-pair-records, moderation:report-from-every-surface, moderation:report-carries-subject-and-reason, moderation:spoken-phrases-not-stored, moderation:report-offers-block, moderation:reporter-told-outcome-only and moderation:reports-hold-cited-records, pair.md
// pair:block-ends-every-bond, pair:report-holds-conversation): `POST /api/moderation/block`, `/unblock` and `/report`.
import { Hono } from "hono";

import type { ServerDeps } from "../dependencies";
import type { SessionEnv } from "../limits/limit";
import { limit, sessionOf } from "../limits/limit";
import type { PairAnswer } from "../pair/codes";
import { refused } from "../pair/codes";
import { block, report, unblock } from "../pair/moderation";

type Handler = (deps: ServerDeps, account: string, body: unknown) => Promise<PairAnswer<unknown>>;

export function moderationRoutes(deps: ServerDeps): Hono<SessionEnv> {
  const route = new Hono<SessionEnv>();
  const handlers: [string, Handler][] = [
    ["/api/moderation/block", block],
    ["/api/moderation/unblock", unblock],
    ["/api/moderation/report", report],
  ];
  for (const [path, handler] of handlers) {
    route.post(path, limit(deps, "commands"), async (c) => {
      const session = sessionOf(c);
      const body: unknown = await c.req.json().catch(() => null);
      const answer = session === null ? refused(401, "signed-out", "Sign in to play.") : await handler(deps, session.account, body);
      return c.json(answer.body, answer.status);
    });
  }
  return route;
}
