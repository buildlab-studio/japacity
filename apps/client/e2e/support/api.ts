// The server a browser test fakes for the client built against one (playwright.config.ts starts it on the online
// port): every /api route answered in the page, in the shapes of @japacity/api, the place's nudge socket kept quiet,
// and Cloudflare's bot check stood in for.
import type { ReportLine } from "@japacity/sim";
import { time } from "@japacity/sim";
import type { Game } from "@japacity/sim/testing";
import type { Page, Request } from "@playwright/test";

/** The second dev server, built with VITE_SERVER_URL pointing at itself, so every /api request is same-origin and faked. */
export const ONLINE = `http://localhost:${process.env.E2E_ONLINE_PORT ?? "5180"}`;

/** One answer: its body as JSON, or as it is when it is a string of the `type` given. */
export type Answer = { status?: number; body: unknown; type?: string };
/** An answer worked out from the request's body when it comes. */
export type Answering = (body: unknown) => Answer;

/** The answer to a browser with no session. */
export const SIGNED_OUT: Answer = { status: 401, body: { ok: false, code: "signed-out", detail: "Sign in to play." } };
/** The body of a route the test does not fake. */
export const NOT_FAKED = { ok: false, code: "unknown-id", detail: "not faked" };
/** The body for an account with no character. */
export const NO_CHARACTER = { ok: false, code: "no-character", detail: "No character yet." };
/** `GET /api/moderation/standing` for an account nothing was ever done to. */
export const STANDING = { ok: true, standing: { actions: [], mutedUntil: null, suspendedUntil: null, banned: false, reports: [] } };
/** The token the bot check's stand-in passes with, as Cloudflare's always-pass test key gives it. */
export const CAPTCHA_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

/** A route's JSON answer, for `route.fulfill`. */
export function json(body: unknown, status = 200): { status: number; contentType: string; body: string } {
  return { status, contentType: "application/json", body: JSON.stringify(body) };
}

/** The server's clock as a view carries it: the world on `tick`, its next tick an hour away, no month due. */
export function clockAt(tick: number): { tick: number; nextTickAt: number; nextTurnAt: null } {
  return { tick, nextTickAt: Date.now() + time.HOUR_MS, nextTurnAt: null };
}

/** The view as the server answers it, with a month banked as its clock would have it, on the game's tick unless one is given. */
export function viewReply(game: Game, tick = game.tick): { ok: true; view: ReturnType<Game["view"]>; lines: ReportLine[]; clock: ReturnType<typeof clockAt> } {
  if (game.state.turn.banked === 0) game.grant(1);
  return { ok: true, view: game.view(), lines: [], clock: clockAt(tick) };
}

/** The place's nudge socket: it opens and stays quiet. */
export async function quietSocket(page: Page): Promise<void> {
  await page.routeWebSocket(/\/api\/place\/.+\/socket$/, () => undefined);
}

/** How the bot check's stand-in behaves: it passes `afterMs` after it is drawn; `drawn` shows its box even when asked to show only for a tap. */
export interface CheckStandIn {
  afterMs?: number;
  drawn?: boolean;
}

/**
 * Cloudflare's widget as its always-pass test key behaves: it passes with the dummy token, again after each reset, and with
 * `interaction-only` it draws nothing, as the real one does when no tap is needed (account:start-screen-over-live-city). Each
 * widget drawn has its own id, so a page with the guest start's and a code form's (account:bot-check-on-code-send) resets each alone.
 */
export async function fakeTurnstile(page: Page, { afterMs = 0, drawn = false }: CheckStandIn = {}): Promise<void> {
  const widget = `(() => {
  const passes = new Map();
  let count = 0;
  window.turnstile = {
    render(container, options) {
      const box = document.createElement("div");
      box.textContent = "Check passed";
      box.style.cssText = "border:1px solid #bbb;border-radius:6px;padding:10px 12px;font:14px system-ui;width:max-content";
      if (${String(drawn)} || options.appearance !== "interaction-only") container.append(box);
      count += 1;
      const id = "widget-" + String(count);
      const pass = () => setTimeout(() => options.callback("${CAPTCHA_TOKEN}"), ${String(afterMs)});
      passes.set(id, pass);
      pass();
      return id;
    },
    reset(id) {
      passes.get(id)?.();
    },
    remove(id) {
      passes.delete(id);
    },
  };
})();`;
  await page.route("https://challenges.cloudflare.com/**", (route) => route.fulfill({ contentType: "text/javascript", body: widget }));
}

/** What a faked server is told besides its answers: who hears each request first, and how its bot check behaves. */
export interface FakeOptions {
  heard?: (asked: string, request: Request) => void;
  check?: CheckStandIn;
}

/**
 * Every /api route answered from `answers` by method and path (`GET /api/view`), read at each request so a test can
 * change an answer as the server's state moves; a route with no answer is not found. The nudge socket stays quiet and
 * the bot check is the stand-in.
 */
export async function fakeServer(page: Page, answers: Record<string, Answer | Answering>, options: FakeOptions = {}): Promise<void> {
  await page.route(
    (url) => url.pathname.startsWith("/api/"),
    (route) => {
      const request = route.request();
      const asked = `${request.method()} ${new URL(request.url()).pathname}`;
      options.heard?.(asked, request);
      const found = answers[asked];
      const answer = typeof found === "function" ? found(request.postDataJSON()) : found;
      if (answer === undefined) return route.fulfill(json(NOT_FAKED, 404));
      return route.fulfill({ status: answer.status ?? 200, contentType: answer.type ?? "application/json", body: typeof answer.body === "string" ? answer.body : JSON.stringify(answer.body) });
    },
  );
  await quietSocket(page);
  await fakeTurnstile(page, options.check);
}
