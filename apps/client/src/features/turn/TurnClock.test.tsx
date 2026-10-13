import type { PlayerView } from "@japacity/sim";
import { worldClockAt } from "@japacity/sim";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import { engineView } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { deferred } from "../../shared/testing/server";
import { say } from "../../shared/words/text";
import { MonthsHeld, waitWords } from "./TurnClock";

const NOW = 5_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const banked = (view: PlayerView) => say("ui.month.banked", { banked: view.turns.banked, cap: view.turns.cap });

// Moved from the old month page's bar to the months held and the countdown on their own: the world has no place for them
// yet (TurnClock.tsx says why), so the rule is held against the card itself.
describe("the months held and the countdown", () => {
  test("[R-CLOCK-007] given the next turn 90 minutes away, then the card counts down to it", async () => {
    const view = engineView();
    const store = createGameStore({ view: () => Promise.resolve(view), send: () => Promise.reject(new Error("unused")) });
    await store.getState().refresh();
    store.getState().heard({ kind: "clock", clock: { tick: 1, nextTickAt: NOW + 1, nextTurnAt: NOW + 90 * 60_000, morningAt: 0, world: worldClockAt(0) } });
    render(
      <GameProvider store={store}>
        <MonthsHeld />
      </GameProvider>,
    );
    expect(screen.getByText(say("ui.clock.next", { wait: waitWords(90 * 60_000) }))).toBeDefined();
    expect(waitWords(90 * 60_000)).toBe(say("ui.clock.hours", { hours: 1, minutes: "30" }));
    expect(waitWords(59_999)).toBe(say("ui.clock.under-minute"));
  });

  test("[R-CLOCK-007] given the countdown reaches zero, then the view is fetched and the bank shown stays the same until the fetch answers", async () => {
    const before = engineView();
    const after: PlayerView = { ...before, v: before.v + 1, turns: { ...before.turns, banked: before.turns.banked + 1 } };
    const answer = deferred<PlayerView>();
    let fetches = 0;
    const store = createGameStore({
      view: () => (fetches++ === 0 ? Promise.resolve(before) : answer.promise),
      send: () => Promise.reject(new Error("unused")),
    });
    await store.getState().refresh();
    store.getState().heard({ kind: "clock", clock: { tick: 1, nextTickAt: NOW + 10_000_000, nextTurnAt: NOW + 3_000, morningAt: 0, world: worldClockAt(0) } });
    render(
      <GameProvider store={store}>
        <MonthsHeld />
      </GameProvider>,
    );
    await act(() => vi.advanceTimersByTimeAsync(2_999));
    expect(fetches).toBe(1);
    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(fetches).toBe(2);
    expect(screen.getByText(banked(before))).toBeDefined();
    expect(screen.getByText(say("ui.clock.arriving"))).toBeDefined();
    await act(async () => {
      answer.resolve(after);
      await answer.promise;
    });
    expect(screen.getByText(banked(after))).toBeDefined();
  });

  test("[R-CLOCK-007] given a full bank, then no countdown runs and the card says so; offline there is no clock at all", async () => {
    const view = engineView();
    const store = createGameStore({ view: () => Promise.resolve(view), send: () => Promise.reject(new Error("unused")) });
    await store.getState().refresh();
    const { unmount } = render(
      <GameProvider store={store}>
        <MonthsHeld />
      </GameProvider>,
    );
    expect(document.querySelector("[data-turn-clock]")).toBeNull();
    unmount();
    store.getState().heard({ kind: "clock", clock: { tick: 1, nextTickAt: NOW + 1, nextTurnAt: null, morningAt: 0, world: worldClockAt(0) } });
    render(
      <GameProvider store={store}>
        <MonthsHeld />
      </GameProvider>,
    );
    expect(screen.getByText(say("ui.clock.full"))).toBeDefined();
  });
});
