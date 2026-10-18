// R-MODERATION-010 to 016, R-MODERATION-019, R-MODERATION-020: the admin
// view's moderation routes under /api/admin/moderation, which do not exist for
// anyone off `config.admin.accounts` (R-SERVER-012), and the player's own two:
// their standing and an appeal. The log has no route that changes or removes
// an entry (R-MODERATION-015).
import type { StandingReply } from "@japacity/api";
import { Hono } from "hono";
import type { Context } from "hono";

import type { ServerDeps } from "../../deps";
import type { SessionEnv } from "../../limits/limit";
import { limit } from "../../limits/limit";
import { closeReport, decideAppeal, fileAppeal, type ModerationPorts } from "../../moderation/decide";
import { readQueue } from "../../moderation/queue";
import { standingOf } from "../../moderation/standing";
import { adminOnly } from "./admin";
import type { AdminEnv } from "./admin";
import { refuse } from "../reply";

const FEEDBACK_PAGE = 200;

async function readBody(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

/** The admin gate sets `admin`; the player's two routes go through the limits, which set `session`. */
type ModerationEnv = { Variables: AdminEnv["Variables"] & SessionEnv["Variables"] };

export function adminModerationRoutes(deps: ServerDeps, ports: ModerationPorts): Hono<ModerationEnv> {
  const routes = new Hono<ModerationEnv>();

  routes.use("/api/admin/moderation/*", adminOnly(deps));

  routes.get("/api/admin/moderation/queue", async (c) => c.json({ ok: true, queue: await readQueue(deps, ports.reports) }));

  routes.post("/api/admin/moderation/:item/close", async (c) => {
    const item = c.req.param("item");
    const body = await readBody(c);
    const admin = c.get("admin");
    const decided = (await deps.stores.appeals.get(item)) === null ? await closeReport(deps, ports, admin, item, body) : await decideAppeal(deps, admin, item, body);
    return decided.ok ? c.json(decided) : refuse(c, decided.status, decided.code, decided.detail);
  });

  routes.get("/api/admin/moderation/log", async (c) => {
    const item = c.req.query("item");
    const account = c.req.query("account");
    if (item === undefined && account === undefined) return refuse(c, 400, "not-legal", "Name an item or an account.");
    return c.json({ ok: true, entries: await deps.stores.moderationLog.list({ ...(item === undefined ? {} : { item }), ...(account === undefined ? {} : { account }) }) });
  });

  routes.get("/api/admin/moderation/feedback", async (c) => c.json({ ok: true, feedback: await deps.stores.feedback.list(FEEDBACK_PAGE) }));

  routes.get("/api/moderation/standing", limit(deps, "reads"), async (c) => {
    const session = c.get("session");
    if (session === null) return refuse(c, 401, "signed-out", "Sign in first.");
    return c.json<StandingReply>({ ok: true, standing: await standingOf(deps, ports.reports, session.account) });
  });

  routes.post("/api/moderation/appeal", limit(deps, "commands"), async (c) => {
    const session = c.get("session");
    if (session === null) return refuse(c, 401, "signed-out", "Sign in first.");
    const filed = await fileAppeal(deps, session.account, await readBody(c));
    return filed.ok ? c.json({ ok: true, appeal: { id: filed.appeal.id, entry: filed.appeal.entry, status: filed.appeal.status } }) : refuse(c, filed.status, filed.code, filed.detail);
  });

  return routes;
}
