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
import { placeRoutes } from "./routes/place";
import { viewRoute } from "./routes/view";
import { worldRoute } from "./routes/world";
import { adminRoutes } from "./routes/admin";
import { adminAnalyticsRoutes } from "./routes/admin-analytics";
import { countersRoute } from "./routes/counters";

export function makeApp(deps: ServerDeps, accounts?: Accounts): Hono {
  const app = new Hono();

  if (accounts !== undefined) app.route("/", authRoutes(accounts)).route("/", ageRoutes(deps, accounts)).route("/", accountRoutes(deps, accounts));

  app.get("/api/health", (c) => c.json({ ok: true, content: deps.contents.current.version, tick: currentTick(deps) }));
  app.route("/", commandRoute(deps));
  app.route("/", viewRoute(deps));
  app.route("/", worldRoute(deps));
  app.route("/", characterRoute(deps));
  app.route("/", placeRoutes(deps));
  app.route("/api/admin", adminRoutes(deps));
  app.route("/", countersRoute(deps)).route("/api/admin", adminAnalyticsRoutes(deps));

  return app;
}

/** R-CLOCK-001: the current tick from the server's clock alone. */
export function currentTick(deps: Pick<ServerDeps, "config" | "now">): number {
  const { epoch, worldTickMs } = deps.config.clock;
  return Math.max(0, Math.floor((deps.now() - epoch) / worldTickMs));
}
