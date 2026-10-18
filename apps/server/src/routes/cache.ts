// The server's cache (server:public-replies-cached, clock:world-fetch-is-jittered).
// Despite the file's name this is no cache in front of the Worker: a Worker's
// own reply is not cached by Cloudflare, and its `public, max-age` reaches the
// browser only. The world, the draw and the advert replies are put by hand in
// the Cache API (`caches.default`), which lives beside the Worker in the data
// centre it runs in (London with placement, server:worker-placed-near-database), keyed by what makes
// each the same for everyone, and read before the database. A hit saves the
// database query, not the player's trip to the server. Nothing about the
// player enters a key. Behind Cloudflare Access there is no such cache.
import { int, time } from "@japacity/sim";
import type { Context, Env } from "hono";

/** The part of Cloudflare's Cache API these replies use; `caches.default` is one, and a test hands in its own. */
export interface EdgeCache {
  match: (key: string) => Promise<Response | undefined>;
  put: (key: string, response: Response) => Promise<void>;
  /** Lets a kept reply go before its time (the dedication's lights once one is lit, server:dedication-routes). */
  delete?: (key: string) => Promise<boolean>;
}

/** A reply the database made, with the moment it stops being the same for everyone. */
export interface Made {
  body: string | ArrayBuffer;
  type: string;
  /** Milliseconds since 1970: how long a browser may keep it. */
  freshUntil: number;
  /** When the server's cache must let it go, if sooner than `freshUntil` (the advert replies, advert:reported-advert-pulled-at-once). */
  keptUntil?: number;
}

/** A reply as it is sent: from the cache or just made, with the seconds a browser may keep it. */
export interface Served {
  body: string | ArrayBuffer;
  type: string;
  maxAge: number;
}

/**
 * Raised when a cached reply changes shape, so a deploy never serves a reply
 * an older version stored (the Cache API outlives a deploy).
 */
const SHAPE = 1;

/** The moment a stored reply stops being fresh, kept beside it so a hit sends the seconds left, never the seconds it was stored with. */
const FRESH_UNTIL = "x-japacity-fresh-until";

/** The moment the server's cache lets a reply go, which may come before the browser's. */
const KEPT_UNTIL = "x-japacity-kept-until";

/**
 * The key: the game's own origin (the Worker answers only on its own custom
 * domain, so a request's origin is the deployment's), a path no route serves,
 * and the parts that make the reply the same for everyone. Never the request's
 * path, query, cookies or headers.
 */
export function edgeKey(origin: string, parts: (string | number)[]): string {
  return `${origin}/api/cache/${String(SHAPE)}/${parts.map((part) => encodeURIComponent(String(part))).join("/")}`;
}

/** `caches.default` in the Workers runtime; null where there is none (Node, the browser tests). */
export function edgeCache(): EdgeCache | null {
  return (globalThis as Partial<{ caches: CacheStorage }>).caches?.default ?? null;
}

/** Whole seconds from `now` to `until`, rounded up, as the replies always sent them. */
function secondsTo(until: number, now: number): number {
  return int.divCeil(until - now, time.SECOND_MS);
}

/** A fresh stored reply, or null. A cache that refuses or fails is a miss: the reply is then made as if there were none. */
async function kept(edge: EdgeCache, key: string, now: number): Promise<Served | null> {
  try {
    const hit = await edge.match(key);
    if (hit === undefined) return null;
    const until = Number(hit.headers.get(FRESH_UNTIL));
    const keptUntil = Number(hit.headers.get(KEPT_UNTIL));
    if (!Number.isSafeInteger(until) || !Number.isSafeInteger(keptUntil) || until <= now || keptUntil <= now) {
      await hit.body?.cancel();
      return null;
    }
    return { body: await hit.arrayBuffer(), type: hit.headers.get("content-type") ?? "application/octet-stream", maxAge: secondsTo(until, now) };
  } catch {
    return null;
  }
}

/** Stores a reply for as long as it is fresh. A refused store costs the next request one read, never this reply. */
async function keep(edge: EdgeCache, key: string, made: Made, keptUntil: number, keptFor: number): Promise<void> {
  try {
    const headers = { "content-type": made.type, "cache-control": `public, max-age=${String(keptFor)}`, [FRESH_UNTIL]: String(made.freshUntil), [KEPT_UNTIL]: String(keptUntil) };
    await edge.put(key, new Response(made.body, { headers }));
  } catch {
    return;
  }
}

/** A fresh stored reply under `key`, or null with no cache. */
async function keptIn(edge: EdgeCache | null, key: string, now: number): Promise<Served | null> {
  return edge === null ? null : kept(edge, key, now);
}

/** A reply just made, stored while the cache may keep it, and sent for the seconds the browser may. */
async function stored(edge: EdgeCache | null, key: string, now: number, made: Made): Promise<Served> {
  const maxAge = secondsTo(made.freshUntil, now);
  const keptUntil = Math.min(made.keptUntil ?? made.freshUntil, made.freshUntil);
  const keptFor = secondsTo(keptUntil, now);
  if (edge !== null && keptFor > 0) await keep(edge, key, made, keptUntil, keptFor);
  return { body: made.body, type: made.type, maxAge };
}

/**
 * server:public-replies-cached: the reply under `key`, from the cache while it is fresh, or
 * made by `make` (the database) and stored. With no cache every reply is made.
 */
export async function throughEdge(edge: EdgeCache | null, key: string, now: number, make: () => Promise<Made>): Promise<Served> {
  return (await keptIn(edge, key, now)) ?? stored(edge, key, now, await make());
}

/** As `throughEdge`, for a reply that may not exist (no such draw, no image to serve): a missing one is never stored. */
export async function throughEdgeIfAny(edge: EdgeCache | null, key: string, now: number, make: () => Promise<Made | null>): Promise<Served | null> {
  const hit = await keptIn(edge, key, now);
  if (hit !== null) return hit;
  const made = await make();
  return made === null ? null : stored(edge, key, now, made);
}

/** Lets the reply under `key` go, so the next request makes it again. A cache that refuses or fails costs nothing. */
export async function forgetKept(edge: EdgeCache | null, key: string): Promise<void> {
  try {
    await edge?.delete?.(key);
  } catch {
    return;
  }
}

/** The JSON content type Hono's `c.json` sends, so a reply from the cache is byte for byte the one made. */
export const JSON_TYPE = "application/json";

/** The reply as the route sends it, made or kept alike: public, for the seconds it stays the same for everyone. */
export function sent<E extends Env>(c: Context<E>, served: Served): Response {
  c.header("cache-control", `public, max-age=${String(served.maxAge)}`);
  return c.body(served.body, 200, { "content-type": served.type });
}
