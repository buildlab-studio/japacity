/// <reference types="@cloudflare/vitest-plugin/types" />
// The public replies in the Workers runtime's own `caches.default` (server.md
// R-SERVER-039), as Miniflare runs it for `wrangler dev` and these tests: the
// runtime takes what the routes store, and gives it back.
import { time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { edgeCache, edgeKey, throughEdge, throughEdgeIfAny } from "./edge";

describe("the runtime's cache", () => {
  test("[R-SERVER-039] given the Workers runtime, when a public reply is asked for twice, then caches.default keeps it: made once, the same body and type back, for the seconds left; a missing reply is never kept", async () => {
    const edge = edgeCache();
    expect(edge).not.toBeNull();
    const now = Date.now();
    let made = 0;
    const make = () => {
      made += 1;
      return Promise.resolve({ body: '{"tick":5}', type: "application/json", freshUntil: now + time.MINUTE_MS });
    };
    const key = edgeKey("https://japacity.app", ["world", 5]);
    const first = await throughEdge(edge, key, now, make);
    const second = await throughEdge(edge, key, now + 20 * time.SECOND_MS, make);
    expect(made).toBe(1);
    expect(first.maxAge).toBe(60);
    expect(second.maxAge).toBe(40);
    expect(second.type).toBe("application/json");
    expect(typeof second.body === "string" ? second.body : new TextDecoder().decode(second.body)).toBe('{"tick":5}');

    const missing = edgeKey("https://japacity.app", ["draw", 404]);
    expect(await throughEdgeIfAny(edge, missing, now, () => Promise.resolve(null))).toBeNull();
    expect(await edge?.match(missing)).toBeUndefined();
  });
});
