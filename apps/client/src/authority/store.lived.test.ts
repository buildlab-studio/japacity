// The month turns only when the life sleeps (docs/rules/world.md R-WORLD-025; activity.md R-ACTIVITY-020; decision 0011):
// an act that spends the month's last free time turns nothing; the night falls, and the bed's Sleep is the way on.
import type { Command, PlayerView, Reply } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { engineView } from "../shared/testing/fixtures";
import { createGameStore } from "./store";

/** A view at version `v` with the month's free time spent up to `spent` of 60 half-days. */
function at(v: number, spent: number): PlayerView {
  return { ...engineView(), v, halfDays: { spent, free: 60 } };
}

/** An authority whose acts spend the month to `firstSpent` and whose turn starts the next one at none spent. */
function authority(firstSpent: number) {
  const sent: Command[] = [];
  let v = 1;
  return {
    sent,
    view: () => Promise.resolve(at(v, 0)),
    send(command: Command): Promise<Reply> {
      sent.push(command);
      v += 1;
      return Promise.resolve({ ok: true, view: at(v, command.type === "turn/end" ? 0 : firstSpent), lines: [] });
    },
  };
}

const cook: Command = { type: "activity/now", activity: "activity.cook-at-home", param: null, basedOn: 0 };

describe("the month turns when the life sleeps", () => {
  test("[R-WORLD-025] [R-ACTIVITY-020] given the act that spends the month's last free time, when it is accepted, then the store ends nothing by itself and no results open", async () => {
    const fake = authority(60);
    const store = createGameStore(fake);
    await store.getState().refresh();
    await store.getState().send(cook);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fake.sent.map((command) => command.type)).toEqual(["activity/now"]);
    expect(store.getState().reportOpen).toBe(false);
    expect(store.getState().view?.halfDays).toEqual({ spent: 60, free: 60 });
  });

  test("[R-WORLD-025] given the month's time all spent, when the life sleeps, then the month ends with the commitments and the results open", async () => {
    const fake = authority(60);
    const store = createGameStore(fake);
    await store.getState().refresh();
    await store.getState().send(cook);
    await store.getState().endMonth(true);
    expect(fake.sent.map((command) => command.type)).toEqual(["activity/now", "turn/end"]);
    expect(store.getState().reportOpen).toBe(true);
    expect(store.getState().view?.halfDays.spent).toBe(0);
  });
});
