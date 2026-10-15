// A stand-in for Cloudflare's `caches.default` in the Node tests (server.md
// R-SERVER-039). It keeps what it is given as Cloudflare does: a reply with
// `set-cookie`, or one whose cache-control does not allow keeping it, is not
// kept. It counts each ask, so a test can say how often the cache was used.
import type { EdgeCache } from "./edge";

interface Held {
  body: ArrayBuffer;
  headers: [string, string][];
}

export interface FakeEdge extends EdgeCache {
  /** Every key asked for, in order. */
  asked: string[];
  /** Every key stored, in order, with the headers it was stored with. */
  stored: { key: string; headers: Record<string, string> }[];
  /** Every key let go before its time, in order. */
  forgotten: string[];
  /** Drops everything kept, as a new data centre would start. */
  clear: () => void;
}

function keepable(headers: Headers): boolean {
  const control = headers.get("cache-control") ?? "";
  const maxAge = /max-age=(\d+)/.exec(control)?.[1];
  return !headers.has("set-cookie") && !/no-store|private/.test(control) && maxAge !== undefined && Number(maxAge) > 0;
}

export function fakeEdge(): FakeEdge {
  const held = new Map<string, Held>();
  const asked: string[] = [];
  const stored: FakeEdge["stored"] = [];
  const forgotten: string[] = [];
  return {
    asked,
    stored,
    forgotten,
    clear: () => {
      held.clear();
    },
    match: (key) => {
      asked.push(key);
      const found = held.get(key);
      return Promise.resolve(found === undefined ? undefined : new Response(found.body.slice(0), { headers: found.headers }));
    },
    put: async (key, response) => {
      const headers = Object.fromEntries(response.headers.entries());
      stored.push({ key, headers });
      const body = await response.arrayBuffer();
      if (keepable(response.headers)) held.set(key, { body, headers: [...response.headers.entries()] });
    },
    delete: (key) => {
      forgotten.push(key);
      return Promise.resolve(held.delete(key));
    },
  };
}

/** A cache that fails at every call, as one behind Cloudflare Access or a broken one might. */
export const brokenEdge: EdgeCache = {
  match: () => Promise.reject(new Error("no cache here")),
  put: () => Promise.reject(new Error("no cache here")),
};
