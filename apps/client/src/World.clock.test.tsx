// The months held and their countdown are retired from the client (docs/rules/clock.md R-CLOCK-007, to be amended by the
// lead): the month turns when it is lived (decision 0034), so the old card that showed "3 of 4 months to play" and the
// time to the next one went with the old month page's last pieces. The server's clock stays; nothing a player
// reads counts the months held or the time to the next, online or off. Replaces the card's own tests (TurnClock.test).
import { worldClockAt } from "@japacity/sim";
import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { GameProvider } from "./authority/GameProvider";
import { createGameStore } from "./authority/store";
import { Calendar } from "./features/turn/Calendar";
import { PhoneApps } from "./features/phone/PhoneApps";
import { engineView } from "./shared/testing/fixtures";
import "./shared/testing/render";

const NOW = 5_000_000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the months held, retired", () => {
  test("[R-CLOCK-007] given the server's clock with a month due soon, then neither the phone's home, its Calendar nor any app shows the months held or a countdown to the next", async () => {
    const view = engineView();
    const store = createGameStore({ view: () => Promise.resolve(view), send: () => Promise.reject(new Error("unused")) });
    await store.getState().refresh();
    store.getState().heard({ kind: "clock", clock: { tick: 1, nextTickAt: NOW + 1, nextTurnAt: NOW + 90 * 60_000, morningAt: 0, world: worldClockAt(0) } });
    render(
      <GameProvider store={store}>
        <PhoneApps onClose={() => undefined} area="Ojuelegba" now={() => new Date(2026, 9, 8, 12, 5)} talk={null} calendar={() => <Calendar />} />
      </GameProvider>,
    );
    // The retired card's words: "3 of 4 months to play", "Next month to play in 1 h 30 min", "A month is on its way."
    const unheld = (where: string) => {
      expect({ where, held: /months? to play|a month is on its way/i.test(document.body.textContent) }).toEqual({ where, held: false });
      expect({ where, card: document.querySelector("[data-months-held], [data-turn-clock]") }).toEqual({ where, card: null });
    };
    unheld("home");
    const apps = Array.from(document.querySelectorAll<HTMLElement>("[data-app]")).map((tile) => tile.getAttribute("data-app") ?? "");
    expect(apps.length).toBeGreaterThanOrEqual(10);
    for (const app of apps) {
      fireEvent.click(document.querySelector<HTMLElement>(`[data-app="${app}"]`)!);
      await act(() => vi.advanceTimersByTimeAsync(10));
      unheld(app);
      const back = document.querySelector<HTMLElement>("[data-phone-back]");
      if (back !== null) fireEvent.click(back);
    }
  });
});
