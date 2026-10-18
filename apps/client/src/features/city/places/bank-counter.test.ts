// The bank's counter (place.olokun-office, the bank-counter file): after the deposit, the clerk at the
// left window takes back the funds held for the visa (docs/rules/world.md R-WORLD-005).
import { describe, expect, test } from "vitest";

import raw from "../../../../public/assets/places/bank-counter/place.json";
import { say } from "../../../shared/words/text";
import { stagedNow, thingSpot, thingsNow } from "../scene/things";
import { heldFundsOpen, heldFundsPaid, offeredFrom } from "./offices.testing";
import { staged } from "./place.testing";
import { cityWords } from "../city.words";

const { stage, entry } = staged(raw, "place.olokun-office");
const things = stage.things ?? [];

function now(view: ReturnType<typeof heldFundsOpen>) {
  return thingsNow(things, stagedNow(offeredFrom(view), new Set(entry.stages), new Set(view.offers.map((offer) => offer.entry)), null));
}

describe("the bank's counter after the deposit", () => {
  test("[R-WORLD-005] given the recorded life after the deposit with the held funds open, when the counter's things are read, then the clerk shows with Pay back what is held, which sends obligation/pay", () => {
    const view = heldFundsOpen();
    expect(view.obligations.map((owed) => owed.entry)).toContain("obligation.held-funds");
    const clerk = now(view).find((thing) => thing.id === "clerk");
    expect(clerk?.acts).toEqual([{ id: "pay-back", label: "ui.world.pay-back", kind: "command", command: "obligation/pay" }]);
    expect(cityWords(clerk?.label ?? "")).toBe("Clerk");
    expect(cityWords(clerk?.acts[0]?.label ?? "")).toBe(say("ui.world.pay-back"));
    expect(cityWords(clerk?.acts[0]?.label ?? "")).toBe("Pay back what is held");
  });

  test("[R-WORLD-005] given the held funds paid back, when the counter's things are read, then the clerk's act is gone with them", () => {
    const view = heldFundsPaid();
    expect(view.obligations.map((owed) => owed.entry)).not.toContain("obligation.held-funds");
    expect(now(view).find((thing) => thing.id === "clerk")).toBeUndefined();
  });

  test("[R-WORLD-005] given the clerk and the counter, when where their labels stand is read, then the clerk stands at the left window, apart from the counter, and keeps the deposit's act first on the counter", () => {
    const clerk = things.find((thing) => thing.id === "clerk");
    const counter = things.find((thing) => thing.id === "counter");
    if (clerk === undefined || counter === undefined) throw new Error("No clerk or counter");
    const [x, z] = thingSpot(stage, clerk) ?? [0, 0];
    const [cx, cz] = thingSpot(stage, counter) ?? [0, 0];
    expect(Math.hypot(x - cx, z - cz)).toBeGreaterThan(1);
    expect(x).toBeLessThan(0);
    expect(counter.acts[0]).toMatchObject({ id: "deposit", command: "route/pay-deposit" });
  });
});
