// Block and report (moderation:block-refuses-both-ways, moderation:block-ends-pair-records, moderation:report-from-every-surface, moderation:report-carries-subject-and-reason, moderation:spoken-phrases-not-stored, moderation:report-offers-block, moderation:reporter-told-outcome-only and moderation:reports-hold-cited-records, pair.md
// pair:block-ends-every-bond, pair:report-holds-conversation, moderation:blocked-list-in-settings): `POST /api/moderation/block`, `/unblock` and `/report`,
// and `GET /api/moderation/blocked`, the player's blocked list.
import type { BlockedListReply } from "@japacity/api";
import { Hono } from "hono";

import type { ServerDeps } from "../dependencies";
import type { SessionEnv } from "../limits/limit";
import { limit, sessionOf } from "../limits/limit";
import type { PairAnswer } from "../pair/codes";
import { refused } from "../pair/codes";
import { block, blockedList, report, unblock } from "../pair/moderation";
import { keepNone } from "./reply";

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
  // moderation:blocked-list-in-settings: behind the same session and limits as the moderation commands.
  route.get("/api/moderation/blocked", limit(deps, "reads"), async (c) => {
    const session = sessionOf(c);
    const answer = session === null ? refused(401, "signed-out", "Sign in to play.") : { status: 200 as const, body: await blockedList(deps, session.account) };
    // The list is the blocker's alone and changes with every block.
    keepNone(c);
    return c.json<BlockedListReply>(answer.body, answer.status);
  });
  return route;
}
