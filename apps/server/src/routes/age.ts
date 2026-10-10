// R-ACCOUNT-011 to 013: `POST /api/age`, the age screen, and `GET /api/age`, its standing, before any sign-in
// method. The region is judged first and nothing is kept from a closed one;
// the date of birth is judged and dropped; a pass is a single-use row that
// the account's creation consumes.
// https://hono.dev/docs/helpers/cookie
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";

import { PASS_COOKIE, PASS_PREFIX, PASS_TTL_MS, REFUSED_COOKIE, ageOn, parseBirthDate, plausible, readCookie } from "../account/age";
import { regionOf } from "../account/region";
import { rejection } from "../account/reply";
import { checkTurnstile } from "../account/turnstile";
import type { Accounts } from "../auth/auth";
import type { ServerDeps } from "../deps";
import type { SessionEnv } from "../limits/limit";
import { limit } from "../limits/limit";

/** The body of `POST /api/age`; the Turnstile token goes in the `x-captcha-response` header. */
export interface AgeRequest {
  dateOfBirth: string;
}

export type AgeReply = { ok: true } | ReturnType<typeof rejection>;

/** `GET /api/age`: whether this browser was refused at the age screen and must not be asked again (R-ACCOUNT-012). */
export interface AgeStatus {
  refused: boolean;
}

const PASS_PATH = "/api/auth";
const DAY_S = 86_400;

function hex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function ageRoutes(deps: ServerDeps, { auth, keys }: Accounts): Hono<SessionEnv> {
  const app = new Hono<SessionEnv>();

  // R-ACCOUNT-011, R-ACCOUNT-012: the screen's standing read before it is shown; the switch gate answers it first while sign-ups are off (R-SERVER-031).
  app.get("/api/age", limit(deps, "reads"), (c) => {
    if (!regionOf(deps.config.regions, c.req.raw).policy.open) return c.json<AgeReply>(rejection("region-closed", "Sign-up is not open in this region."), 403);
    return c.json<AgeStatus>({ refused: readCookie(c.req.header("cookie"), REFUSED_COOKIE) !== null });
  });

  app.post("/api/age", limit(deps, "commands"), async (c) => {
    const request = c.req.raw;
    if (!regionOf(deps.config.regions, request).policy.open) {
      return c.json<AgeReply>(rejection("region-closed", "Sign-up is not open in this region."), 403);
    }
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
      setCookie(c, REFUSED_COOKIE, "1", { path: "/", secure: true, sameSite: "Lax", maxAge: deps.config.account.refusedCookieDays * DAY_S });
      return c.json<AgeReply>(rejection("under-age", "This browser cannot sign up."), 403);
    }

    // the bot check runs here, the one step every new account takes, and not on the library's sign-in routes, which also serve returning players (R-ACCOUNT-013).
    const check = await checkTurnstile(keys.turnstile, request.headers.get("x-captcha-response"), request.headers.get("cf-connecting-ip"), new URL(keys.siteUrl).hostname);
    if (!check.ok) return c.json<AgeReply>(rejection("bot-check", check.reason), 403);

    const nonce = hex(deps.randomBytes(16));
    const context = await auth.$context;
    await context.internalAdapter.createVerificationValue({ identifier: PASS_PREFIX + nonce, value: String(now), expiresAt: new Date(now + PASS_TTL_MS) });
    setCookie(c, PASS_COOKIE, nonce, { path: PASS_PATH, httpOnly: true, secure: true, sameSite: "Lax", maxAge: Math.floor(PASS_TTL_MS / 1000) });
    return c.json<AgeReply>({ ok: true });
  });

  return app;
}
