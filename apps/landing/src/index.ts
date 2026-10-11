// The holding page's Worker. GET / serves the page. Before launch it says the game opens soon;
// on launch day LANDING_LIVE shows the play link (the decision P9). The waitlist is switched off:
// POST /join is not found unless LANDING_WAITLIST is on and its bindings exist.
// Nothing reads the list: the only way out of the table is the maintainer's export command.
// This module exports only the handler and its Env: the runtime refuses other exports here.
import { cleanEmail, INSERT } from "./join";
import { renderPage } from "./page";
import type { PageState, PageSettings } from "./page";

/**
 * The page's bindings: what `wrangler types` generates from wrangler.jsonc (worker-configuration.d.ts), with the
 * waitlist's two bindings, commented out there, merged in by src/env.d.ts.
 */
export type Env = Cloudflare.Env;

interface Waitlist {
  db: D1Database;
  limiter: RateLimit;
}

const HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "content-security-policy":
    "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; form-action 'self'; base-uri 'none'; script-src https://static.cloudflareinsights.com; connect-src https://cloudflareinsights.com",
};

const NOT_FOUND = { status: 404, headers: { "cache-control": "no-store" } };

/** The waitlist takes addresses only while it is switched on, the page is not live, and both bindings exist. */
function openWaitlist(env: Env): Waitlist | null {
  if (env.LANDING_WAITLIST !== "true" || env.LANDING_LIVE === "true") return null;
  if (env.DB === undefined || env.JOIN_LIMIT === undefined) return null;
  return { db: env.DB, limiter: env.JOIN_LIMIT };
}

function settingsOf(env: Env): PageSettings {
  return {
    siteUrl: env.SITE_URL,
    analyticsToken: env.ANALYTICS_TOKEN,
    live: env.LANDING_LIVE === "true",
    playUrl: env.LANDING_PLAY_URL,
    xHandle: env.LANDING_X_HANDLE,
    waitlist: openWaitlist(env) !== null,
  };
}

function page(state: PageState, env: Env, status = 200): Response {
  return new Response(renderPage(state, settingsOf(env)), { status, headers: HEADERS });
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/") return page("fresh", env);
    const waitlist = openWaitlist(env);
    if (request.method === "POST" && pathname === "/join" && waitlist !== null) return join(request, env, waitlist);
    return new Response("Not found", NOT_FOUND);
  },
} satisfies ExportedHandler<Env>;
