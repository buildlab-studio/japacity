import { time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import type { ModerationStore, NewReport } from "../pair.types";
import { must } from "./contract.testing";

function report(id: string, reporter = "account-a", at = time.DAY_MS, pair: string | null = "character-a~character-b"): NewReport {
  return { id, reporter, subject: { account: "account-b" }, reason: "harassment", cites: { messages: ["m-1"] }, pair, unverified: false, at };
}

const hold = { messages: ["m-1"], pair: "character-a~character-b", until: 91 * time.DAY_MS };

/** The contract every ModerationStore keeps. `make` returns an empty store each time it is called. */
export function suiteForModerationStore(make: () => Promise<ModerationStore>): void {
  describe("ModerationStore contract", () => {
    test("[moderation:block-refuses-both-ways] given a block one way, when either direction is asked, then both read as blocked, and a second block keeps the first time", async () => {
      const store = await make();
      await store.block({ from: "account-a", to: "account-b", at: time.DAY_MS });
      const again = await store.block({ from: "account-a", to: "account-b", at: 2 * time.DAY_MS });

      expect(again.at).toBe(time.DAY_MS);
      expect(await store.blocked("account-a", "account-b")).toBe(true);
      expect(await store.blocked("account-b", "account-a")).toBe(true);
      expect(await store.blocked("account-a", "account-c")).toBe(false);
      expect(await store.blocksBy("account-a")).toEqual([{ from: "account-a", to: "account-b", at: time.DAY_MS }]);
      expect(await store.blocksBy("account-b")).toEqual([]);
    });

    test("[moderation:block-refuses-both-ways] given blocks made by an account and against it, when the accounts it is blocked with are read, then each other account is named once, whichever side blocked, and a lifted block names no one", async () => {
      const store = await make();
      await store.block({ from: "account-a", to: "account-b", at: time.DAY_MS });
      await store.block({ from: "account-c", to: "account-a", at: time.DAY_MS });
      await store.block({ from: "account-a", to: "account-c", at: 2 * time.DAY_MS });
      await store.block({ from: "account-d", to: "account-e", at: time.DAY_MS });

      expect([...(await store.blockedWith("account-a"))].sort()).toEqual(["account-b", "account-c"]);
      expect(await store.blockedWith("account-b")).toEqual(["account-a"]);
      expect(await store.blockedWith("account-e")).toEqual(["account-d"]);
      expect(await store.blockedWith("account-f")).toEqual([]);
      await store.unblock("account-d", "account-e");
      expect(await store.blockedWith("account-e")).toEqual([]);
    });

    test("[moderation:block-ends-pair-records] given a block, when it is lifted, then neither direction is blocked and a second lift finds nothing", async () => {
      const store = await make();
      await store.block({ from: "account-a", to: "account-b", at: time.DAY_MS });

      expect(await store.unblock("account-a", "account-b")).toBe(true);
      expect(await store.blocked("account-b", "account-a")).toBe(false);
      expect(await store.unblock("account-a", "account-b")).toBe(false);
    });

    test("[pair:report-holds-conversation] [moderation:reports-hold-cited-records] given a report, when it is filed, then it is open with its hold until the hold runs out", async () => {
      const store = await make();
      const filed = must(await store.report(report("report-1"), hold));

      expect(filed).toMatchObject({ id: "report-1", status: "open", outcome: null, decidedAt: null, cites: { messages: ["m-1"] } });
      expect(await store.report(report("report-1"), hold)).toMatchObject({ ok: false, code: "exists" });
      expect(await store.holds(91 * time.DAY_MS - 1)).toEqual([{ report: "report-1", messages: ["m-1"], pair: "character-a~character-b", until: 91 * time.DAY_MS, lifted: false }]);
      expect(await store.holds(91 * time.DAY_MS)).toEqual([]);
      expect((await store.openOn("character-a~character-b")).map((row) => row.id)).toEqual(["report-1"]);
    });

    test("[moderation:reporter-told-outcome-only] [moderation:reports-hold-cited-records] given an open report, when it is closed, then it is decided with its outcome, its hold lifts, and a second close is refused", async () => {
      const store = await make();
      must(await store.report(report("report-1"), hold));

      const closed = must(await store.close("report-1", "acted", 2 * time.DAY_MS));

      expect(closed).toMatchObject({ status: "decided", outcome: "acted", decidedAt: 2 * time.DAY_MS });
      expect(await store.holds(2 * time.DAY_MS)).toEqual([]);
      expect(await store.openOn("character-a~character-b")).toEqual([]);
      expect(await store.close("report-1", "no-action", 3 * time.DAY_MS)).toMatchObject({ ok: false, code: "closed" });
      expect(await store.close("report-9", "no-action", 3 * time.DAY_MS)).toMatchObject({ ok: false, code: "missing" });
    });

    test("[moderation:reports-hold-cited-records] given an open report, when its hold is lifted, then the report stays open and holds nothing", async () => {
      const store = await make();
      must(await store.report(report("report-1"), hold));

      expect(must(await store.lift("report-1"))).toMatchObject({ lifted: true });
      expect(await store.holds(time.DAY_MS)).toEqual([]);
      expect(await store.get("report-1")).toMatchObject({ status: "open" });
      expect(await store.lift("report-9")).toMatchObject({ ok: false, code: "missing" });
    });

    test("[moderation:report-offers-block] [moderation:one-queue-by-reason-weight] given reports on several days, when they are counted and listed, then the count starts at the given time and the list is oldest first", async () => {
      const store = await make();
      must(await store.report(report("late", "account-a", 3 * time.DAY_MS), hold));
      must(await store.report(report("early", "account-a", time.DAY_MS), hold));
      must(await store.report(report("other", "account-c", 2 * time.DAY_MS), hold));

      expect(await store.filedSince("account-a", 3 * time.DAY_MS)).toBe(1);
      expect(await store.filedSince("account-a", time.DAY_MS)).toBe(2);
      expect((await store.list("open")).map((row) => row.id)).toEqual(["early", "other", "late"]);
      expect(await store.list("decided")).toEqual([]);
    });

    test("[account:deleted-data-removed-within-month] [moderation:reports-hold-cited-records] given an account's blocks and reports, when it is removed, then its blocks go both ways and only its reports with a running hold stay", async () => {
      const store = await make();
      await store.block({ from: "account-a", to: "account-b", at: time.DAY_MS });
      await store.block({ from: "account-c", to: "account-a", at: time.DAY_MS });
      must(await store.report(report("held"), hold));
      must(await store.report(report("decided"), hold));
      must(await store.close("decided", "no-action", 2 * time.DAY_MS));

      await store.remove("account-a", 2 * time.DAY_MS);

      expect(await store.blocked("account-a", "account-b")).toBe(false);
      expect(await store.blocked("account-a", "account-c")).toBe(false);
      expect(await store.get("held")).not.toBeNull();
      expect(await store.get("decided")).toBeNull();
    });
  });
}
