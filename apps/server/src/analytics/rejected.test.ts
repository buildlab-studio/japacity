import type { ServerCode } from "@japacity/api";
import { content } from "@japacity/content";
import { time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { signUp, testServer } from "../authority/authority.testing";
import { counterDef, keyAllowed } from "./list";
import { countRejected } from "./rejected";

/** Every code the server can answer with; the record fails to compile when one is added and not listed here. */
const CODES: Record<ServerCode, true> = {
  stale: true,
  "clock-went-back": true,
  "no-turns": true,
  "setpiece-open": true,
  "not-legal": true,
  "cannot-afford": true,
  "unknown-id": true,
  "bad-amount": true,
  "not-yours": true,
  ended: true,
  "prologue-open": true,
  "rate-limited": true,
  "signed-out": true,
  diverged: true,
  "one-character": true,
  "no-character": true,
  "switched-off": true,
  "under-age": true,
  "bad-date": true,
  "bot-check": true,
  "not-fresh": true,
  "bad-code": true,
  "not-possible": true,
  "blocked": true,
  "too-many": true,
  "wrong-place": true,
  "bad-fill": true,
  "not-here": true,
  "used": true,
  "expired": true,
  "wrong-slot": true,
  "not-adult": true,
  "moved-on": true,
  "guest-only": true,
  "bad-light": true,
};

describe("rejections by code", () => {
  test("[analytics:nightly-game-counters] given every code the server answers with, when the counter list is read, then command/rejected allows each and no code the server never answers with", () => {
    const def = counterDef(content, "command/rejected");
    if (def === null) throw new Error("command/rejected is not on the list.");
    expect(Object.keys(CODES).filter((code) => !keyAllowed(content, def, code))).toEqual([]);
    expect(Array.isArray(def.keys) ? [...def.keys].sort() : def.keys).toEqual(Object.keys(CODES).sort());
  });

  test("[analytics:nightly-game-counters] [analytics:store-holds-nothing-personal] given a rejection, when it is counted, then the day's total for its code and the account's region rises and no account is stored", async () => {
    const server = testServer();
    await signUp(server, "account.a");
    await countRejected(server.deps, "account.a", "stale");
    await countRejected(server.deps, "account.a", "stale");
    await countRejected(server.deps, null, "rate-limited");
    const day = time.dayName(time.utcDay(server.deps.now()));
    expect(await server.deps.stores.counters.days(day, day)).toEqual([
      { day, region: "NG", name: "command/rejected", key: "stale", count: 2 },
      { day, region: "XX", name: "command/rejected", key: "rate-limited", count: 1 },
    ]);
  });
});
