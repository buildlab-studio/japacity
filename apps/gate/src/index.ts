// The gate: a Worker on the route japacity.app/* that owns the game's root
// before launch. `/invite/<the code>` sets the cookie and sends the phone to `/`; a request with
// that cookie passes to the game untouched, and so does anyone's request for the public pages
//; anyone else sees one screen. At launch the maintainer
// deletes the route and the game's Worker is the root. Nothing about a visitor is stored. This
// module exports only the handler and its Env: the runtime refuses other exports here. The gate
// counts the holding screen, the invite link and a card's arrival for the game (counts.ts).
import { countryOf, countsFor, gameOf, report } from "./counts";
import type { Seen } from "./counts";
import { admits, codeMatches, cookieFor } from "./gate";
import { BEACON_REPORTS, BEACON_SCRIPT, beaconOn, renderScreen } from "./screen";

/**
 * The gate's bindings: what `wrangler types` generates from wrangler.jsonc (worker-configuration.d.ts), with the
 * secret merged in by src/env.d.ts. `GAME`, the game's Worker, is read through `gameOf` (counts.ts).
 */
export type Env = Cloudflare.Env;

const PRIVATE = { "cache-control": "no-store", "referrer-policy": "no-referrer", "x-robots-tag": "noindex" };

const SCREEN_POLICY = "default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'";

/** The screen's headers. With the analytics token set, the policy lets in the beacon and its reports, and nothing else. */
function screenHeaders(analyticsToken: string): Record<string, string> {
  const policy = beaconOn(analyticsToken) ? `${SCREEN_POLICY}; script-src ${BEACON_SCRIPT}; connect-src ${BEACON_REPORTS}` : SCREEN_POLICY;
  return { ...PRIVATE, "content-type": "text/html; charset=utf-8", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "content-security-policy": policy };
}

/** The screen's link preview picture, the gate's one file. */
const CARD = "/card.png";

/** The invite link's path. The game's own pair invites share it, so only the gate's code is taken here. */
const INVITE = /^\/invite\/([^/]+)\/?$/;

/**
 * The pages anyone may read before launch: the terms, the privacy notice
 * (and their .html forms, which the game sends on to the clean path) and the official accounts.
 * Each is a plain page; the game's code and routes stay shut. The credits are a screen inside the
 * game, not a page, and the terms name the repository for the full list of licences.
 */
const PUBLIC = new Set(["/terms", "/terms.html", "/privacy", "/privacy.html", "/official"]);

function isPublic(request: Request, url: URL): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return false;
  return PUBLIC.has(url.pathname) || url.pathname.startsWith("/official/");
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function inviteCode(pathname: string): string | null {
  const raw = INVITE.exec(pathname)?.[1];
  if (raw === undefined) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Sends the admitted phone to the game's front page, so the code never stays in the address bar. */
function admit(setCookie: string): Response {
  return new Response(null, { status: 303, headers: { ...PRIVATE, location: "/", "set-cookie": setCookie } });
}

/** A page load gets the screen; the game's routes and anything else get a bare refusal. */
function refuse(request: Request, url: URL, env: Env): Response {
  const page = (request.method === "GET" || request.method === "HEAD") && !url.pathname.startsWith("/api/");
  if (!page) return new Response("Not open yet", { status: 403, headers: { ...PRIVATE, "content-type": "text/plain; charset=utf-8" } });
  const token = env.ANALYTICS_TOKEN ?? "";
  return new Response(renderScreen(env.GATE_X_HANDLE, env.SITE_URL, token), { status: 200, headers: screenHeaders(token) });
}

export default {
  // `ctx` is the runtime's; a test that calls the handler with none still gets its reply.
  async fetch(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === CARD && (request.method === "GET" || request.method === "HEAD")) return env.ASSETS.fetch(request);
    const later = (promise: Promise<unknown>) => (ctx === undefined ? void promise : ctx.waitUntil(promise));
    const counted = (seen: Seen) => report(gameOf(env.GAME), countsFor(request, url, seen), countryOf(request), later);
    const now = nowSeconds();
    const code = inviteCode(url.pathname);
    if (code !== null && (await codeMatches(code, env.GATE_SECRET))) {
      counted("invited");
      return admit(await cookieFor(env.GATE_SECRET, now));
    }
    // The game's Worker is the host's Custom Domain, so it is the origin: fetch(request) streams both ways and carries socket upgrades.
    if (isPublic(request, url) || (await admits(request.headers.get("cookie"), env.GATE_SECRET, now))) {
      counted("passed");
      return fetch(request);
    }
    const refused = refuse(request, url, env);
    // Only the holding screen is a step of the funnel; a bare refusal is not.
    if (refused.status === 200) counted("holding");
    return refused;
  },
} satisfies ExportedHandler<Env>;
