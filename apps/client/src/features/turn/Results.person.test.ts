// A bond that ended, on the results (docs/rules/people.md R-PEOPLE-042, R-PEOPLE-035; world.md R-WORLD-008): a thread
// that ends, as Tobi's when nobody makes time, is told on the results and not left to News alone. Real content, a real
// life played through the engine.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { courted, peopleGame, playMonth, TOBI } from "../../shared/testing/person";
import { nameOf, words } from "../../shared/words/text";
import { BOND_ENDED, storyLines } from "./month.results";

describe("a bond that ended, on the results", () => {
  test("[R-PEOPLE-042] [R-WORLD-008] given Tobi courted and no time made together, when his patience runs out, then the month's results tell that he stopped waiting, in that month and by name", () => {
    const game = peopleGame();
    const bond = courted(game, TOBI);
    const patience = content.person[TOBI]?.behaviour.patienceMonths ?? 0;
    expect(patience).toBeGreaterThan(0);
    for (let month = 1; month < patience; month += 1) {
      playMonth(game);
      expect(game.state.people.bonds[bond]?.stage).toBe("courting");
      expect(storyLines(game.view().report?.lines ?? []).filter((line) => BOND_ENDED.has(line.key))).toEqual([]);
    }
    playMonth(game);
    expect(game.state.people.bonds[bond]?.stage).toBe("ended");
    expect(game.state.people.bonds[bond]?.ended?.by).toBe("drift");
    const told = storyLines(game.view().report?.lines ?? []).filter((line) => BOND_ENDED.has(line.key));
    expect(told.map((line) => line.key)).toEqual(["line.people.drifted"]);
    expect(words(told[0]!.key, told[0]!.params)).toContain(nameOf(TOBI));
  });

  test("[R-PEOPLE-035] [R-WORLD-008] given Tobi courted, when the player ends it, then the line that says so is among the month's story, not left for News", () => {
    const game = peopleGame();
    const bond = courted(game, TOBI);
    const ended = game.accept({ type: "people/end", bond });
    expect(storyLines(ended.lines).map((line) => line.key)).toContain("line.people.ended");
  });
});
