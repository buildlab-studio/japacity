import { content } from "@japacity/content";
import type { ClockView } from "@japacity/api";
import { type ReportLine, worldClockAt } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { localAuthority } from "./local";
import { createGameStore } from "./store";
import { engineView } from "../shared/testing/fixtures";
import { chapterNextStep } from "../shared/testing/firstSession";
import { actOnCard } from "../shared/words/acts";

const salary: ReportLine = { key: "line.activity.salary", params: {}, tone: "good", attention: false, counts: [] };
const gain: ReportLine = { key: "line.quality.gain", params: {}, tone: "good", attention: false, counts: [] };
const heard: ReportLine = { key: "line.route.heard", params: {}, tone: "good", attention: false, counts: [] };
const ledgerPay: ReportLine = { key: "line.wallet.salary", params: {}, tone: "good", attention: false, counts: [] };

describe("asks wait for the early win", () => {
  test("[guide:nothing-asked-before-early-win] given a new life, when the store first holds its view, then the early win has not shown", async () => {
    const store = createGameStore({ view: () => Promise.resolve(engineView("scenario.graduate")), send: () => Promise.reject(new Error("unused")) });
    await store.getState().refresh();
    expect(store.getState().view?.chapter.done).toEqual([]);
    expect(store.getState().earlyWin).toBe(false);
  });

  test("[guide:nothing-asked-before-early-win] given a month whose report holds no early win, when it ends, then the flag stays down; given one that does, then it goes up and stays", async () => {
    const view = engineView("scenario.graduate");
    const replies = [[gain], [salary], [gain]];
    let month = 0;
    const store = createGameStore({
      view: () => Promise.resolve(view),
      send: () => Promise.resolve({ ok: true, view: { ...view, v: view.v + month + 1 }, lines: replies[month++] ?? [] }),
    });
    await store.getState().refresh();
    await store.getState().endMonth();
    expect(store.getState().earlyWin).toBe(false);
    await store.getState().endMonth();
    expect(store.getState().earlyWin).toBe(true);
    await store.getState().endMonth();
    expect(store.getState().earlyWin).toBe(true);
  });

  test("[guide:nothing-asked-before-early-win] [guide:early-win-in-three-turns] given the prologue's preset whose lines hear of a route, when its reply lands, then the flag goes up, its picks being unknown", async () => {
    const view = engineView("scenario.graduate");
    const clock: ClockView = { tick: 1, nextTickAt: 1_000_000, nextTurnAt: 500_000, morningAt: 0, world: worldClockAt(0) };
    const store = createGameStore({
      view: () => Promise.resolve(view),
      send: () => Promise.reject(new Error("unused")),
      preset: () => Promise.resolve({ ok: true, view: { ...view, v: view.v + 1 }, lines: [heard], clock, stepped: 1, trail: [] }),
    });
    await store.getState().refresh();
    await store.getState().preset?.({ archetype: "archetype.graduate", age: 24, home: "place.family-house" });
    expect(store.getState().earlyWin).toBe(true);
  });

  test("[guide:nothing-asked-before-early-win] [guide:early-win-in-three-turns] given a command that is not a month or a now-act whose lines hold a route heard, or the ledger's pay line, when it lands, then the flag goes up", async () => {
    const view = engineView("scenario.graduate");
    for (const lines of [[heard], [ledgerPay]]) {
      const store = createGameStore({
        view: () => Promise.resolve(view),
        send: () => Promise.resolve({ ok: true, view: { ...view, v: view.v + 1 }, lines }),
      });
      await store.getState().refresh();
      await store.getState().send({ type: "wallet/move", currency: "NGN", amount: 1, to: "cash" });
      expect(store.getState().earlyWin).toBe(true);
    }
  });

  test("[guide:nothing-asked-before-early-win] given a new life played through the local authority as the next step suggests, when months end, then the flag goes up with the first early win", async () => {
    const authority = localAuthority({ fastClock: true, storage: null, scenario: "scenario.graduate", makeSeed: () => "first-session", now: () => 0 });
    const store = createGameStore(authority);
    await store.getState().refresh();
    let raisedAt: number | null = null;
    for (let month = 1; month <= 3 && raisedAt === null; month += 1) {
      const view = store.getState().view!;
      // activity:now-acts-and-month-acts: a step that answers now (the hunt, the official page) is sent at once, and its win
      // can come with it, before the month ends; the rest fill slots.
      expect(store.getState().earlyWin).toBe(false);
      for (const pick of chapterNextStep(view, content)) await actOnCard(pick, store.getState());
      await store.getState().endMonth();
      if (store.getState().earlyWin) raisedAt = month;
    }
    expect(raisedAt).not.toBeNull();
  });
});
