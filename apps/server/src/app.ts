// The Hono app, built from its dependencies so a test can hand it in-memory
// stores and a clock. Each route file exports a function that takes the deps
// and returns a Hono router; this file only mounts them.
import { Hono } from "hono";

import type { Accounts } from "./auth/auth";
import { sessionCookies } from "./auth/session";
import type { ServerDeps } from "./dependencies";
import { accountRoutes } from "./routes/account";
import { ageRoutes } from "./routes/age";
import { authRoutes } from "./routes/auth";
import { characterRoute } from "./routes/character";
import { commandRoute } from "./routes/command";
import { notifyRoutes } from "./routes/notify";
import { viewRoute } from "./routes/view";
import { worldRoute } from "./routes/world";
import { lightsRoute } from "./routes/lights";
import { dedicationRoutes } from "./routes/dedication";
import { adminDedicationRoutes } from "./routes/admin/dedication";
import { adminRoutes } from "./routes/admin/admin";
import { adminSwitchRoutes } from "./routes/admin/switches";
import { adminAnalyticsRoutes } from "./routes/admin/analytics";
import { countersRoute } from "./routes/counters";
import { cspReportRoute } from "./routes/csp";
import { feedbackRoute } from "./routes/feedback";
import { adminModerationRoutes } from "./routes/admin/moderation";
import { moderationPorts } from "./moderation/ports";
import { conversationRoutes } from "./routes/conversation";
import { inviteRoutes } from "./routes/invite";
import { moderationRoutes } from "./routes/moderation";
import { pairRoutes } from "./routes/pair";
import { adminAdvertRoutes } from "./routes/admin/advert";
import { advertRoutes } from "./routes/advert";
import { boardRoutes } from "./routes/boards";
import { COUNTED_PATHS, countRefusals } from "./analytics/count";
import { isOn } from "./switches/switches";
import { bodyLimits } from "./security/body";
import { onAppError } from "./security/fail";
import { securityHeaders } from "./security/headers";
import { sameOriginWrites } from "./security/origin";
import { storablePaths } from "./security/storable";

export function makeApp(deps: ServerDeps, accounts?: Accounts): Hono {
  const app = new Hono();
  // server:no-platform-error-page: a route that throws is logged once and answered in JSON, never the platform's error page.
  app.onError(onAppError);
  // Outermost, so every reply carries the headers, a refusal below included.
  app.use(securityHeaders());
  // A write from another site, or a body too large, is refused before anything reads or counts it.
  if (accounts !== undefined) app.use(sameOriginWrites(accounts.keys.siteUrl));
  app.use(bodyLimits(deps.config.limits));
  // An id Postgres cannot store is refused before any gate or route reads it.
  app.use("/api/*", storablePaths());
  // account:dead-cookie-expired-on-first-read, account:session-renewal-reaches-browser: inside the body limit, whose
  // request is the one every gate and route below reads the session from.
  if (accounts !== undefined) app.use(sessionCookies());
  // server:rejections-write-nothing, analytics:nightly-game-counters: around the gates and the limits, so a refusal from either is counted too.
  for (const path of COUNTED_PATHS) app.use(path, countRefusals(deps));
  // server:four-off-switches: first, so its gates run before every route they close.
  app.route("/", adminSwitchRoutes(deps));

  if (accounts !== undefined) app.route("/", authRoutes(accounts)).route("/", ageRoutes(deps, accounts)).route("/", accountRoutes(deps, accounts));

  app.get("/api/health", (c) => c.json({ ok: true, content: deps.contents.current.version, tick: currentTick(deps) }));
  app.route("/", commandRoute(deps));
  app.route("/", viewRoute(deps));
  app.route("/", worldRoute(deps));
  app.route("/", lightsRoute(deps));
  app.route("/", dedicationRoutes(deps));
  app.route("/", adminDedicationRoutes(deps));
  app.route("/", characterRoute(deps));
  app.route("/", notifyRoutes(deps));
  app.route("/", advertRoutes(deps, () => isOn(deps, "adverts")));
  app.route("/api/admin/adverts", adminAdvertRoutes(deps));
  app.route("/api/admin", adminRoutes(deps));
  app.route("/", countersRoute(deps)).route("/api/admin", adminAnalyticsRoutes(deps));
  // server:csp-reports-to-own-origin: the page's content policy reports here.
  app.route("/", cspReportRoute(deps));
  app.route("/", adminModerationRoutes(deps, moderationPorts(deps, accounts)));
  app.route("/", feedbackRoute(deps));
  app.route("/", inviteRoutes(deps));
  app.route("/", pairRoutes(deps));
  app.route("/", conversationRoutes(deps));
  app.route("/", moderationRoutes(deps));
  app.route("/", boardRoutes(deps));

  return app;
}

/** clock:server-owns-the-clock: the current tick from the server's clock alone. */
export function currentTick(deps: Pick<ServerDeps, "config" | "now">): number {
  const { epoch, worldTickMs } = deps.config.clock;
  return Math.max(0, Math.floor((deps.now() - epoch) / worldTickMs));
}
