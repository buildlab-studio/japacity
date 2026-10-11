// Where the real browser tests and the play driver point (server.md R-SERVER-038): the local stack, or
// staging behind Cloudflare Access. Staging is reached with the maintainer's Access service token, whose two
// values are read only from the environment (CF_ACCESS_CLIENT_ID, CF_ACCESS_CLIENT_SECRET), set from a
// keychain or secret store for one command. They are never read from a file, printed or written here.

/** Staging's address (R-SERVER-038). */
export const STAGING_URL = "https://staging.japacity.app";

const LOCAL_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** True for an address on this machine. */
export function isLocalUrl(url: string): boolean {
  return URL.canParse(url) && LOCAL_HOSTS.has(new URL(url).hostname);
}

/**
 * The Access service token's two headers, for an https address that is not on this machine, when both
 * variables are set; none otherwise, so the local stack never sees them.
 */
export function accessHeaders(env: Readonly<Record<string, string | undefined>>, url: string): Record<string, string> {
  const id = env["CF_ACCESS_CLIENT_ID"] ?? "";
  const secret = env["CF_ACCESS_CLIENT_SECRET"] ?? "";
  if (id === "" || secret === "" || !URL.canParse(url) || new URL(url).protocol !== "https:" || isLocalUrl(url)) return {};
  return { "CF-Access-Client-Id": id, "CF-Access-Client-Secret": secret };
}

/** The requests that carry the token: the target's origin alone, so a beacon or any other origin never sees it. */
export function accessRoutePattern(url: string): string {
  return `${new URL(url).origin}/**`;
}

/** The part of a Playwright context the token is put on. */
export interface Routable {
  route(pattern: string, handler: (route: { request(): { headers(): Record<string, string> }; continue(options: { headers: Record<string, string> }): Promise<void> }) => Promise<void>): Promise<unknown>;
}

/**
 * Puts the Access headers on every request the context makes to the target's origin, and on no other: a context-wide
 * header would travel to the analytics beacon's origin too, where its preflight refuses it. Nothing is installed
 * without both variables.
 */
export async function withAccess(context: Routable, env: Readonly<Record<string, string | undefined>>, url: string): Promise<void> {
  const headers = accessHeaders(env, url);
  if (Object.keys(headers).length === 0) return;
  await context.route(accessRoutePattern(url), (route) => route.continue({ headers: { ...route.request().headers(), ...headers } }));
}

export interface RealTarget {
  /** The address the tests open. */
  baseUrl: string;
  /** False on staging: no Mailpit, no local database, no local explorer for the cron. */
  local: boolean;
  headers: Record<string, string>;
}

/** The tests' target: REAL_BASE_URL when it is set, else the local stack's SITE_URL. */
export function realTarget(env: Readonly<Record<string, string | undefined>>, siteUrl: string): RealTarget {
  const given = env["REAL_BASE_URL"] ?? "";
  const baseUrl = given === "" ? siteUrl : new URL(given).origin;
  return { baseUrl, local: isLocalUrl(baseUrl), headers: accessHeaders(env, baseUrl) };
}

/** `pnpm test:browser:real [--staging] [playwright's own arguments]`: the environment the run gets, and what goes on to Playwright. */
export function realRun(argv: readonly string[], env: Readonly<Record<string, string | undefined>>): { env: Record<string, string | undefined>; args: string[] } {
  const staging = argv.includes("--staging");
  const args = argv.filter((arg) => arg !== "--staging" && arg !== "--");
  return { env: staging ? { ...env, REAL_BASE_URL: STAGING_URL } : { ...env }, args };
}
