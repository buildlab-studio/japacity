// The real content through the engine. Kind rule tests play the real data
// too; this file only proves the content loads and every starting life runs.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { checkContent } from "../engine/content";
import { checkInvariants } from "../engine/invariants";
import { newState } from "../engine/state";
import type { Id } from "../engine/types";
import { hiddenPaths } from "../engine/view";
import { legalCommands } from "../testing/legal";
import { start } from "../testing/play";

const lives = Object.keys(content.scenario) as Id<"scenario">[];

describe("the real content", () => {
  test("[R-ENGINE-014] given the real content, when checked, then nothing is wrong", () => {
    expect(content.version).toBe("m0.1");
    expect(checkContent(content)).toEqual([]);
  });

  test("[R-SCENARIO-001] given the four lives, when states are built from them, then every invariant holds", () => {
    expect(lives).toHaveLength(4);
    for (const life of lives) expect(checkInvariants(newState(life, "seed", content), content)).toEqual([]);
  });

  test.each(lives)("[R-SCENARIO-003] [R-ENGINE-011] given %s, when twelve months are played from the legal list, then every command is accepted and the view hides nothing", (life) => {
    const game = start({ scenario: life, content });
    for (let month = 0; month < 12; month += 1) {
      const legal = legalCommands(game.view());
      expect(legal.length).toBeGreaterThan(0);
      const turn = legal.find((command) => command.type === "turn/end" && command.slots.length > 0) ?? legal[0]!;
      game.accept(turn);
      expect(checkInvariants(game.state, content)).toEqual([]);
      expect(hiddenPaths(game.view())).toEqual([]);
    }
    expect(game.state.turn.month).toBe(12);
    expect(game.state.turn.banked).toBe(content.tuning.turn.start - 12);
  });
});
