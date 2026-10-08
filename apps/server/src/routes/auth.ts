// The auth library's own routes, under /api/auth (R-ACCOUNT-001 to 006, 014).
// https://better-auth.com/docs/integrations/hono
import { Hono } from "hono";

import type { Accounts } from "../auth/auth";

export function authRoutes({ auth }: Accounts): Hono {
  const app = new Hono();
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));
  return app;
}
