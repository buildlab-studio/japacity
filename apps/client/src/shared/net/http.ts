// The one way the client talks HTTP to the server: JSON in, JSON out, the
// session cookie sent along, a clock on every request and every answer sorted
// into its class (R-ENGINE-015). `fetch` is passed in so tests answer for the server.
import type { ServerRejection } from "./contract";
import { heardBody } from "./guest";
import { pageWall, type WallGuard } from "./wall";

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface Api {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
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
 * 401 or 403 without the game's own refusal, or a page where JSON was expected. `server`: a 5xx, or a body nobody can read.
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

function parsed(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * R-ENGINE-015, R-ACCOUNT-006: sorts a response into its class. Only the game answers in JSON; a login wall answers
 * with a redirect or a page, and the platform with a bare 5xx. The game's own 401 (`signed-out`) is the game's, and
 * stays a refusal; a 401 or 403 that is not the game's is a wall.
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
    if (isRefusal(body)) return { kind: "rejected", body: body as T };
    if (status === 401 || status === 403) return { kind: "wall", detail: `${String(status)} without the game's refusal` };
    if (status >= 500) return { kind: "server", detail: `${String(status)}` };
    return { kind: "rejected", body: body as T };
  }
  if (status === 401 || status === 403 || (page && status < 500)) return { kind: "wall", detail: `${String(status)} with ${page ? "a page" : "no body"}` };
  const bare = bareRefusal(response);
  if (bare !== null) return { kind: "rejected", body: bare as T };
  return { kind: "server", detail: `${String(status)} with nothing the game can read` };
}

/** Body reading counts against the same clock as the answer, so a reply that stalls halfway is no answer too. */
async function request<T>(fetch: Fetch, wall: WallGuard, url: string, init: RequestInit, timeoutMs: number): Promise<T> {
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
    const detail = controller.signal.aborted ? `no answer in ${String(timeoutMs)} ms` : error instanceof Error ? error.message : String(error);
    throw requestFailure("network", detail);
  } finally {
    clearTimeout(timer);
  }
  const outcome = classify<T>(response, text);
  // R-ACCOUNT-006: a wall reloads the page once so the login shows; a second within a minute is left to the card.
  if (outcome.kind === "wall") throw requestFailure("wall", outcome.detail, wall.met());
  if (outcome.kind !== "ok" && outcome.kind !== "rejected") throw requestFailure(outcome.kind, outcome.detail);
  wall.passed();
  heardBody(outcome.body);
  return outcome.body;
}

export function api({ baseUrl, fetch = (input, init) => globalThis.fetch(input, init), wall = pageWall }: ApiOptions): Api {
  const base = baseUrl.replace(/\/+$/, "");
  const write = (method: string, body: unknown): RequestInit => ({ method, headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify(body) });
  return {
    get: (path) => request(fetch, wall, `${base}${path}`, { method: "GET", headers: { accept: "application/json" } }, READ_TIMEOUT_MS),
    post: (path, body) => request(fetch, wall, `${base}${path}`, write("POST", body), COMMAND_TIMEOUT_MS),
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
