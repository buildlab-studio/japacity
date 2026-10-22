import { describe, expect, test, vi } from "vitest";

import { testServer } from "../authority/authority.testing";
import { freshDatabases, postgresStores } from "../postgres.testing";
import { storable } from "./storable";

const open = freshDatabases();

describe("text Postgres can store", () => {
  test("[server:no-platform-error-page] given text with U+0000, a lone high or low surrogate, a whole pair and plain words, as values and as keys at any depth, when each is judged, then only the first three are refused", () => {
    for (const bad of ["\u0000", "a\u0000b", "a\ud800", "\ud800b", "a\udc00", "\udfffb", "\udc00\ud800"]) {
      expect(storable(bad)).toBe(false);
      expect(storable({ type: "x", deep: [{ text: bad }] })).toBe(false);
      expect(storable({ [bad]: 1 })).toBe(false);
    }
    for (const good of ["", "plain words", "Ọ̀rẹ́ ₦5,000", "\ud83d\ude00", "\ud800\udc00"]) {
      expect(storable(good)).toBe(true);
      expect(storable({ type: "x", deep: [{ text: good, n: 1, none: null, yes: true }] })).toBe(true);
    }
  });

  test("[server:no-platform-error-page] given an id in the path holding U+0000, signed out, when it is asked of the database's stores and of memory, then each answers 404 before any query and writes no failure line", async () => {
    const connection = await open();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    for (const server of [testServer({ stores: postgresStores(connection) }), testServer()]) {
      for (const path of ["/api/invite/abc%00", "/api/adverts/image/c%00/1", "/api/invite/%00/accept"]) {
        const method = path.endsWith("/accept") ? "POST" : "GET";
        const reply = await server.app.request(path, { method, headers: { "cf-connecting-ip": "203.0.113.50" } });
        expect({ path, status: reply.status }).toEqual({ path, status: 404 });
        expect(await reply.json()).toMatchObject({ ok: false, code: "unknown-id" });
      }
    }
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
