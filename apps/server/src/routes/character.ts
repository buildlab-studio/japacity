// `POST /api/character` (server:hidden-values-made-once, account.md
// account:one-character-per-account): the account's one character. `POST /api/character/end`
// (account:start-a-new-life): that character ended for good, so another may start.
import type { KeptPersonWire } from "@japacity/api";
import type { Id } from "@japacity/sim";
import { Hono } from "hono";

import { keptPersonOf } from "../account/person";
import { refusal } from "../authority/answer";
import { endCharacter, newCharacter } from "../authority/character";
import type { ServerDeps } from "../deps";
import type { SessionEnv } from "../limits/limit";
import { limit, sessionOf } from "../limits/limit";

/** The scenario asked for and the person built at the door (account:person-kept-with-character), or why the body is refused. */
function requestOf(body: unknown): { ok: true; scenario: Id<"scenario">; person: KeptPersonWire | null } | { ok: false; code: "unknown-id" | "not-legal"; detail: string } {
  const { scenario, person } = typeof body === "object" && body !== null ? (body as { scenario?: unknown; person?: unknown }) : {};
  if (typeof scenario !== "string") return { ok: false, code: "unknown-id", detail: "Name the scenario the character starts in." };
  if (person === undefined || person === null) return { ok: true, scenario: scenario as Id<"scenario">, person: null };
  const kept = keptPersonOf(person);
  return kept.ok ? { ok: true, scenario: scenario as Id<"scenario">, person: kept.person } : { ok: false, code: "not-legal", detail: kept.detail };
}

export function characterRoute(deps: ServerDeps): Hono<SessionEnv> {
  const route = new Hono<SessionEnv>();
  route.post("/api/character", limit(deps, "commands"), async (c) => {
    const session = sessionOf(c);
    const asked = requestOf(await c.req.json().catch(() => null));
    const answer =
      session === null
        ? refusal(401, "signed-out", "Sign in to play.")
        : !asked.ok
          ? refusal(400, asked.code, asked.detail)
          : await newCharacter(deps, session.account, asked.scenario, undefined, asked.person);
    return c.json(answer.body, answer.status);
  });
  route.post("/api/character/end", limit(deps, "commands"), async (c) => {
    const session = sessionOf(c);
    const answer = session === null ? refusal(401, "signed-out", "Sign in to end this life.") : await endCharacter(deps, session.account);
    return c.json(answer.body, answer.status);
  });
  return route;
}
