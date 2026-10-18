import type { ConversationRow } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import type { ConversationStore } from "../pair.types";
import { must } from "./contract.testing";

const PAIR = "character-a~character-b";

function row(id: string, sender: string, sentAt: number, conversation = PAIR): ConversationRow {
  return { id, conversation, sender, phrase: "phrase.hello", fill: null, sentAt, readAt: null };
}

/** The contract every ConversationStore keeps. `make` returns an empty store each time it is called. */
export function suiteForConversationStore(make: () => Promise<ConversationStore>): void {
  describe("ConversationStore contract", () => {
    test("[pair:conversation-phrases-stored] given rows sent out of order, when the conversation is listed, then they come by time then id, and after a message only the later ones", async () => {
      const store = await make();
      must(await store.add(row("m-3", "character-a", 30)));
      must(await store.add(row("m-1", "character-a", 10)));
      must(await store.add(row("m-2b", "character-b", 20)));
      must(await store.add(row("m-2a", "character-a", 20)));
      must(await store.add(row("x-1", "character-a", 15, "character-a~character-c")));

      expect((await store.list(PAIR, null)).map((each) => each.id)).toEqual(["m-1", "m-2a", "m-2b", "m-3"]);
      expect((await store.list(PAIR, "m-2a")).map((each) => each.id)).toEqual(["m-2b", "m-3"]);
      expect(await store.list(PAIR, "m-3")).toEqual([]);
      expect((await store.list(PAIR, "unknown")).map((each) => each.id)).toEqual(["m-1", "m-2a", "m-2b", "m-3"]);
      expect(await store.add(row("m-1", "character-a", 99))).toMatchObject({ ok: false, code: "exists" });
    });

    test("[pair:conversation-phrases-stored] given rows from both sides, when one side reads, then only the other side's unread rows are marked, once", async () => {
      const store = await make();
      must(await store.add(row("m-1", "character-a", 10)));
      must(await store.add(row("m-2", "character-b", 20)));

      expect(await store.markRead(PAIR, "character-b", 50)).toBe(1);
      expect(await store.markRead(PAIR, "character-b", 60)).toBe(0);
      expect((await store.list(PAIR, null)).map((each) => [each.id, each.readAt])).toEqual([["m-1", 50], ["m-2", null]]);
    });

    test("[pair:phrase-checks-before-send] given a sender's rows, when the sends since a time are asked for, then only that sender's in that conversation from that time on are counted", async () => {
      const store = await make();
      must(await store.add(row("m-1", "character-a", 10)));
      must(await store.add(row("m-2", "character-a", 20)));
      must(await store.add(row("m-3", "character-b", 30)));
      must(await store.add(row("x-1", "character-a", 40, "character-a~character-c")));

      expect(await store.sentSince(PAIR, "character-a", 20)).toEqual([20]);
      expect(await store.sentSince(PAIR, "character-a", 0)).toEqual([10, 20]);
    });

    test("[account:deleted-data-removed-within-month] [moderation:reports-hold-cited-records] given a character's conversations, when its rows are removed keeping the held ones, then the held rows and other conversations stay", async () => {
      const store = await make();
      must(await store.add(row("m-1", "character-a", 10)));
      must(await store.add(row("m-2", "character-b", 20)));
      must(await store.add(row("x-1", "character-c", 15, "character-b~character-c")));

      expect(await store.removeFor("character-a", ["m-2"])).toBe(1);

      expect((await store.list(PAIR, null)).map((each) => each.id)).toEqual(["m-2"]);
      expect((await store.byIds(["x-1", "m-2", "gone"])).map((each) => each.id)).toEqual(["x-1", "m-2"]);
    });
  });
}
