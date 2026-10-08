// The one way the client talks HTTP to the server: JSON in, JSON out, the
// session cookie sent along. `fetch` is passed in so tests answer for the server.
import type { ServerRejection } from "./contract";

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface Api {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  put<T>(path: string, body: unknown): Promise<T>;
  /** The `ws:` or `wss:` address of a path on the same server. */
  socketUrl(path: string): string;
}

export interface ApiOptions {
  baseUrl: string;
  fetch?: Fetch;
}

const SECOND_MS = 1000;

/** A refusal the server sent without a JSON body of its own, made into one so callers see a single shape. */
function bareRefusal(response: Response): ServerRejection | null {
  if (response.status === 401) return { ok: false, code: "signed-out", detail: "Not signed in." };
  if (response.status === 429) {
    const header = Number(response.headers.get("Retry-After") ?? "");
    return { ok: false, code: "rate-limited", detail: "Too many requests.", retryAfter: Number.isFinite(header) && header > 0 ? header : 1 };
  }
  return null;
}

async function readJson<T>(response: Response): Promise<T> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  if (typeof body === "object" && body !== null) return body as T;
  const refusal = bareRefusal(response);
  if (refusal !== null) return refusal as T;
  throw new Error(`The server answered ${String(response.status)} with nothing the game can read.`);
}

export function api({ baseUrl, fetch = (input, init) => globalThis.fetch(input, init) }: ApiOptions): Api {
  const base = baseUrl.replace(/\/+$/, "");
  const call = async <T>(path: string, init: RequestInit): Promise<T> => {
    const response = await fetch(`${base}${path}`, { credentials: "include", ...init });
    return readJson<T>(response);
  };
  return {
    get: (path) => call(path, { method: "GET", headers: { accept: "application/json" } }),
    post: (path, body) => call(path, { method: "POST", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify(body) }),
    put: (path, body) => call(path, { method: "PUT", headers: { accept: "application/json", "content-type": "application/json" }, body: JSON.stringify(body) }),
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
