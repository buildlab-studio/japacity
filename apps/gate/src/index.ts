// The gate: a Worker on the route japacity.app/* that owns the game's root
// before launch. `/invite/<the code>` sets the cookie and sends the phone to `/`; a request with
// that cookie passes to the game untouched; anyone else sees one screen. At launch the maintainer
// deletes the route and the game's Worker is the root. Nothing about a visitor is stored. This
// module exports only the handler and its Env: the runtime refuses other exports here.
import { admits, codeMatches, cookieFor } from "./gate";
import { BEACON_REPORTS, BEACON_SCRIPT, beaconOn, renderScreen } from "./screen";

export interface Env {
  /** Also the code in the invite link. Set with `wrangler secret put GATE_SECRET`. */
  GATE_SECRET: string;
  /** The game's X handle without the @. Empty: no X link. */
  GATE_X_HANDLE: string;
  /** The game's address, where the screen's card picture is. */
  SITE_URL: string;
  /** The Cloudflare Web Analytics site token. Empty: the screen carries no script. */
  ANALYTICS_TOKEN?: string | undefined;
  /** The gate's own files: only the card picture. */
  ASSETS: Fetcher;
}

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
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === CARD && (request.method === "GET" || request.method === "HEAD")) return env.ASSETS.fetch(request);
    const now = nowSeconds();
    const code = inviteCode(url.pathname);
    if (code !== null && (await codeMatches(code, env.GATE_SECRET))) return admit(await cookieFor(env.GATE_SECRET, now));
    // The game's Worker is the host's Custom Domain, so it is the origin: fetch(request) streams both ways and carries socket upgrades.
    if (await admits(request.headers.get("cookie"), env.GATE_SECRET, now)) return fetch(request);
    return refuse(request, url, env);
  },
} satisfies ExportedHandler<Env>;
