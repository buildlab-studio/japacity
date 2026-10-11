// The one way the client talks HTTP to the server: JSON in, JSON out, the
// session cookie sent along, a clock on every request and every answer sorted
// into its class (R-ENGINE-015). `fetch` is passed in so tests answer for the server.
import type { ServerRejection } from "./contract";
import { heardBody } from "./guest";
import { pageWall, type WallGuard } from "./wall";

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface Api {
  get<T>(path: string): Promise<T>;
  /** `headers`: any beyond the JSON pair, such as the bot check's token (R-ACCOUNT-013). */
  post<T>(path: string, body: unknown, headers?: Record<string, string>): Promise<T>;
  put<T>(path: string, body: unknown): Promise<T>;
  delete<T>(path: string, body: unknown): Promise<T>;
  /** The `ws:` or `wss:` address of a path on the same server. */
  socketUrl(path: string): string;
}

export interface ApiOptions {
  baseUrl: string;
  fetch?: Fetch;
  /** What a login wall sets off: the page's own guard (one reload), or a test's. */
  wall?: WallGuard;
}

const SECOND_MS = 1000;

/** R-ENGINE-015: how long a read waits for the server before it counts as no answer. */
export const READ_TIMEOUT_MS = 8_000;
/** R-ENGINE-015: how long a command (a write) waits; longer, as the server plays it through before it answers. */
export const COMMAND_TIMEOUT_MS = 15_000;

/**
 * R-ENGINE-015: what went wrong with a request that brought no answer the game can read. `network`: the fetch threw or
 * timed out. `wall`: something stands between the page and the game (a login wall, an expired session): a redirect, a
 * 401 or 403 without the game's own refusal, or a page where JSON was expected. `server`: a 5xx, the server's own `unavailable`, or a body nobody can read.
 */
export type FailureKind = "network" | "wall" | "server";

/** What a request came back as: the game's own answer (`ok`, or `rejected` with its code), or a failure of a kind. */
export type Outcome<T> = { kind: "ok"; body: T } | { kind: "rejected"; body: T } | { kind: FailureKind; detail: string };

/**
 * An error carrying its failure's kind, thrown by the request function, so no caller ever shows a browser's own words.
 * `reloading`: a wall for which the page is already reloading, so nothing on screen needs to say it.
 */
export type RequestFailure = Error & { failure: FailureKind; reloading?: boolean };

export function requestFailure(kind: FailureKind, detail: string, reloading = false): RequestFailure {
  return Object.assign(new Error(`${kind}: ${detail}`), { failure: kind, ...(reloading ? { reloading } : {}) });
}

/** True for a wall the page is reloading for: the page is going, and the card would only flash. */
export function isReloading(error: unknown): boolean {
  return failureOf(error) === "wall" && (error as RequestFailure).reloading === true;
}

/** The host of a redirect's Location is Cloudflare Access's login (`<team>.cloudflareaccess.com`). */
function toAccess(location: string | null): boolean {
  if (location === null) return false;
  try {
    const host = new URL(location).hostname;
    return host === "cloudflareaccess.com" || host.endsWith(".cloudflareaccess.com");
  } catch {
    return false;
  }
}

/** The failure's kind, or null for an error that is not a request's. */
export function failureOf(error: unknown): FailureKind | null {
  if (!(error instanceof Error) || !("failure" in error)) return null;
  const kind = (error as RequestFailure).failure;
  return kind === "network" || kind === "wall" || kind === "server" ? kind : null;
}

/** A refusal the server sent without a JSON body of its own, made into one so callers see a single shape. */
function bareRefusal(response: Pick<Response, "status" | "headers">): ServerRejection | null {
  if (response.status === 429) {
    const header = Number(response.headers.get("Retry-After") ?? "");
    return { ok: false, code: "rate-limited", detail: "Too many requests.", retryAfter: Number.isFinite(header) && header > 0 ? header : 1 };
  }
  return null;
}

/** The game's own refusal: `{ ok: false, code, detail }` as the server sends it with any status. */
function isRefusal(body: unknown): body is ServerRejection {
  return typeof body === "object" && body !== null && (body as Partial<ServerRejection>).ok === false && typeof (body as Partial<ServerRejection>).code === "string";
}

/** R-SERVER-043: the server's own failure, `{ ok: false, code: "unavailable" }` with a 503 or a 500: no refusal of the game's. */
function isServerFailure(body: object): boolean {
  return (body as { ok?: unknown }).ok === false && (body as { code?: unknown }).code === "unavailable";
}

