// R-ACCOUNT-011, 012: `POST /api/age`, the age screen, and `GET /api/age`, its
// standing, before the username and the guest life, the same from every
// country. The date of birth is judged and dropped; a pass is a single-use
// row that the guest start consumes, where the bot check runs (R-ACCOUNT-013,
// routes/account.ts).
// https://hono.dev/docs/helpers/cookie
import type { AgeReply, AgeRequest, AgeStatus } from "@japacity/api";
import { time, toHex } from "@japacity/sim";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";

import { PASS_COOKIE, PASS_PREFIX, PASS_TTL_MS, REFUSED_COOKIE, ageOn, parseBirthDate, plausible, readCookie } from "../account/age";
import { rejection } from "./reply";
import type { Accounts } from "../auth/auth";
import type { ServerDeps } from "../deps";
import type { SessionEnv } from "../limits/limit";
import { limit } from "../limits/limit";

/** The guest start, the one route that reads the pass. */
export const PASS_PATH = "/api/guest";

export function ageRoutes(deps: ServerDeps, { auth }: Accounts): Hono<SessionEnv> {
  const app = new Hono<SessionEnv>();

  // R-ACCOUNT-011, R-ACCOUNT-012: the screen's standing read before it is shown; the switch gate answers it first while sign-ups are off (R-SERVER-031).
  app.get("/api/age", limit(deps, "reads"), (c) => {
    return c.json<AgeStatus>({ refused: readCookie(c.req.header("cookie"), REFUSED_COOKIE) !== null });
  });

  app.post("/api/age", limit(deps, "commands"), async (c) => {
    const request = c.req.raw;
    if (readCookie(request.headers.get("cookie"), REFUSED_COOKIE) !== null) {
      return c.json<AgeReply>(rejection("under-age", "This browser cannot sign up."), 403);
    }

    const now = deps.now();
    const body = (await c.req.json().catch(() => null)) as Partial<AgeRequest> | null;
    const birth = parseBirthDate(body?.dateOfBirth);
    if (birth === null || !plausible(birth, now)) return c.json<AgeReply>(rejection("bad-date", "That is not a date of birth."), 400);

    if (ageOn(birth, now) < deps.config.account.minAge) {
      deleteCookie(c, PASS_COOKIE, { path: PASS_PATH, secure: true });
      // Not HttpOnly: the screen reads it to refuse without asking again.
      setCookie(c, REFUSED_COOKIE, "1", { path: "/", secure: true, sameSite: "Lax", maxAge: deps.config.account.refusedCookieDays * time.DAY_S });
      return c.json<AgeReply>(rejection("under-age", "This browser cannot sign up."), 403);
    }

    const nonce = toHex(deps.randomBytes(16));
    const context = await auth.$context;
    await context.internalAdapter.createVerificationValue({ identifier: PASS_PREFIX + nonce, value: String(now), expiresAt: new Date(now + PASS_TTL_MS) });
    setCookie(c, PASS_COOKIE, nonce, { path: PASS_PATH, httpOnly: true, secure: true, sameSite: "Lax", maxAge: Math.floor(PASS_TTL_MS / 1000) });
    return c.json<AgeReply>({ ok: true });
  });

  return app;
}
