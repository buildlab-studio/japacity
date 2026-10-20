import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Game } from "../testing/play";
import { start } from "../testing/play";

const ENERGY = "quality.energy";
const WATER = "activity.fetch-water";
const GIST = "activity.family-time";
const LOTTO = "activity.play-lotto";

function nurse(): Game {
  return start({ content, scenario: "scenario.nurse" });
}

describe("a spent body", () => {
  test("[activity:spent-body-refuses-acts] given energy under the line, when an act that takes effort is sent, then it is refused and the view says it waits for sleep, while a free act and a purchase stay open", () => {
    const game = nurse();
    const { spentBelow } = content.tuning.turn.body;
    // Water tires: trips until the body is under the line.
    while ((game.state.quality[ENERGY] ?? 0) >= spentBelow) game.accept({ type: "activity/now", activity: WATER, param: null });
    expect(game.state.quality[ENERGY]).toBeLessThan(spentBelow);
    game.expectRejected({ type: "activity/now", activity: WATER, param: null }, "not-legal");
    const options = game.view().activities;
    expect(options.find((option) => option.id === WATER)).toMatchObject({ allowed: false, spent: true });
    expect(options.find((option) => option.id === GIST)?.spent).toBeUndefined();
    expect(options.find((option) => option.id === LOTTO)?.spent).toBeUndefined();
  });

  test("[activity:spent-body-refuses-acts] [quality:body-belly-and-energy] given a spent body, when the life sleeps, then the energy rests back and the act is open again", () => {
    const game = nurse();
    while ((game.state.quality[ENERGY] ?? 0) >= content.tuning.turn.body.spentBelow) game.accept({ type: "activity/now", activity: WATER, param: null });
    game.endTurn();
    expect(game.state.quality[ENERGY]).toBeGreaterThanOrEqual(content.tuning.turn.body.spentBelow);
    game.accept({ type: "activity/now", activity: WATER, param: null });
  });
});
