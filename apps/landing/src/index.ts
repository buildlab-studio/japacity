// The holding page's Worker. GET / serves the page; POST /join inserts one row.
// Nothing reads the list: the only way out of the table is the maintainer's export command.
// This module exports only the handler and its Env: the runtime refuses other exports here.
import { cleanEmail, INSERT } from "./join";
import { renderPage } from "./page";
import type { PageState } from "./page";

export interface Env {
  DB: D1Database;
  JOIN_LIMIT: RateLimit;
  ANALYTICS_TOKEN: string;
  SITE_URL: string;
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

function page(state: PageState, env: Env, status = 200): Response {
  return new Response(renderPage(state, env.SITE_URL, env.ANALYTICS_TOKEN), { status, headers: HEADERS });
}

async function join(request: Request, env: Env): Promise<Response> {
  const form = await request.formData();
  // The honeypot: a field no person sees. A filled one is a bot, told "thanks" and given nothing.
  const trap = form.get("website");
  if (typeof trap === "string" && trap !== "") return page("joined", env);
  const email = cleanEmail(form.get("email"));
  if (email === null) return page("invalid", env, 400);
  const key = request.headers.get("cf-connecting-ip") ?? "unknown";
  const { success } = await env.JOIN_LIMIT.limit({ key });
  if (!success) return page("slow", env, 429);
  await env.DB.prepare(INSERT).bind(email, new Date().toISOString()).run();
  return page("joined", env);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (request.method === "GET" && pathname === "/") return page("fresh", env);
    if (request.method === "POST" && pathname === "/join") return join(request, env);
    return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });
  },
} satisfies ExportedHandler<Env>;
