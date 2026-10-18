import { describe, expect, test } from "vitest";

import type { AppealStore, BannedIdentityStore, FeedbackRow, FeedbackStore, ModerationLogEntry, ModerationLogStore } from "../moderation.types";
import { must } from "./contract.testing";

function entry(id: string, over: Partial<ModerationLogEntry> = {}): ModerationLogEntry {
  return { id, admin: "account.admin", at: 5_000, item: "report.1", action: "warn", params: { account: "account.b" }, reason: "harassment", ...over };
}

function feedback(id: string, day: string, over: Partial<FeedbackRow> = {}): FeedbackRow {
  return { id, text: `words ${id}`, build: "b-41", screen: "month", mode: "high", day, region: "NG", ...over };
}

/** The contract every ModerationLogStore keeps. `make` returns an empty store each time it is called. */
export function suiteForModerationLogStore(make: () => Promise<ModerationLogStore>): void {
  describe("ModerationLogStore contract", () => {
    test("[R-MODERATION-015] given entries written, when they are listed by item or by account, then they come back whole in the order written", async () => {
      const store = await make();
      const first = must(await store.append(entry("log.1", { note: "first" })));
      must(await store.append(entry("log.2", { item: "report.2", action: "mute", params: { account: "account.c", days: 7 } })));
      const third = must(await store.append(entry("log.3", { at: 6_000, action: "ban" })));

      expect(first).toEqual(entry("log.1", { note: "first" }));
      expect(await store.list({ item: "report.1" })).toEqual([first, third]);
      expect(await store.list({ account: "account.c" })).toEqual([entry("log.2", { item: "report.2", action: "mute", params: { account: "account.c", days: 7 } })]);
      expect(await store.list({ account: "account.b", item: "report.1" })).toEqual([first, third]);
      expect(await store.list({ account: "account.nobody" })).toEqual([]);
      expect(await store.get("log.3")).toEqual(third);
      expect(await store.get("log.9")).toBeNull();
    });

    test("[R-MODERATION-015] given an entry, when the same id is written again, then it is refused and the first is unchanged", async () => {
      const store = await make();
      must(await store.append(entry("log.1")));

      expect(await store.append(entry("log.1", { action: "dismiss" }))).toMatchObject({ ok: false, code: "exists" });
      expect(await store.get("log.1")).toEqual(entry("log.1"));
    });

    test("[R-MODERATION-015] given the store, when its methods are read, then none changes or removes an entry", async () => {
      const store = await make();
      expect(Object.keys(store).sort()).toEqual(["append", "get", "list"]);
    });
  });
}

/** The contract every BannedIdentityStore keeps. */
export function suiteForBannedIdentityStore(make: () => Promise<BannedIdentityStore>): void {
  describe("BannedIdentityStore contract", () => {
    test("[R-MODERATION-018] given hashes banned, when they are asked for, then they are held, a second ban of one is harmless, and others are not", async () => {
      const store = await make();
      await store.add(["hash-email", "hash-google"], 1_000);
      await store.add(["hash-email"], 2_000);
      await store.add([], 3_000);

      expect(await store.has("hash-email")).toBe(true);
      expect(await store.has("hash-google")).toBe(true);
      expect(await store.has("hash-other")).toBe(false);
    });
  });
}

