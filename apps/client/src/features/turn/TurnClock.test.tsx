import type { PlayerView } from "@japacity/sim";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import { engineView } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { deferred } from "../../shared/testing/server";
import { say } from "../../shared/words/text";
import { TurnBar } from "./TurnBar";
import { waitWords } from "./TurnClock";

const NOW = 5_000_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const banked = (view: PlayerView) => say("ui.month.banked", { banked: view.turns.banked, cap: view.turns.cap });

describe("the clock on the turn bar", () => {
  test("[R-CLOCK-007] given the next turn 90 minutes away, then the bar counts down to it", async () => {
    const view = engineView();
    const store = createGameStore({ view: () => Promise.resolve(view), send: () => Promise.reject(new Error("unused")) });
    await store.getState().refresh();
    store.getState().heard({ kind: "clock", clock: { tick: 1, nextTickAt: NOW + 1, nextTurnAt: NOW + 90 * 60_000 } });
    render(
      <GameProvider store={store}>
        <TurnBar />
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
    store.getState().heard({ kind: "clock", clock: { tick: 1, nextTickAt: NOW + 10_000_000, nextTurnAt: NOW + 3_000 } });
    render(
      <GameProvider store={store}>
        <TurnBar />
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

  test("[R-CLOCK-007] given a full bank, then no countdown runs and the bar says so; offline there is no clock at all", async () => {
    const view = engineView();
    const store = createGameStore({ view: () => Promise.resolve(view), send: () => Promise.reject(new Error("unused")) });
    await store.getState().refresh();
    const { unmount } = render(
      <GameProvider store={store}>
        <TurnBar />
      </GameProvider>,
    );
    expect(document.querySelector("[data-turn-clock]")).toBeNull();
    unmount();
    store.getState().heard({ kind: "clock", clock: { tick: 1, nextTickAt: NOW + 1, nextTurnAt: null } });
    render(
      <GameProvider store={store}>
        <TurnBar />
      </GameProvider>,
    );
    expect(screen.getByText(say("ui.clock.full"))).toBeDefined();
  });
});
