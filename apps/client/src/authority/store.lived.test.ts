import type { Command, PlayerView, Reply } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { engineView } from "../shared/testing/fixtures";
import { createGameStore } from "./store";

/** A view at version `v` with the month's free time spent up to `spent` of 60 half-days. */
function at(v: number, spent: number): PlayerView {
  return { ...engineView(), v, halfDays: { spent, free: 60 } };
}

/** An authority whose first reply spends the month and whose turn starts the next one at none spent. */
function authority(firstSpent: number, after?: (view: PlayerView) => PlayerView) {
  const sent: Command[] = [];
  let v = 1;
  return {
    sent,
    view: () => Promise.resolve(at(v, 0)),
    send(command: Command): Promise<Reply> {
      sent.push(command);
      v += 1;
      const spent = command.type === "turn/end" ? 0 : firstSpent;
      const view = at(v, spent);
      return Promise.resolve({ ok: true, view: after === undefined ? view : after(view), lines: [] });
    },
  };
}

const cook: Command = { type: "activity/now", activity: "activity.cook-at-home", param: null, basedOn: 0 };

describe("the month turns when it is lived", () => {
  test("[R-TURN-010] given the act that spends the month's last free time, when it is accepted, then the store ends the month by itself with the commitments and opens the results", async () => {
    const fake = authority(60);
    const store = createGameStore(fake);
    await store.getState().refresh();
    await store.getState().send(cook);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fake.sent.map((command) => command.type)).toEqual(["activity/now", "turn/end"]);
    expect(store.getState().reportOpen).toBe(true);
    expect(store.getState().view?.halfDays.spent).toBe(0);
  });

  test("[R-TURN-010] given an act that leaves free time, when it is accepted, then no month ends", async () => {
    const fake = authority(59);
    const store = createGameStore(fake);
    await store.getState().refresh();
    await store.getState().send(cook);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fake.sent.map((command) => command.type)).toEqual(["activity/now"]);
    expect(store.getState().reportOpen).toBe(false);
  });

  test("[R-TURN-010] [R-SETPIECE-002] given the month's time spent while a question waits, when the act is accepted, then the month does not end until the question is answered", async () => {
    const fake = authority(60, (view) => ({ ...view, interview: { ...(view.interview ?? { question: null }), question: { id: "q", words: "Why the UK?", options: [] } } as unknown as PlayerView["interview"] }));
    const store = createGameStore(fake);
    await store.getState().refresh();
    await store.getState().send(cook);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fake.sent.map((command) => command.type)).toEqual(["activity/now"]);
  });
});