/** The contract every AppealStore keeps. */
export function suiteForAppealStore(make: () => Promise<AppealStore>): void {
  describe("AppealStore contract", () => {
    test("[R-MODERATION-016] given an appeal filed, when the same entry is appealed again, then it is refused and one stays open", async () => {
      const store = await make();
      const filed = must(await store.file({ id: "appeal.1", account: "account.b", entry: "log.1", at: 1_000 }));

      expect(filed).toEqual({ id: "appeal.1", account: "account.b", entry: "log.1", at: 1_000, status: "open" });
      expect(await store.file({ id: "appeal.2", account: "account.b", entry: "log.1", at: 2_000 })).toMatchObject({ ok: false, code: "exists" });
      expect(await store.file({ id: "appeal.1", account: "account.b", entry: "log.2", at: 2_000 })).toMatchObject({ ok: false, code: "exists" });
      expect(await store.pending()).toEqual([filed]);
    });

    test("[R-MODERATION-016] given open appeals, when one is decided, then it leaves the pending list, keeps its decision, and cannot be decided again", async () => {
      const store = await make();
      must(await store.file({ id: "appeal.1", account: "account.b", entry: "log.1", at: 1_000 }));
      const second = must(await store.file({ id: "appeal.2", account: "account.c", entry: "log.2", at: 2_000 }));

      const decided = must(await store.decide("appeal.1", { outcome: "overturned", by: "account.admin-2", at: 3_000 }));

      expect(decided).toEqual({ id: "appeal.1", account: "account.b", entry: "log.1", at: 1_000, status: "decided", outcome: "overturned", decidedBy: "account.admin-2", decidedAt: 3_000 });
      expect(await store.pending()).toEqual([second]);
      expect(await store.forAccount("account.b")).toEqual([decided]);
      expect(await store.get("appeal.1")).toEqual(decided);
      expect(await store.decide("appeal.1", { outcome: "upheld", by: "account.admin-2", at: 4_000 })).toMatchObject({ ok: false, code: "closed" });
      expect(await store.decide("appeal.9", { outcome: "upheld", by: "account.admin-2", at: 4_000 })).toMatchObject({ ok: false, code: "missing" });
      expect(await store.get("appeal.9")).toBeNull();
    });
  });
}

/** The contract every FeedbackStore keeps. */
export function suiteForFeedbackStore(make: () => Promise<FeedbackStore>): void {
  describe("FeedbackStore contract", () => {
    test("[R-MODERATION-020] given a sender's sends counted, when the fifth and the sixth are taken on one day, then the fifth is allowed and the sixth is not; the next day starts again", async () => {
      const store = await make();
      const taken: boolean[] = [];
      for (let send = 0; send < 6; send += 1) taken.push(await store.take("sender-a", "2026-10-08", 5));

      expect(taken).toEqual([true, true, true, true, true, false]);
      expect(await store.take("sender-b", "2026-10-08", 5)).toBe(true);
      expect(await store.take("sender-a", "2026-10-09", 5)).toBe(true);
    });

    test("[R-MODERATION-020] given rows kept, when they are listed, then they come back whole, newest first, as many as asked", async () => {
      const store = await make();
      must(await store.add(feedback("feedback.1", "2026-10-07")));
      must(await store.add(feedback("feedback.2", "2026-10-08", { mode: "low", screen: "road" })));

      expect(await store.list(10)).toEqual([feedback("feedback.2", "2026-10-08", { mode: "low", screen: "road" }), feedback("feedback.1", "2026-10-07")]);
      expect(await store.list(1)).toEqual([feedback("feedback.2", "2026-10-08", { mode: "low", screen: "road" })]);
      expect(await store.add(feedback("feedback.1", "2026-10-09"))).toMatchObject({ ok: false, code: "exists" });
    });

    test("[R-MODERATION-020] given rows on three days, when the days before one are dropped, then only that day and later stay; forgetting a day's sends lets the sender send again", async () => {
      const store = await make();
      must(await store.add(feedback("feedback.1", "2026-04-10")));
      must(await store.add(feedback("feedback.2", "2026-04-11")));
      must(await store.add(feedback("feedback.3", "2026-04-12")));
      for (let send = 0; send < 5; send += 1) await store.take("sender-a", "2026-04-10", 5);

      expect(await store.drop("2026-04-11")).toBe(1);

      expect((await store.list(10)).map((row) => row.id)).toEqual(["feedback.3", "feedback.2"]);
      expect(await store.drop("2026-04-11")).toBe(0);
      expect(await store.take("sender-a", "2026-04-10", 5)).toBe(false);
      await store.forget("2026-04-10");
      expect(await store.take("sender-a", "2026-04-10", 5)).toBe(false);
      await store.forget("2026-04-11");
      expect(await store.take("sender-a", "2026-04-10", 5)).toBe(true);
      expect((await store.list(10)).map((row) => row.id)).toEqual(["feedback.3", "feedback.2"]);
    });
  });
}
