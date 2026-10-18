// The kept type's reader never trusts the gallery's storage (decision 0024).
import { describe, expect, test } from "vitest";

import { keptTypeOf } from "./kept";
import { CARDS_KEY } from "../kept/storage";

const read = (value: string | null) => ({ getItem: (key: string) => (key === CARDS_KEY ? value : null) });

describe("the type kept with the send-off", () => {
  test("[R-PROLOGUE-009] given the gallery's entries, when the type is read for a life, then only that life's send-off card with a known type gives it", () => {
    const kept = JSON.stringify([
      { key: "a", scenario: "scenario.tunde", card: { kind: "send-off" }, type: "hustler" },
      { key: "b", scenario: "scenario.ada", card: { kind: "chapter" }, type: "gambler" },
      { key: "c", scenario: "scenario.ada", card: { kind: "send-off" }, type: "careful-saver" },
    ]);
    expect(keptTypeOf("scenario.ada", read(kept))).toBe("careful-saver");
    expect(keptTypeOf("scenario.tunde", read(kept))).toBe("hustler");
    expect(keptTypeOf("scenario.zainab", read(kept))).toBeNull();
  });

  test("[R-PROLOGUE-009] given nothing kept, a broken store, an unknown type or a blocked storage, when the type is read, then it is null", () => {
    expect(keptTypeOf("scenario.ada", read(null))).toBeNull();
    expect(keptTypeOf("scenario.ada", read("{not json"))).toBeNull();
    expect(keptTypeOf("scenario.ada", read(JSON.stringify({ kept: [] })))).toBeNull();
    expect(keptTypeOf("scenario.ada", read(JSON.stringify([{ scenario: "scenario.ada", card: { kind: "send-off" }, type: "the-boss" }])))).toBeNull();
    expect(keptTypeOf("scenario.ada", null)).toBeNull();
  });
});
