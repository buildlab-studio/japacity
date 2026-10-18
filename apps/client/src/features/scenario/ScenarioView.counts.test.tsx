// The front door's screens as the funnel counts them (analytics.md R-ANALYTICS-002, R-ANALYTICS-008):
// the first door, the second and the page, each once each time it opens, as `screen/opened` rows.
import type { CounterRow } from "@japacity/api";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority } from "../../authority/local";
import { createGameStore } from "../../authority/store";
import { makeCounters } from "../../shared/analytics/counters";
import { countInto } from "../../shared/analytics/start";
import { DOOR_STAGES } from "../../shared/datapage/door";
import { say } from "../../shared/words/text";
import { doorScreen, ScenarioView } from "./ScenarioView";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

let stop: () => void = () => undefined;

afterEach(() => {
  stop();
  localStorage.clear();
});

/** The door, counting into memory; `rows()` sends what was counted and answers it. */
function countedDoor(): { rows: () => CounterRow[] } {
  const sent: CounterRow[] = [];
  const counters = makeCounters({ send: (body) => sent.push(...(JSON.parse(body) as { rows: CounterRow[] }).rows) });
  stop = countInto(counters);
  const authority = localAuthority({ fastClock: true, storage: null, makeSeed: () => "count-seed", now: () => 0 });
  const store = createGameStore(authority, { life: authority, lifeAgain: true, choosingLife: true });
  render(
    <GameProvider store={store}>
      <ScenarioView />
    </GameProvider>,
  );
  return {
    rows: () => {
      counters.flush();
      return sent.filter((row) => row.name === "screen/opened");
    },
  };
}

const next = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}`) });

describe("the front door's screens counted", () => {
  test("[R-ANALYTICS-002] [R-ANALYTICS-008] given every stage of the door, when it is named as a screen, then you is the first door, the tiles and the ready lives the second, the page the page, and begun none", () => {
    expect(DOOR_STAGES.map((stage) => [stage, doorScreen(stage)])).toEqual([
      ["you", "door-1"],
      ["life", "door-2"],
      ["ready", "door-2"],
      ["page", "page"],
      ["begun", null],
    ]);
  });

  test("[R-ANALYTICS-002] [R-ANALYTICS-008] given a new player who goes Next, Next, then back to the tiles and on to the page again, when the counters are sent, then each door and the page are counted each time they opened", () => {
    const door = countedDoor();
    fireEvent.click(next(say("ui.door.next")));
    fireEvent.click(next(say("ui.door.next")));
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
    fireEvent.click(next(say("ui.door.next")));

    expect(door.rows()).toEqual([
      { name: "screen/opened", key: "door-1", count: 1 },
      { name: "screen/opened", key: "door-2", count: 2 },
      { name: "screen/opened", key: "page", count: 2 },
    ]);
  });
});
