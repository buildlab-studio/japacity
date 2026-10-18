import { describe, expect, test } from "vitest";

import type { InviteStore, NewInvite } from "../pair.types";
import { must } from "./contract.testing";

const DAY = 86_400_000;

function link(code: string, from = "character-a", madeAt = DAY): NewInvite {
  return { code, from, account: `account-of-${from}`, slot: "partner", looking: "partner", fill: "who-codes", card: { name: "scenario.ada.name" }, madeAt, expires: madeAt + 14 * DAY };
}

/** The contract every InviteStore keeps. `make` returns an empty store each time it is called. */
export function suiteForInviteStore(make: () => Promise<InviteStore>): void {
  describe("InviteStore contract", () => {
    test("[R-PAIR-008] given a link, when it is stored and read back, then it is unused with every field as made", async () => {
      const store = await make();
      must(await store.create(link("code-1")));

      expect(await store.get("code-1")).toEqual({ ...link("code-1"), used: false, by: null, pair: null, usedAt: null, before: [] });
      expect(await store.get("code-2")).toBeNull();
      expect(await store.create(link("code-1"))).toMatchObject({ ok: false, code: "exists" });
    });

    test("[R-PAIR-008] given a link, when it is used twice, then the second is refused as closed and the first use stands", async () => {
      const store = await make();
      must(await store.create(link("code-1")));

      const used = must(await store.use("code-1", { by: "character-b", pair: "character-a~character-b", at: 2 * DAY, before: ["prologue"] }));
      const again = await store.use("code-1", { by: "character-c", pair: "character-a~character-c", at: 3 * DAY, before: [] });

      expect(used).toMatchObject({ used: true, by: "character-b", pair: "character-a~character-b", usedAt: 2 * DAY, before: ["prologue"] });
      expect(again).toMatchObject({ ok: false, code: "closed" });
      expect(await store.get("code-1")).toMatchObject({ by: "character-b" });
      expect(await store.use("code-9", { by: "character-b", pair: "x~y", at: DAY, before: [] })).toMatchObject({ ok: false, code: "missing" });
    });

    test("[R-PAIR-008] given a used link released, when it is used again, then the new use is accepted", async () => {
      const store = await make();
      must(await store.create(link("code-1")));
      must(await store.use("code-1", { by: "character-b", pair: "character-a~character-b", at: 2 * DAY, before: [] }));

      must(await store.release("code-1"));

      expect(await store.get("code-1")).toMatchObject({ used: false, by: null, pair: null });
      expect(await store.release("code-1")).toMatchObject({ ok: false, code: "missing" });
      must(await store.use("code-1", { by: "character-c", pair: "character-a~character-c", at: 3 * DAY, before: [] }));
    });

    test("[R-PAIR-008] given links made, used and expired, when the open ones are listed, then only the unused ones still in date come back, oldest first, up to a millisecond before expiry", async () => {
      const store = await make();
      must(await store.create(link("late", "character-a", 3 * DAY)));
      must(await store.create(link("early", "character-a", DAY)));
      must(await store.create(link("used", "character-a", 2 * DAY)));
      must(await store.create(link("other", "character-z", DAY)));
      must(await store.use("used", { by: "character-b", pair: "character-a~character-b", at: 2 * DAY, before: [] }));

      const expiry = 15 * DAY;
      expect((await store.open("character-a", expiry - 1)).map((row) => row.code)).toEqual(["early", "late"]);
      expect((await store.open("character-a", expiry)).map((row) => row.code)).toEqual(["late"]);
    });

    test("[R-PAIR-001] given links used between characters, when the pairs are listed, then each key comes once, in key order, for either side", async () => {
      const store = await make();
      for (const code of ["one", "two", "three"]) must(await store.create(link(code, code === "three" ? "character-c" : "character-a")));
      must(await store.use("one", { by: "character-b", pair: "character-a~character-b", at: DAY, before: [] }));
      must(await store.use("two", { by: "character-b", pair: "character-a~character-b", at: 2 * DAY, before: [] }));
      must(await store.use("three", { by: "character-a", pair: "character-a~character-c", at: 3 * DAY, before: [] }));

      expect(await store.pairsOf("character-a")).toEqual(["character-a~character-b", "character-a~character-c"]);
      expect(await store.pairsOf("character-b")).toEqual(["character-a~character-b"]);
      expect(await store.pairs()).toEqual(["character-a~character-b", "character-a~character-c"]);
      expect((await store.linkedBy("character-b")).map((row) => row.code)).toEqual(["one", "two"]);
    });

    test("[R-PAIR-009] given a reward, when the same friend's milestone is given again, then it is refused and the first stays", async () => {
      const store = await make();
      const reward = { from: "character-a", friend: "character-b", reached: "prologue" as const, frame: "card.frame.prologue", line: "line.pair.reward.prologue", at: DAY };
      must(await store.reward(reward));

      expect(await store.reward({ ...reward, at: 2 * DAY })).toMatchObject({ ok: false, code: "exists" });
      must(await store.reward({ ...reward, reached: "departed", frame: "card.frame.departed", line: "line.pair.reward.departed" }));
      expect((await store.rewards("character-a")).map((row) => [row.reached, row.at])).toEqual([["prologue", DAY], ["departed", DAY]]);
    });

    test("[R-ACCOUNT-017] given a character's links, uses and rewards, when it is removed, then none that name it is left and the others stay", async () => {
      const store = await make();
      must(await store.create(link("mine", "character-a")));
      must(await store.create(link("theirs", "character-c")));
      must(await store.create(link("kept", "character-c")));
      must(await store.use("theirs", { by: "character-a", pair: "character-a~character-c", at: DAY, before: [] }));
      must(await store.reward({ from: "character-c", friend: "character-a", reached: "prologue", frame: "f", line: "l", at: DAY }));

      await store.remove("character-a");

      expect(await store.get("mine")).toBeNull();
      expect(await store.get("theirs")).toBeNull();
      expect(await store.get("kept")).not.toBeNull();
      expect(await store.pairsOf("character-c")).toEqual([]);
      expect(await store.rewards("character-c")).toEqual([]);
    });
  });
}
