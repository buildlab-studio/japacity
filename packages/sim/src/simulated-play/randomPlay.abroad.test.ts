// Layer 3 of docs/design/02-quality-and-testing.md abroad: each recorded life
// replayed to its flight, then long random play from there, through status
// lapses, rent, remittances, the December scene and the return, every
// always-true rule checked after every command.
import { content } from "@japacity/content";
import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

import { lifeSaves } from "../goldens/lives.data";
import type { StrategyName } from "./players";
import type { Walk } from "./randomPlay";
import { atFlight, COMMANDS, play, SEEDS_PER_LIFE, unexplained } from "./randomPlay";

/** The first recording of each life, which flies the study route; the second has a file of its own. */
const FLOWN = Object.keys(lifeSaves).filter((name) => !name.endsWith("-abroad"));
const NAMES: StrategyName[] = ["careful", "borrower", "risky"];
const RULES = "[engine:same-inputs-same-result] [engine:view-holds-no-hidden-field] [engine:state-is-plain-data] [engine:player-never-stuck] [wallet:ledger-balances-each-currency] [quality:qualities-stay-in-range] [place:return-home-paid-or-assisted]";

describe("random play abroad", () => {
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
