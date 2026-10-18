// What the routes answer with: a refusal in the contract's shape, a body read
// without throwing, and a reply no cache keeps.
import type { ServerCode, ServerRejection } from "@japacity/api";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export function rejection(code: ServerCode, detail: string): ServerRejection {
  return { ok: false, code, detail };
}

/** A refusal sent with its status. */
export function refuse(c: Context, status: ContentfulStatusCode, code: ServerCode, detail: string): Response {
  return c.json(rejection(code, detail), status);
}

/** The request's JSON body as an object; empty when there is none or it is not an object. */
export async function bodyOf(request: { json: () => Promise<unknown> }): Promise<Record<string, unknown>> {
  const body: unknown = await request.json().catch(() => null);
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
}

/** A reply that differs for each account or changes with every commit: the browser and the edge keep none of it. */
export function keepNone(c: Context): void {
  c.header("cache-control", "private, no-store");
}
