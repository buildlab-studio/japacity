import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Game } from "../testing/play";
import { start } from "../testing/play";

const BELLY = "quality.belly";
const ENERGY = "quality.energy";
const WELLBEING = "quality.wellbeing";
const COOK = "activity.cook-at-home";
const NAP = "activity.nap";

function ngozi(): Game {
  return start({ content, scenario: "scenario.ngozi" });
}

describe("the body", () => {
  test("[R-QUALITY-007] given a new life, when its body is read, then the belly and the energy start where the scenario says, hidden from the profile and said in words only", () => {
    const game = ngozi();
    expect(game.state.quality[BELLY]).toBe(60);
    expect(game.state.quality[ENERGY]).toBe(70);
    expect(content.quality[BELLY]).toMatchObject({ shown: false, start: 60 });
    expect(content.quality[ENERGY]).toMatchObject({ shown: false, start: 70 });
  });

  test("[R-QUALITY-007] [R-ACTIVITY-019] given a meal and a nap, when each is done now, then the belly and the energy move at once, less the time the act takes", () => {
    const game = ngozi();
    const { body } = content.tuning.turn;
    const meal = content.activity[COOK]!;
    game.accept({ type: "activity/now", activity: COOK, param: null });
    expect(game.state.quality[BELLY]).toBe(60 + 25 - body.bellyPerHalfDay * (meal.halfDays ?? 1));
    const energyBefore = game.state.quality[ENERGY]!;
    game.accept({ type: "activity/now", activity: NAP, param: null });
    expect(game.state.quality[ENERGY]).toBe(Math.min(100, energyBefore + 20 - body.energyPerHalfDay * (content.activity[NAP]!.halfDays ?? 1)));
    // Again, the same month: a repeat act runs as often as the time allows.
    game.accept({ type: "activity/now", activity: COOK, param: null });
    expect(game.state.activity.played[COOK]).toBe(2);
  });

  test("[R-QUALITY-007] given a hungry and spent life, when the month turns, then wellbeing pays for both against a fed twin, and the body rests back toward sixty", () => {
    const game = ngozi();
    const twin = ngozi();
    const { body } = content.tuning.turn;
    // The month's time on water, which fills nothing and tires: the belly and the energy fall below the line.
    for (let i = 0; i < 20; i += 1) game.accept({ type: "activity/now", activity: "activity.fetch-water", param: null });
    const belly = game.state.quality[BELLY]!;
    const energy = game.state.quality[ENERGY]!;
    expect(belly).toBeLessThan(body.lowBelow);
    expect(energy).toBeLessThan(body.lowBelow);
    game.endTurn();
    twin.endTurn();
    expect(game.state.quality[BELLY]).toBe(Math.min(body.restTo, belly + body.restBy));
    expect(game.state.quality[ENERGY]).toBe(Math.min(body.restTo, energy + body.restBy));
    expect(game.state.quality[WELLBEING]).toBe(twin.state.quality[WELLBEING]! - body.hungryWellbeing - body.spentWellbeing);
  });
});
