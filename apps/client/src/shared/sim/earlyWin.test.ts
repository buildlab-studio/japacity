import { content } from "@japacity/content";
import type { ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { localAuthority } from "../../authority/local";
import { createGameStore } from "../../authority/store";
import { engineView } from "../testing/fixtures";
import { chapterNextStep } from "../testing/firstSession";
import { actOnCard } from "../words/acts";

const salary: ReportLine = { key: "line.activity.salary", params: {}, tone: "good", attention: false, counts: [] };
const gain: ReportLine = { key: "line.quality.gain", params: {}, tone: "good", attention: false, counts: [] };

describe("asks wait for the early win", () => {
  test("[R-GUIDE-015] given a new life, when the store first holds its view, then the early win has not shown", async () => {
    const store = createGameStore({ view: () => Promise.resolve(engineView("scenario.ada")), send: () => Promise.reject(new Error("unused")) });
    await store.getState().refresh();
    expect(store.getState().view?.chapter.done).toEqual([]);
    expect(store.getState().earlyWin).toBe(false);
  });

  test("[R-GUIDE-015] given a month whose report holds no early win, when it ends, then the flag stays down; given one that does, then it goes up and stays", async () => {
    const view = engineView("scenario.ada");
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

  test("[R-GUIDE-015] given a new life played through the local authority as the next step suggests, when months end, then the flag goes up with the first early win", async () => {
    const authority = localAuthority({ fastClock: true, storage: null, scenario: "scenario.ada", makeSeed: () => "first-session", now: () => 0 });
    const store = createGameStore(authority);
    await store.getState().refresh();
    let raisedAt: number | null = null;
    for (let month = 1; month <= 3 && raisedAt === null; month += 1) {
      const view = store.getState().view!;
      // R-ACTIVITY-015: a step that answers now (the hunt, the official page) is sent at once, and its win
      // can come with it, before the month ends; the rest fill slots.
      expect(store.getState().earlyWin).toBe(false);
      for (const pick of chapterNextStep(view, content)) await actOnCard(pick, store.getState());
      await store.getState().endMonth();
      if (store.getState().earlyWin) raisedAt = month;
    }
    expect(raisedAt).not.toBeNull();
  });
});
