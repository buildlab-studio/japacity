// The Hono app, built from its dependencies so a test can hand it in-memory
// stores and a clock. Each route file exports a function that takes the deps
// and returns a Hono router; this file only mounts them.
import { Hono } from "hono";

import type { Accounts } from "./auth/auth";
import type { ServerDeps } from "./deps";
import { accountRoutes } from "./routes/account";
import { ageRoutes } from "./routes/age";
import { authRoutes } from "./routes/auth";
import { characterRoute } from "./routes/character";
import { commandRoute } from "./routes/command";
import { notifyRoutes } from "./routes/notify";
import { placeRoutes } from "./routes/place";
import { viewRoute } from "./routes/view";
import { worldRoute } from "./routes/world";
import { adminRoutes } from "./routes/admin";
import { switchRoutes } from "./routes/admin-switches";
import { adminAnalyticsRoutes } from "./routes/admin-analytics";
import { countersRoute } from "./routes/counters";
import { cspReportRoute } from "./routes/csp";
import { feedbackRoute } from "./routes/feedback";
import { moderationAdminRoutes } from "./routes/moderation-admin";
import { moderationPorts } from "./moderation/ports";
import { conversationRoutes } from "./routes/conversation";
import { inviteRoutes } from "./routes/invite";
import { moderationRoutes } from "./routes/moderation";
import { pairRoutes } from "./routes/pair";
import { adminAdvertRoutes } from "./routes/admin-adverts";
import { advertRoutes } from "./routes/adverts";
import { boardRoutes } from "./routes/boards";
import { COUNTED_PATHS, countRefusals } from "./analytics/count";
import { isOn } from "./switches/switches";
import { bodyLimits } from "./security/body";
import { onAppError } from "./security/fail";
import { securityHeaders } from "./security/headers";
import { sameOriginWrites } from "./security/origin";

export function makeApp(deps: ServerDeps, accounts?: Accounts): Hono {
  const app = new Hono();
  // R-SERVER-043: a route that throws is logged once and answered in JSON, never the platform's error page.
  app.onError(onAppError);
  // outermost, so every reply carries the headers, a refusal below included.
  app.use(securityHeaders());
  // A write from another site, or a body too large, is refused before anything reads or counts it.
  if (accounts !== undefined) app.use(sameOriginWrites(accounts.keys.siteUrl));
  app.use(bodyLimits(deps.config.limits));
  // R-SERVER-005, R-ANALYTICS-008: around the gates and the limits, so a refusal from either is counted too.
  for (const path of COUNTED_PATHS) app.use(path, countRefusals(deps));
  // R-SERVER-031: first, so its gates run before every route they close.
  app.route("/", switchRoutes(deps));

  if (accounts !== undefined) app.route("/", authRoutes(accounts)).route("/", ageRoutes(deps, accounts)).route("/", accountRoutes(deps, accounts));

  app.get("/api/health", (c) => c.json({ ok: true, content: deps.contents.current.version, tick: currentTick(deps) }));
  app.route("/", commandRoute(deps));
  app.route("/", viewRoute(deps));
  app.route("/", worldRoute(deps));
  app.route("/", characterRoute(deps));
  app.route("/", placeRoutes(deps));
  app.route("/", notifyRoutes(deps));
  app.route("/", advertRoutes(deps, () => isOn(deps, "adverts")));
  app.route("/api/admin/adverts", adminAdvertRoutes(deps));
  app.route("/api/admin", adminRoutes(deps));
  app.route("/", countersRoute(deps)).route("/api/admin", adminAnalyticsRoutes(deps));
  // R-SERVER-041: the page's content policy reports here.
  app.route("/", cspReportRoute(deps));
  app.route("/", moderationAdminRoutes(deps, moderationPorts(deps, accounts)));
  app.route("/", feedbackRoute(deps));
  app.route("/", inviteRoutes(deps));
  app.route("/", pairRoutes(deps));
  app.route("/", conversationRoutes(deps));
  app.route("/", moderationRoutes(deps));
  app.route("/", boardRoutes(deps));

  return app;
}

/** R-CLOCK-001: the current tick from the server's clock alone. */
export function currentTick(deps: Pick<ServerDeps, "config" | "now">): number {
  const { epoch, worldTickMs } = deps.config.clock;
  return Math.max(0, Math.floor((deps.now() - epoch) / worldTickMs));
}
