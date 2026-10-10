// The auth library's own routes, under /api/auth (R-ACCOUNT-001 to 006, 014).
// https://better-auth.com/docs/integrations/hono
import { Hono } from "hono";

import type { Accounts } from "../auth/auth";

export function authRoutes({ auth }: Accounts): Hono {
  const app = new Hono();
  // R-ACCOUNT-013, R-ACCOUNT-025: a guest starts only through `POST /api/guest`, with its bot check and limits.
  app.post("/api/auth/sign-in/anonymous", (c) => c.json({ ok: false, code: "unknown-id", detail: "Start a life through the guest start." }, 404));
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));
  return app;
}
