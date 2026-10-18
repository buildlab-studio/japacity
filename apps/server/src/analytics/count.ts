// R-SERVER-005, R-ANALYTICS-008: every refusal a command route answers is
// counted by code, for the admin page in the isolate and as the day's
// `command/rejected` total. A refusal writes nothing else, so the counts are
// taken from the reply after the route has run.
import type { ServerCode } from "@japacity/api";
import type { MiddlewareHandler } from "hono";

import { countRejection } from "../admin/rejections";
import type { ServerDeps } from "../deps";
import { countRejected } from "./rejected";
import { counterDef, keyAllowed } from "./list";

/** The routes that act for a player: the command and the prologue's preset (R-SERVER-046), and the people routes that change a life, a record or a block. */
export const COUNTED_PATHS: readonly string[] = ["/api/command", "/api/prologue/preset", "/api/invite", "/api/invite/*", "/api/pair/*", "/api/moderation/block", "/api/moderation/unblock", "/api/moderation/report"];

/** The code of a refusal body, or null for an accepted reply or anything that is not JSON. */
async function refusalCode(response: Response): Promise<string | null> {
  if (!(response.headers.get("content-type") ?? "").includes("application/json")) return null;
  const body: unknown = await response
    .clone()
    .json()
    .catch(() => null);
  if (typeof body !== "object" || body === null) return null;
  const { ok, code } = body as { ok?: unknown; code?: unknown };
  return ok === false && typeof code === "string" ? code : null;
}

/** Counts the refusals of POST requests under it; a code off the counter's list is not one the server answers, and is left out. */
export function countRefusals(deps: ServerDeps): MiddlewareHandler<{ Variables: { session?: { account: string } | null } }> {
  return async (c, next) => {
    await next();
    if (c.req.method !== "POST") return;
    const code = await refusalCode(c.res);
    if (code === null) return;
    const def = counterDef(deps.contents.current, "command/rejected");
    if (def === null || !keyAllowed(deps.contents.current, def, code)) return;
    const known = c.get("session");
    const session = known === undefined ? await deps.session(c.req.raw) : known;
    countRejection(code as ServerCode);
    await countRejected(deps, session?.account ?? null, code as ServerCode);
  };
}
