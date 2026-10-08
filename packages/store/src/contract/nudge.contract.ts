import { describe, expect, test } from "vitest";

import type { Nudge, NudgeBus } from "../types";

/** The contract every NudgeBus keeps. `make` returns a bus with no subscriber each time it is called. */
export function suiteForNudgeBus(make: () => Promise<NudgeBus>): void {
  describe("NudgeBus contract", () => {
    test("[R-CLOCK-020] given two subscribers of one account and one of another, when the account is nudged, then both of its subscribers get it and the other gets nothing", async () => {
      const bus = await make();
      const first: Nudge[] = [];
      const second: Nudge[] = [];
      const other: Nudge[] = [];
      bus.subscribe("account-1", (nudge) => first.push(nudge));
      bus.subscribe("account-1", (nudge) => second.push(nudge));
      bus.subscribe("account-2", (nudge) => other.push(nudge));

      await bus.send("account-1", { nudge: "view", v: 7 });
      await bus.send("account-1", { nudge: "presence" });

      expect(first).toEqual([{ nudge: "view", v: 7 }, { nudge: "presence" }]);
      expect(second).toEqual(first);
      expect(other).toEqual([]);
    });

    test("[R-CLOCK-022] given an account with no subscriber, when it is nudged, then the nudge is dropped without an error", async () => {
      const bus = await make();

      await expect(bus.send("account-nobody", { nudge: "messages" })).resolves.toBeUndefined();
    });

    test("[R-CLOCK-022] given a subscription that ended, when the account is nudged, then that handler gets nothing", async () => {
      const bus = await make();
      const seen: Nudge[] = [];
      const kept: Nudge[] = [];
      const end = bus.subscribe("account-1", (nudge) => seen.push(nudge));
      bus.subscribe("account-1", (nudge) => kept.push(nudge));

      end();
      end();
      await bus.send("account-1", { nudge: "view", v: 1 });

      expect(seen).toEqual([]);
      expect(kept).toEqual([{ nudge: "view", v: 1 }]);
    });

    test("[R-CLOCK-022] given a handler that throws, when the account is nudged, then the other subscribers still get it and the send does not fail", async () => {
      const bus = await make();
      const seen: Nudge[] = [];
      bus.subscribe("account-1", () => {
        throw new Error("socket gone");
      });
      bus.subscribe("account-1", (nudge) => seen.push(nudge));

      await expect(bus.send("account-1", { nudge: "messages" })).resolves.toBeUndefined();
      expect(seen).toEqual([{ nudge: "messages" }]);
    });
  });
}
