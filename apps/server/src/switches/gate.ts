// The off switches over the routes (docs/rules/server.md R-SERVER-031). A
// request whose switch is off is answered 503 `switched-off` before its route
// runs, so nothing is stepped, logged or stored. Reads of the view, the world
// and a draw are never gated.
import type { CommandType } from "@japacity/sim";
import type { SwitchName } from "@japacity/store";
import { Hono } from "hono";
import type { Context, MiddlewareHandler } from "hono";

import type { ServerDeps } from "../deps";
import { isOn, retryAfterSeconds, switchedOff } from "./switches";

/** R-SERVER-031: the commands a switch stops before they reach `step`. */
export const GATED_COMMANDS: Partial<Record<CommandType, SwitchName>> = {
  "lottery/buy": "lottery",
  // Makes an invite card (R-PEOPLE-012 to 014); computer candidates go on through people/court.
  "people/invite": "partnerPlay",
};

/**
 * R-SERVER-031: the routes a switch closes, by path pattern, every method.
 * The sign-up path is the age screen, which a signed-out returning
 * player also passes on a new browser; the server cannot tell the two apart
 * before sign-in, so both see the full screen while `signups` is off.
 */
export const GATED_PATHS: readonly { path: string; name: SwitchName; reads: boolean }[] = [
  { path: "/api/age", name: "signups", reads: true },
  { path: "/api/adverts", name: "adverts", reads: true },
  { path: "/api/adverts/*", name: "adverts", reads: true },
  // A route that only serves a pair that exists must stay open (R-SERVER-031), so these close writes only.
  { path: "/api/pair", name: "partnerPlay", reads: false },
  { path: "/api/pair/*", name: "partnerPlay", reads: false },
  { path: "/api/people", name: "partnerPlay", reads: false },
  { path: "/api/people/*", name: "partnerPlay", reads: false },
  { path: "/api/invite", name: "partnerPlay", reads: false },
  { path: "/api/invite/*", name: "partnerPlay", reads: false },
];

function refuse(c: Context, deps: ServerDeps, name: SwitchName): Response {
  c.header("Retry-After", String(retryAfterSeconds(deps)));
  return c.json(switchedOff(deps, name), 503);
}

/** Closes a route while `name` is off. `reads` false lets GET and HEAD through. */
export function switchGate(deps: ServerDeps, name: SwitchName, reads = true): MiddlewareHandler {
  return async (c, next) => {
    const read = c.req.method === "GET" || c.req.method === "HEAD";
    if ((reads || !read) && !(await isOn(deps, name))) return refuse(c, deps, name);
    await next();
    return undefined;
  };
}

/** The command's type from a request body, or null when the body is not a command. */
function commandTypeOf(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("command" in body)) return null;
  const command = body.command;
  if (typeof command !== "object" || command === null || !("type" in command)) return null;
  const type = command.type;
  return typeof type === "string" ? type : null;
}

/** R-SERVER-031: refuses a gated command; the route reads the same body again from Hono's cache. */
export function commandGate(deps: ServerDeps): MiddlewareHandler {
  return async (c, next) => {
    if (c.req.method !== "POST") {
      await next();
      return undefined;
    }
    const type = commandTypeOf(await c.req.json().catch(() => null));
    const name = type === null ? undefined : GATED_COMMANDS[type as CommandType];
    if (name !== undefined && !(await isOn(deps, name))) return refuse(c, deps, name);
    await next();
    return undefined;
  };
}

/** Every gate, as one router mounted before the routes it guards. */
export function switchGates(deps: ServerDeps): Hono {
  const gates = new Hono();
  for (const { path, name, reads } of GATED_PATHS) gates.use(path, switchGate(deps, name, reads));
  gates.use("/api/command", commandGate(deps));
  return gates;
}
