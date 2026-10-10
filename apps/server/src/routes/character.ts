// `POST /api/character` (docs/rules/server.md R-SERVER-016, account.md
// R-ACCOUNT-015): the account's one character. `POST /api/character/end`
// (R-ACCOUNT-030): that character ended for good, so another may start.
import type { Id } from "@japacity/sim";
import { Hono } from "hono";

import { refusal } from "../authority/answer";
import { endCharacter, newCharacter } from "../authority/character";
import type { ServerDeps } from "../deps";
import type { SessionEnv } from "../limits/limit";
import { limit, sessionOf } from "../limits/limit";

function scenarioOf(body: unknown): Id<"scenario"> | null {
  if (typeof body !== "object" || body === null) return null;
  const { scenario } = body as { scenario?: unknown };
  return typeof scenario === "string" ? (scenario as Id<"scenario">) : null;
}

export function characterRoute(deps: ServerDeps): Hono<SessionEnv> {
  const route = new Hono<SessionEnv>();
  route.post("/api/character", limit(deps, "commands"), async (c) => {
    const session = sessionOf(c);
    const scenario = scenarioOf(await c.req.json().catch(() => null));
    const answer =
      session === null
        ? refusal(401, "signed-out", "Sign in to play.")
        : scenario === null
          ? refusal(400, "unknown-id", "Name the scenario the character starts in.")
          : await newCharacter(deps, session.account, scenario);
    return c.json(answer.body, answer.status);
  });
  route.post("/api/character/end", limit(deps, "commands"), async (c) => {
    const session = sessionOf(c);
    const answer = session === null ? refusal(401, "signed-out", "Sign in to end this life.") : await endCharacter(deps, session.account);
    return c.json(answer.body, answer.status);
  });
  return route;
}
