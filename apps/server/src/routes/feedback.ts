// R-MODERATION-020: `POST /api/feedback { text, build, screen, mode }` from a
// signed-in session. The reply says only whether it was kept.
import type { ServerRejection } from "@japacity/api";
import { Hono } from "hono";

import { countFeedback } from "../analytics/live";
import type { ServerDeps } from "../deps";
import type { SessionEnv } from "../limits/limit";
import { limit, sessionOf } from "../limits/limit";
import { sendFeedback } from "../moderation/feedback";
import { countryOf } from "./place";

export function feedbackRoute(deps: ServerDeps): Hono<SessionEnv> {
  const route = new Hono<SessionEnv>();

  route.post("/api/feedback", limit(deps, "commands"), async (c) => {
    const session = sessionOf(c);
    if (session === null) return c.json<ServerRejection>({ ok: false, code: "signed-out", detail: "Sign in first." }, 401);
    const body: unknown = await c.req.json().catch(() => null);
    const country = countryOf(c.req.raw);
    const sent = await sendFeedback(deps, session.account, country, body);
    if (sent.ok) {
      // R-ANALYTICS-008: the support load, by region.
      await countFeedback(deps, country);
      return c.json({ ok: true });
    }
    const rejection: ServerRejection = { ok: false, code: sent.code, detail: sent.detail };
    if (sent.retryAfter !== undefined) {
      rejection.retryAfter = sent.retryAfter;
      c.header("Retry-After", String(sent.retryAfter));
    }
    return c.json(rejection, sent.status);
  });

  return route;
}
