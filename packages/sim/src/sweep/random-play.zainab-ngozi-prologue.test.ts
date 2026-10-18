// Layer 3 of docs/design/02-quality-and-testing.md on the real content: long
// random lives from Zainab, Ngozi and the prologue, every always-true rule checked after every
// command. Ada, Tunde and life abroad have files of their own, so each
// file stays inside R-ENGINE-016's minute.
import { content } from "@japacity/content";
import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

import type { Id } from "../engine/types";
import { start } from "../testing/play";
import type { StrategyName } from "./players";
import type { Walk } from "./random-play";
import { COMMANDS, play, SEEDS_PER_LIFE, unexplained } from "./random-play";

const LIVES: Id<"scenario">[] = ["scenario.zainab", "scenario.ngozi", "scenario.prologue"];
const NAMES: StrategyName[] = ["careful", "borrower", "risky", "honest-home"];
const RULES = "[R-ENGINE-001] [R-ENGINE-007] [R-ENGINE-010] [R-ENGINE-011] [R-WALLET-002] [R-QUALITY-001]";

describe("random play on the real lives", () => {
  for (const life of LIVES) {
    test.prop([fc.string({ minLength: 1, maxLength: 10 }), fc.array(fc.nat(), { minLength: COMMANDS, maxLength: COMMANDS })], { numRuns: SEEDS_PER_LIFE, endOnFailure: true })(
      `${RULES} given ${life}, when ${String(COMMANDS)} random legal commands are played, then each is accepted and after each the invariants hold, the view is whole and hides nothing, the books balance, every quality is in range, the state is plain data and the save replays`,
      (seed, picks) => {
        const walk: Walk = { places: new Set(), types: new Set() };
        expect(unexplained(play(start({ scenario: life, seed, content }), picks, walk))).toBeNull();
      },
    );
    test.prop([fc.string({ minLength: 1, maxLength: 10 }), fc.array(fc.nat(), { minLength: COMMANDS, maxLength: COMMANDS })], { numRuns: SEEDS_PER_LIFE, endOnFailure: true })(
      `${RULES} given ${life}, when ${String(COMMANDS)} commands mixing random legal ones with a simulated player's choices carry the life through the flight and abroad, then after each the same rules hold`,
      (seed, picks) => {
        const walk: Walk = { places: new Set(), types: new Set() };
        const name = NAMES[(picks[0] ?? 0) % NAMES.length]!;
        expect(unexplained(play(start({ scenario: life, seed, content }), picks, walk, name))).toBeNull();
      },
    );
  }
});
