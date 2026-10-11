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

  test("[R-QUALITY-007] given a hungry and spent life, when the month turns, then wellbeing pays for both and the body rests back toward sixty", () => {
    const game = ngozi();
    const { body } = content.tuning.turn;
    // Nollywood until the belly is low (the time lived takes it down), then water, which tires, until the body is spent:
    // an act that takes effort then waits for sleep (R-ACTIVITY-020).
    while ((game.state.quality[BELLY] ?? 0) >= body.lowBelow) game.accept({ type: "activity/now", activity: "activity.watch-tv", param: null });
    while ((game.state.quality[ENERGY] ?? 0) >= body.spentBelow) game.accept({ type: "activity/now", activity: "activity.fetch-water", param: null });
    game.expectRejected({ type: "activity/now", activity: "activity.fetch-water", param: null }, "not-legal");
    const belly = game.state.quality[BELLY]!;
    const energy = game.state.quality[ENERGY]!;
    expect(belly).toBeLessThan(body.lowBelow);
    expect(energy).toBeLessThan(body.lowBelow);
    const turned = game.endTurn();
    const energyMoves = turned.events.filter((event) => event.type === "quality/changed" && (event as { quality?: string }).quality === ENERGY);
    expect(energyMoves, JSON.stringify(energyMoves)).toHaveLength(1);
    expect(game.state.quality[BELLY]).toBe(Math.min(body.restTo, belly + body.restBy));
    expect(game.state.quality[ENERGY]).toBe(Math.min(body.restTo, energy + body.restBy));
    // The two hits land on wellbeing with the month's own source, beside its drift.
    const hits = turned.events
      .filter((event) => event.type === "quality/changed" && (event as { quality?: string }).quality === WELLBEING && (event as { source?: string }).source === "month")
      .map((event) => (event as { amount: number }).amount);
    expect(hits).toContain(-body.hungryWellbeing);
    expect(hits).toContain(-body.spentWellbeing);
  });
});
