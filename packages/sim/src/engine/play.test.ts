import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

import { miniContent } from "../testing/miniContent";
import { legalCommands } from "../testing/legal";
import { start } from "../testing/play";
import { standInWorld } from "../world/standIn";
import { hashState, stableJson } from "./hash";
import { checkInvariants } from "./invariants";
import { replay } from "./replay";
import type { Id, State } from "./types";
import { hiddenPaths } from "./view";

const scenarios = Object.keys(miniContent.scenario) as Id<"scenario">[];
const STEPS = 60;

/** Plays `picks.length` random legal commands and returns the game. The authority grants a turn when the bank runs dry. */
function playRandomly(scenario: Id<"scenario">, seed: string, picks: readonly number[]) {
  const game = start({ scenario, seed });
  for (const pick of picks) {
    const view = game.view();
    const legal = legalCommands(view);
    if (legal.length === 0) {
      game.grant(1);
      continue;
    }
    const command = legal[pick % legal.length]!;
    game.accept(command);
  }
  return game;
}

describe("random play", () => {
  test.prop([fc.constantFrom(...scenarios), fc.string({ minLength: 1, maxLength: 8 }), fc.array(fc.nat(), { minLength: STEPS, maxLength: STEPS })], {
    numRuns: 25,
  })(
    "[engine:player-never-stuck] [engine:view-holds-no-hidden-field] [engine:state-is-plain-data] given any legal command from the view, when played, then it is accepted, the invariants hold, the view hides nothing and the state survives JSON",
    (scenario, seed, picks) => {
      const game = start({ scenario, seed });
      for (const pick of picks) {
        const view = game.view();
        const legal = legalCommands(view);
        // engine:player-never-stuck: with a turn banked and no set piece open there is always a legal move.
        if (view.turns.banked > 0 && view.setpiece === null) expect(legal.length).toBeGreaterThan(0);
        if (legal.length === 0) {
          game.grant(1);
          continue;
        }
        const command = legal[pick % legal.length]!;
        const result = game.send(command);
        if (!result.ok) throw new Error(`${command.type} from the legal list was rejected with ${result.code}: ${result.detail}`);
        expect(checkInvariants(game.state, miniContent)).toEqual([]);
        expect(hiddenPaths(game.view())).toEqual([]);
        expect(JSON.parse(JSON.stringify(game.state)) as State).toEqual(game.state);
      }
    },
  );

  test.prop([fc.constantFrom(...scenarios), fc.string({ minLength: 1, maxLength: 8 }), fc.array(fc.nat(), { minLength: 20, maxLength: 20 })], {
    numRuns: 15,
  })("[engine:same-inputs-same-result] [engine:state-is-plain-data] given a random life, when it is played twice and replayed from its save, then all three states are equal", (scenario, seed, picks) => {
    const a = playRandomly(scenario, seed, picks);
    const b = playRandomly(scenario, seed, picks);
    expect(stableJson(a.state)).toBe(stableJson(b.state));
    const rebuilt = replay(a.save, miniContent, (tick) => standInWorld("world-1", tick, miniContent));
    expect(hashState(rebuilt.state)).toBe(hashState(a.state));
    expect(rebuilt.state).toEqual(a.state);
  });
});
