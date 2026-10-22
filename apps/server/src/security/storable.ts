// Text Postgres cannot store: U+0000, which no text or jsonb value may hold, and a lone UTF-16 surrogate, which has no
// UTF-8 form and which jsonb refuses. Memory stores take both, so without this a request that carries one is played
// in a test and fails in production as a statement error: a 500 and a failure line (server:no-platform-error-page,
// server:shared-observability-block). It is refused at the door instead, before any query: a body as 400, an id in
// the path as 404.
import type { ServerRejection } from "@japacity/api";
import type { MiddlewareHandler } from "hono";

const HIGH_FIRST = 0xd800;
const HIGH_LAST = 0xdbff;
const LOW_FIRST = 0xdc00;
const LOW_LAST = 0xdfff;

function isLow(unit: number): boolean {
  return unit >= LOW_FIRST && unit <= LOW_LAST;
}

/** True when Postgres can store the text: no U+0000, and every surrogate in a whole pair. */
export function storableText(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const unit = text.charCodeAt(index);
    if (unit === 0 || isLow(unit)) return false;
    if (unit >= HIGH_FIRST && unit <= HIGH_LAST) {
      if (!isLow(text.charCodeAt(index + 1))) return false;
      index += 1;
    }
  }
  return true;
}

/** True when every string in the value, and every key of every object in it, is text Postgres can store. */
export function storable(value: unknown): boolean {
  if (typeof value === "string") return storableText(value);
  if (Array.isArray(value)) return value.every(storable);
  if (typeof value === "object" && value !== null) return Object.entries(value).every(([key, each]) => storableText(key) && storable(each));
  return true;
}

function decoded(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    // A segment that does not decode reaches the routes as it came, which Postgres can store.
    return segment;
  }
}

/** An id in the path that Postgres cannot store names nothing, so it is answered as an unknown id before any route reads it. */
export function storablePaths(): MiddlewareHandler {
  return async (c, next) => {
    if (new URL(c.req.url).pathname.split("/").every((segment) => storableText(decoded(segment)))) {
      await next();
      return;
    }
    return c.json<ServerRejection>({ ok: false, code: "unknown-id", detail: "There is no such id." }, 404);
  };
}
