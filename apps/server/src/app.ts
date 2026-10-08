// The Hono app, built from its dependencies so a test can hand it in-memory
// stores and a clock. Each route file exports a function that takes the deps
// and returns a Hono router; this file only mounts them.
import { Hono } from "hono";

import type { ServerDeps } from "./deps";

export function makeApp(deps: ServerDeps): Hono {
  const app = new Hono();

  app.get("/api/health", (c) => c.json({ ok: true, content: deps.contents.current.version, tick: currentTick(deps) }));

  return app;
}

/** R-CLOCK-001: the current tick from the server's clock alone. */
export function currentTick(deps: Pick<ServerDeps, "config" | "now">): number {
  const { epoch, worldTickMs } = deps.config.clock;
  return Math.max(0, Math.floor((deps.now() - epoch) / worldTickMs));
}
