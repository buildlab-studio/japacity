// The friends' gate (PENDING.md P18). A Worker on a route in front of the game's address:
// an invite link's code or the cookie it left lets a request through to the game untouched;
// anything else sees one screen. Nothing about a visitor is stored. This module exports only
// the handler and its Env: the runtime refuses other exports here.
import { admits, codeMatches, cookieFor } from "./gate";
import { renderScreen } from "./screen";

export interface Env {
  /** Also the code in the invite link. Set with `wrangler secret put GATE_SECRET`. */
  GATE_SECRET: string;
  GATE_X_HANDLE: string;
  SITE_URL: string;
}

const PRIVATE = { "cache-control": "no-store", "referrer-policy": "no-referrer", "x-robots-tag": "noindex" };

const SCREEN_HEADERS = {
  ...PRIVATE,
  "content-type": "text/html; charset=utf-8",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'",
};

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Sends the phone on to the same address without the code, so the code never stays in the address bar.
 * The location is relative: the browser keeps the host it asked for, whatever host the request reached.
 */
function toCleanAddress(url: URL, setCookie: string | null): Response {
  url.searchParams.delete("code");
  const headers = new Headers({ ...PRIVATE, location: `${url.pathname}${url.search}` });
  if (setCookie !== null) headers.set("set-cookie", setCookie);
  return new Response(null, { status: 303, headers });
}

/** The game's routes and anything but a page load get a bare refusal; a page load gets the screen. */
function refuse(request: Request, url: URL, env: Env): Response {
  const page = (request.method === "GET" || request.method === "HEAD") && !url.pathname.startsWith("/api/");
  if (!page) return new Response("Not open yet", { status: 403, headers: { ...PRIVATE, "content-type": "text/plain; charset=utf-8" } });
  return new Response(renderScreen(env.GATE_X_HANDLE, env.SITE_URL), { status: 200, headers: SCREEN_HEADERS });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const now = nowSeconds();
    const code = url.searchParams.get("code");
    const admitted = await admits(request.headers.get("cookie"), env.GATE_SECRET, now);
    if (code !== null) {
      if (await codeMatches(code, env.GATE_SECRET)) return toCleanAddress(url, await cookieFor(env.GATE_SECRET, now));
      if (admitted) return toCleanAddress(url, null);
      return refuse(request, url, env);
    }
    // The game's Worker sits on the address as its origin; fetch(request) streams both ways and carries socket upgrades.
    if (admitted) return fetch(request);
    return refuse(request, url, env);
  },
} satisfies ExportedHandler<Env>;
