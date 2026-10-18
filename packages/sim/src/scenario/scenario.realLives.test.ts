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
import { finishPrologue, start } from "../testing/play";

const lives = Object.keys(content.scenario) as Id<"scenario">[];

describe("the real content", () => {
  test("[engine:content-checked-before-play] given the real content, when checked, then nothing is wrong", () => {
    expect(content.version).toBe("1");
    expect(checkContent(content)).toEqual([]);
  });

  test("[scenario:state-built-from-scenario] given the six lives, when states are built from them, then every invariant holds", () => {
    expect(lives).toHaveLength(6);
    for (const life of lives) expect(checkInvariants(newState(life, "seed", content), content)).toEqual([]);
  });

  test.each(lives)("[scenario:first-turn-always-endable] [engine:player-never-stuck] given %s, when twelve months are played from the legal list, then every command is accepted and the view hides nothing", (life) => {
    const game = start({ scenario: life, content });
    finishPrologue(game);
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

  test.each(lives)("[scenario:first-turn-always-endable] [engine:player-never-stuck] given %s, when 40 months are played with every slot resting, then each turn is accepted and every invariant holds", (life) => {
    const game = start({ scenario: life, content });
    finishPrologue(game);
    for (let month = 0; month < 40; month += 1) {
      if (game.state.turn.banked === 0) game.grant(1);
      expect(game.state.setpiece.open).toBeNull();
      game.endTurn([]);
      expect(checkInvariants(game.state, content)).toEqual([]);
    }
    expect(game.state.turn.month).toBe(40);
  });
});