function parsed(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * R-ENGINE-015, R-ACCOUNT-006: sorts a response into its class. Only the game's Worker answers in JSON; a login wall
 * answers with a redirect or a page, and the platform with a bare 5xx. So a 4xx with a JSON body is the server's own
 * answer (the game's `signed-out`, the auth library's refusals), and a 401 or 403 without one is a wall.
 */
export function classify<T>(response: Pick<Response, "status" | "type" | "redirected" | "headers">, text: string): Outcome<T> {
  const status = response.status;
  // A redirect not followed comes back opaque (status 0); one seen whole names the login it goes to.
  if (response.type === "opaqueredirect" || status === 0) return { kind: "wall", detail: "an opaque redirect" };
  if (toAccess(response.headers.get("location"))) return { kind: "wall", detail: `redirected to the Access login (${String(status)})` };
  if (response.redirected || (status >= 300 && status < 400)) return { kind: "wall", detail: `redirected (${String(status)})` };
  const type = response.headers.get("content-type") ?? "";
  const page = type.includes("text/html") || /^\s*</.test(text);
  const body = page ? undefined : parsed(text);
  if (typeof body === "object" && body !== null) {
    if (status >= 200 && status < 300) return { kind: "ok", body: body as T };
    // R-SERVER-043: the server's own failure (`unavailable`) is no refusal the game can act on: the trouble card shows.
    if (status >= 500 && isServerFailure(body)) return { kind: "server", detail: `${String(status)} unavailable` };
    if (isRefusal(body)) return { kind: "rejected", body: body as T };
    if (status >= 500) return { kind: "server", detail: `${String(status)}` };
    return { kind: "rejected", body: body as T };
  }
  if (status === 401 || status === 403 || (page && status < 500)) return { kind: "wall", detail: `${String(status)} with ${page ? "a page" : "no body"}` };
  const bare = bareRefusal(response);
  if (bare !== null) return { kind: "rejected", body: bare as T };
  return { kind: "server", detail: `${String(status)} with nothing the game can read` };
}

/** The timeout for a request by its method: a read's, or a write's. */
function timeoutOf(init: RequestInit | undefined): number {
  const method = (init?.method ?? "GET").toUpperCase();
  return method === "GET" || method === "HEAD" ? READ_TIMEOUT_MS : COMMAND_TIMEOUT_MS;
}

/**
 * One request to the server, sorted into its class, or a thrown failure of its kind. Body reading counts against the
 * same clock as the answer, so a reply that stalls halfway is no answer too.
 */
async function exchange(fetch: Fetch, wall: WallGuard, url: string, init: RequestInit, timeoutMs: number): Promise<{ response: Response; text: string; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  let text: string;
  try {
    // Same origin only: the page and the API are one Worker (wrangler.jsonc). A redirect is never followed, so a login
    // wall's redirect to another origin is seen as one, not as a browser's "Load failed".
    response = await fetch(url, { ...init, credentials: "same-origin", redirect: "manual", signal: controller.signal });
    text = await response.text();
  } catch (error) {
    const detail = controller.signal.aborted ? `no answer in ${String(timeoutMs)} ms` : error instanceof Error ? error.name : "thrown";
    throw requestFailure("network", detail);
  } finally {
    clearTimeout(timer);
  }
  const outcome = classify(response, text);
  // R-ACCOUNT-006: a wall reloads the page once so the login shows; a second within a minute is left to the card.
  if (outcome.kind === "wall") throw requestFailure("wall", outcome.detail, wall.met());
  if (outcome.kind !== "ok" && outcome.kind !== "rejected") throw requestFailure(outcome.kind, outcome.detail);
  wall.passed();
  heardBody(outcome.body);
  return { response, text, body: outcome.body };
}

async function request<T>(fetch: Fetch, wall: WallGuard, url: string, init: RequestInit, timeoutMs: number): Promise<T> {
  return (await exchange(fetch, wall, url, init, timeoutMs)).body as T;
}

/**
 * The same request as a `fetch` for a library that wants one (the auth library's client): the clock, same origin, no
 * redirect followed, a wall or no answer thrown as a failure of its kind; the server's answer handed back whole.
 */
export function requestFetch(fetch: Fetch = (input, init) => globalThis.fetch(input, init), wall: WallGuard = pageWall): Fetch {
  return async (input, init) => {
    const { response, text } = await exchange(fetch, wall, input, init ?? {}, timeoutOf(init));
    return new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers });
  };
}

export function api({ baseUrl, fetch = (input, init) => globalThis.fetch(input, init), wall = pageWall }: ApiOptions): Api {
  const base = baseUrl.replace(/\/+$/, "");
  const write = (method: string, body: unknown): RequestInit => ({ method, headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify(body) });
  return {
    get: (path) => request(fetch, wall, `${base}${path}`, { method: "GET", headers: { accept: "application/json" } }, READ_TIMEOUT_MS),
    post: (path, body, headers = {}) => {
      const init = write("POST", body);
      return request(fetch, wall, `${base}${path}`, { ...init, headers: { ...(init.headers as Record<string, string>), ...headers } }, COMMAND_TIMEOUT_MS);
    },
    put: (path, body) => request(fetch, wall, `${base}${path}`, write("PUT", body), COMMAND_TIMEOUT_MS),
    delete: (path, body) => request(fetch, wall, `${base}${path}`, write("DELETE", body), COMMAND_TIMEOUT_MS),
    socketUrl(path) {
      const url = new URL(`${base}${path}`, globalThis.location?.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      return url.toString();
    },
  };
}

/** Milliseconds for a `retryAfter` in seconds. */
export function retryAfterMs(rejection: ServerRejection): number {
  return (rejection.retryAfter ?? 1) * SECOND_MS;
}

/** An error the authority has already told the store about through its events, so the store shows no failure for it. */
export function reportedError(rejection: ServerRejection): Error {
  return Object.assign(new Error(rejection.detail), { reported: rejection.code });
}

export function isReported(error: unknown): boolean {
  return error instanceof Error && "reported" in error;
}
