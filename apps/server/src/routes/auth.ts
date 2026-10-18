// The auth library's own routes, under /api/auth (account:sign-in-without-secret, account:email-code-is-short-lived, account:passkey-needs-signed-in-session, account:no-text-message-codes, account:stand-ins-test-sign-in, account:session-is-secure-cookie, account:sign-in-routes-rate-limited).
// https://better-auth.com/docs/integrations/hono
import { Hono } from "hono";

import type { Accounts } from "../auth/auth";
import { SIGN_IN_PATHS, dropDeadSession } from "../auth/stale";

export function authRoutes({ auth }: Accounts): Hono {
  const app = new Hono();
  // account:bot-check-on-guest-creation, account:guest-floods-are-capped: a guest starts only through `POST /api/guest`, with its bot check and limits.
  app.post("/api/auth/sign-in/anonymous", (c) => c.json({ ok: false, code: "unknown-id", detail: "Start a life through the guest start." }, 404));
  // account:guest-and-secured-states: a dead session cookie never stops a new sign-in.
  for (const path of SIGN_IN_PATHS) app.use(path, dropDeadSession(auth));
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));
  return app;
}
