// account:sign-up-open-everywhere, account:age-screen-refuses-minors: `POST /api/age`, the age screen, and `GET /api/age`, its
// standing, before the username and the guest life, the same from every
// country. The date of birth is judged and dropped; a pass is a single-use
// row that the guest start consumes, where the bot check runs (account:bot-check-on-guest-creation,
// routes/account.ts).
// https://hono.dev/docs/helpers/cookie
import type { AgeReply, AgeRequest, AgeStatus } from "@japacity/api";
import { time, toHex } from "@japacity/sim";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";

import { PASS_COOKIE, PASS_PREFIX, PASS_TTL_MS, REFUSED_COOKIE, ageOn, parseBirthDate, plausible, readCookie } from "../account/age";
import { dropProof, heldProof, NEW_LIFE_COOKIE, NEW_LIFE_COOKIE_PATH } from "../account/newlife";
import { rejection } from "./reply";
import type { Accounts } from "../auth/auth";
import type { ServerDeps } from "../dependencies";
import type { SessionEnv } from "../limits/limit";
import { limit } from "../limits/limit";

/**
 * The pass cookie's path: the guest start, which spends the pass, and the standing, which reports it held
 * (account:age-screen-refuses-minors); a browser sends the cookie to every path under it.
 */
export const PASS_PATH = "/api";

export function ageRoutes(deps: ServerDeps, { auth }: Accounts): Hono<SessionEnv> {
  const app = new Hono<SessionEnv>();

  // account:sign-up-open-everywhere, account:age-screen-refuses-minors: the screen's standing read before it is shown; the switch gate answers it first while sign-ups are off (server:four-off-switches).
  // A pass is reported while its row stands unspent and its hour is not up, so a reload or Back before Begin returns to the door's step.
  // account:sign-in-without-secret: a live proof's address is reported too, so the gate opens on the new life's step in this browser.
  app.get("/api/age", limit(deps, "reads"), async (c) => {
    const cookie = c.req.header("cookie");
    if (readCookie(cookie, REFUSED_COOKIE) !== null) return c.json<AgeStatus>({ refused: true, passed: false });
    const context = await auth.$context;
    const proved = await heldProof(context.internalAdapter, cookie, deps.now());
    const held = proved === null ? {} : { newLife: proved };
    const nonce = readCookie(cookie, PASS_COOKIE);
    if (nonce === null || nonce === "") return c.json<AgeStatus>({ refused: false, passed: false, ...held });
    const pass = await context.internalAdapter.findVerificationValue(PASS_PREFIX + nonce);
    return c.json<AgeStatus>({ refused: false, passed: pass !== null && new Date(pass.expiresAt).getTime() > deps.now(), ...held });
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
      // A minor's refusal makes nothing, a life that came by the code included: its proof goes with it.
      if (await dropProof((await auth.$context).internalAdapter, request.headers.get("cookie"))) deleteCookie(c, NEW_LIFE_COOKIE, { path: NEW_LIFE_COOKIE_PATH, secure: true });
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
