// The gate (PENDING.md P18): a Worker on the route japacity.app/* that owns the game's root
// before launch. `/invite/<the code>` sets the cookie and sends the phone to `/`; a request with
// that cookie passes to the game untouched; anyone else sees the waitlist page, and may join it.
// At launch the maintainer deletes the route and the game's Worker is the root. Nothing about a
// visitor is stored but an address they give the waitlist. This module exports only the handler
// and its Env: the runtime refuses other exports here.
import { admits, codeMatches, cookieFor } from "./gate";
import { cleanEmail, INSERT } from "./join";
import { renderPage } from "./page";
import type { PageState } from "./page";

export interface Env {
  /** Also the code in the invite link. Set with `wrangler secret put GATE_SECRET`. */
  GATE_SECRET: string;
  /** The game's X handle without the @. Empty: no X link. */
  GATE_X_HANDLE: string;
  /** The game's address, where the page's card picture is. */
  SITE_URL: string;
  /** The Web Analytics site token. Empty: no analytics script is sent. */
  ANALYTICS_TOKEN: string;
  /** The gate's own files: only the card picture. */
  ASSETS: Fetcher;
  /** The waitlist's table and its limit. While either is missing the page carries no form. */
  DB?: D1Database | undefined;
  JOIN_LIMIT?: RateLimit | undefined;
}

interface Waitlist {
  db: D1Database;
  limiter: RateLimit;
}

const PRIVATE = { "cache-control": "no-store", "referrer-policy": "no-referrer" };

const PAGE_HEADERS = {
  ...PRIVATE,
  "content-type": "text/html; charset=utf-8",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "content-security-policy":
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; script-src https://static.cloudflareinsights.com; connect-src https://cloudflareinsights.com",
};

/** The page's link preview picture, the gate's one file. */
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

function openWaitlist(env: Env): Waitlist | null {
  if (env.DB === undefined || env.JOIN_LIMIT === undefined) return null;
  return { db: env.DB, limiter: env.JOIN_LIMIT };
}

function page(state: PageState, env: Env, status = 200): Response {
  const settings = { siteUrl: env.SITE_URL, analyticsToken: env.ANALYTICS_TOKEN, xHandle: env.GATE_X_HANDLE, waitlist: openWaitlist(env) !== null };
  return new Response(renderPage(state, settings), { status, headers: PAGE_HEADERS });
}

/** Sends the admitted phone to the game's front page, so the code never stays in the address bar. */
function admit(setCookie: string): Response {
  return new Response(null, { status: 303, headers: { ...PRIVATE, location: "/", "set-cookie": setCookie } });
}

async function join(request: Request, env: Env, waitlist: Waitlist): Promise<Response> {
  const form = await request.formData();
  // The honeypot: a field no person sees. A filled one is a bot, told "thanks" and given nothing.
  const trap = form.get("website");
  if (typeof trap === "string" && trap !== "") return page("joined", env);
  const email = cleanEmail(form.get("email"));
  if (email === null) return page("invalid", env, 400);
  const key = request.headers.get("cf-connecting-ip") ?? "unknown";
  const { success } = await waitlist.limiter.limit({ key });
  if (!success) return page("slow", env, 429);
  await waitlist.db.prepare(INSERT).bind(email, new Date().toISOString()).run();
  return page("joined", env);
}

/** A page load gets the waitlist page; the game's routes and anything else get a bare refusal. */
function refuse(request: Request, url: URL, env: Env): Response {
  const load = (request.method === "GET" || request.method === "HEAD") && !url.pathname.startsWith("/api/");
  if (load) return page("fresh", env);
  return new Response("Not open yet", { status: 403, headers: { ...PRIVATE, "content-type": "text/plain; charset=utf-8" } });
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
    const waitlist = openWaitlist(env);
    if (request.method === "POST" && url.pathname === "/join" && waitlist !== null) return join(request, env, waitlist);
    return refuse(request, url, env);
  },
} satisfies ExportedHandler<Env>;
