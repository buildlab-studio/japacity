// The rate limits over the routes (server:per-account-rate-limits, server:anonymous-limit-by-address, server:limits-are-approximate). A request over a limit is answered 429 before its route runs, so
// nothing is stepped and nothing is logged.
import type { ServerRejection } from "@japacity/api";
import type { Context, MiddlewareHandler } from "hono";

import type { Limiter, ServerDeps } from "../dependencies";
import { addressKey } from "./address";

/** The signed-in account, read once by the limit and kept for the route. */
export interface SessionEnv {
  Variables: { session: { account: string } | null };
}

/** Which limits a route counts against when signed in. */
export type Gate = "commands" | "reads";

/** server:anonymous-limit-by-address: a request with no address header is counted under one key. */
const NO_ADDRESS = "no-address";

function gatesOf(deps: ServerDeps, gate: Gate): { limiter: Limiter; seconds: number }[] {
  switch (gate) {
    case "commands":
      return [
        { limiter: deps.limits.commands10s, seconds: 10 },
        { limiter: deps.limits.commands60s, seconds: 60 },
      ];
    case "reads":
      return [{ limiter: deps.limits.reads60s, seconds: 60 }];
    default: {
      const never: never = gate;
      throw new Error(`Unknown gate ${String(never)}.`);
    }
  }
}

/** server:per-account-rate-limits, server:anonymous-limit-by-address: the refusal for a request over a limit, or null. A limit passed is counted; the next is not asked once one refuses. An address is counted under its key (`addressKey`), so every route that limits by address keys an IPv6 one by its /64. */
export async function overLimit(deps: ServerDeps, gate: Gate, account: string | null, address: string | null): Promise<ServerRejection | null> {
  const checks = account === null ? [{ limiter: deps.limits.anon60s, seconds: 60, key: address === null ? NO_ADDRESS : addressKey(address) }] : gatesOf(deps, gate).map((each) => ({ ...each, key: account }));
  for (const check of checks) {
    const { success } = await check.limiter.limit({ key: check.key });
    if (!success) return { ok: false, code: "rate-limited", detail: "Too many requests. Try again in a moment.", retryAfter: check.seconds };
  }
  return null;
}

/** Reads the session and applies the limits of `gate`; a route behind it reads the session with `sessionOf`. */
export function limit(deps: ServerDeps, gate: Gate): MiddlewareHandler<SessionEnv> {
  return async (c, next) => {
    const session = await deps.session(c.req.raw);
    c.set("session", session);
    const refused = await overLimit(deps, gate, session?.account ?? null, c.req.header("cf-connecting-ip") ?? null);
    if (refused !== null) return c.json(refused, 429);
    await next();
  };
}

/** The session `limit` read for this request. */
export function sessionOf(c: Context<SessionEnv>): { account: string } | null {
  return c.get("session");
}
