// Layer 3 of docs/design/02-quality-and-testing.md abroad on a status that
// settles: each careful recording replayed to its flight on the sponsor or
// talent route, then long random play from there, through renewals, rent,
// the car, remittances and the return, every always-true rule checked after every command.
import { content } from "@japacity/content";
import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

import { lifeSaves } from "../goldens/lives.data";
import type { StrategyName } from "./players";
import type { Walk } from "./random-play";
import { atFlight, COMMANDS, play, SEEDS_PER_LIFE, unexplained } from "./random-play";

/** The second recording of each life: a careful player who flew a route that settles. */
const FLOWN = Object.keys(lifeSaves).filter((name) => name.endsWith("-abroad"));
const NAMES: StrategyName[] = ["careful", "borrower", "risky"];
const RULES = "[R-ENGINE-001] [R-ENGINE-007] [R-ENGINE-010] [R-ENGINE-011] [R-WALLET-002] [R-QUALITY-001] [R-PLACE-004]";

describe("random play abroad on a status that settles", () => {
  for (const name of FLOWN) {
    test.prop([fc.array(fc.nat(), { minLength: COMMANDS, maxLength: COMMANDS })], { numRuns: SEEDS_PER_LIFE, endOnFailure: true })(
      `${RULES} given ${name} at its flight, when ${String(COMMANDS)} random legal commands are played abroad, then each is accepted and after each the invariants hold, the view is whole and hides nothing, the books balance, every quality is in range, the state is plain data and the save replays`,
      (picks) => {
        const walk: Walk = { places: new Set(), types: new Set() };
        expect(unexplained(play(atFlight(name, content), picks, walk))).toBeNull();
      },
    );
    test.prop([fc.array(fc.nat(), { minLength: COMMANDS, maxLength: COMMANDS })], { numRuns: SEEDS_PER_LIFE, endOnFailure: true })(
      `${RULES} given ${name} at its flight, when ${String(COMMANDS)} commands mixing random legal ones with a simulated player's choices are played abroad, then after each the same rules hold`,
      (picks) => {
        const walk: Walk = { places: new Set(), types: new Set() };
        const strategy = NAMES[(picks[0] ?? 0) % NAMES.length]!;
        expect(unexplained(play(atFlight(name, content), picks, walk, strategy))).toBeNull();
      },
    );
  }
});
