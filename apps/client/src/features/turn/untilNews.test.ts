// Until news on the real engine and the real content (docs/rules/world.md R-WORLD-028): months in a
// row, each its own turn/end with last month's slots (R-TURN-003), told as one line each, stopping
// when something needs the player.
import { content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { createGameStore } from "../../authority/store";
import { decemberGame, engineView, fakeAuthority, gameAuthority, newGame } from "../../shared/testing/fixtures";
import { againSlots, RUN_LOW_BANK, RUN_MONTHS, stopsRun } from "./untilNews";

const TRANSCRIPT = "activity.get-transcript" as Id<"activity">;
const ISSUED = new Set(["line.document.issued", "line.document.issued-band"]);

/**
 * Tunde at work asks for his transcript, ends that month, then runs Until news. The seeds are lives
 * where the month after the request is quiet and the one after it is news (found by playing them).
 */
async function tundeRun(seed: string) {
  const game = newGame("scenario.tunde", seed);
  const authority = gameAuthority(game);
  const store = createGameStore(authority);
  await store.getState().refresh();
  expect(store.getState().addToPlan({ activity: TRANSCRIPT, param: null })).toBe(true);
  await store.getState().endMonth();
  store.getState().setReportOpen(false);
  const before = store.getState().view as PlayerView;
  await store.getState().untilNews();
  return { game, authority, store, before, after: store.getState().view as PlayerView };
}

describe("Until news", () => {
  test("[R-WORLD-028] [R-TURN-003] given a quiet month then a paper landing, when Until news runs, then each month is its own turn/end, the quiet month is kept as one, and the run stops on the month the paper lands", async () => {
    const { authority, store, before, after } = await tundeRun("seed-0");
    const ends = authority.sent.filter((command) => command.type === "turn/end");
    // The month asked for by hand, then two months of the run, each its own command spending one month (R-TURN-003).
    expect(ends).toHaveLength(3);
    expect(after.turns.banked).toBe(before.turns.banked - 2);
    expect(after.month).toBe(before.month + 2);
    // The paper is on its way, so the month after asks for it no more: last month's slots, as far as they are still open.
    expect(ends[1]).toMatchObject({ slots: againSlots(before) });
    expect(againSlots(before).some((pick) => pick.activity === TRANSCRIPT)).toBe(false);
    const { quiet, reportOpen, lines } = store.getState();
    expect(quiet).toHaveLength(1);
    expect(quiet[0]?.some((line) => ISSUED.has(line.key))).toBe(false);
    expect(lines.some((line) => ISSUED.has(line.key))).toBe(true);
    expect(stopsRun(after, lines, 2)).toContain("landed");
    expect(reportOpen).toBe(true);
  });

  test("[R-WORLD-028] given a quiet month then a month that asks for attention, when Until news runs, then it stops on that month", async () => {
    const { store, before, after } = await tundeRun("seed-11");
    const { quiet, lines } = store.getState();
    expect(quiet).toHaveLength(1);
    expect(quiet[0]?.some((line) => line.attention)).toBe(false);
    expect(before.turns.banked).toBeGreaterThan(RUN_LOW_BANK);
    expect(after.report?.attention).toBe(true);
    expect(stopsRun(after, lines, 2)).toContain("attention");
  });

  test(`[R-WORLD-028] [R-TURN-001] given the months to play down to ${String(RUN_LOW_BANK + 1)}, when Until news runs, then it stops once ${String(RUN_LOW_BANK)} are left`, async () => {
    const game = newGame("scenario.tunde", "seed-11");
    expect(game.view().turns.banked).toBe(content.tuning.turn.start);
    while (game.view().turns.banked > RUN_LOW_BANK + 1) game.endTurn();
    const store = createGameStore(gameAuthority(game));
    await store.getState().refresh();
    await store.getState().untilNews();
    const view = store.getState().view as PlayerView;
    expect(view.turns.banked).toBe(RUN_LOW_BANK);
    expect(store.getState().quiet).toEqual([]);
    expect(stopsRun(view, store.getState().lines, 1)).toContain("bank");
  });

  test(`[R-WORLD-028] given months that stay quiet, when Until news runs, then it stops after ${String(RUN_MONTHS)} months, the last told in full`, async () => {
    // The engine's own view of a working life, answered unchanged: nothing ever needs the player.
    const view = { ...engineView("scenario.tunde"), report: null };
    expect(stopsRun(view, [], 1)).toEqual([]);
    const authority = fakeAuthority(view);
    const store = createGameStore(authority);
    await store.getState().refresh();
    await store.getState().untilNews();
    expect(authority.sent.filter((command) => command.type === "turn/end")).toHaveLength(RUN_MONTHS);
    expect(store.getState().quiet).toHaveLength(RUN_MONTHS - 1);
    expect(store.getState().reportOpen).toBe(true);
  });

  test("[R-WORLD-028] given the December visit open abroad, then the run stops for it", () => {
    const view = decemberGame().view();
    expect(view.setpiece).not.toBeNull();
    expect(stopsRun(view, [], 1)).toContain("ask");
  });

  test("[R-WORLD-028] given a run, then the month kept on the device follows it to the month that stopped it", async () => {
    const game = newGame("scenario.tunde", "seed-0");
    const store = createGameStore(gameAuthority(game), { rememberMonth: true });
    await store.getState().refresh();
    await store.getState().untilNews();
    const kept = JSON.parse(localStorage.getItem("japacity.month") ?? "null") as { v: number } | null;
    expect(kept?.v).toBe(store.getState().view?.v);
  });
});
