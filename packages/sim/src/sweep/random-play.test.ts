// Layer 3 of docs/design/02-quality-and-testing.md on the real content: long
// random lives from each of the three starting lives, every always-true rule
// checked after every command.
import { content } from "@japacity/content";
import { fc, test } from "@fast-check/vitest";
import { describe, expect } from "vitest";

import { hashState } from "../engine/hash";
import { checkInvariants } from "../engine/invariants";
import { replay } from "../engine/replay";
import type { Currency, Id, PlayerView, State } from "../engine/types";
import { hiddenPaths, VIEW_KEYS } from "../engine/view";
import { legalCommands } from "../testing/legal";
import type { Game } from "../testing/play";
import { finishPrologue, start } from "../testing/play";
import { standInWorld } from "../world/standIn";
import type { StrategyName } from "./players";
import { strategies } from "./players";

const LIVES = Object.keys(content.scenario) as Id<"scenario">[];
const COMMANDS = 200;
const SEEDS_PER_LIFE = 40;

/** R-WALLET-002: per currency, what the pockets hold less what the ledger says came in and went out. Zero when the books balance. */
function ledgerGaps(state: State): Partial<Record<Currency, number>> {
  const gaps: Partial<Record<Currency, number>> = {};
  for (const [currency, pocket] of Object.entries(state.wallet.pockets) as [Currency, State["wallet"]["pockets"][Currency]][]) {
    let net = 0;
    for (const byCurrency of Object.values(state.wallet.totals.in)) net += byCurrency?.[currency] ?? 0;
    for (const byCurrency of Object.values(state.wallet.totals.out)) net -= byCurrency?.[currency] ?? 0;
    const gap = pocket.bank + pocket.cash + pocket.locked - net;
    if (gap !== 0) gaps[currency] = gap;
  }
  return gaps;
}

/** R-QUALITY-001: every quality held sits inside its entry's range. */
function qualitiesOutOfRange(state: State): string[] {
  const out: string[] = [];
  for (const [id, value] of Object.entries(state.quality)) {
    const entry = content.quality[id as Id<"quality">];
    if (entry === undefined) out.push(`${id} has no entry`);
    else if (value < entry.min || value > entry.max) out.push(`${id} is ${String(value)}, outside ${String(entry.min)} to ${String(entry.max)}`);
  }
  return out;
}

function missingViewKeys(view: PlayerView): string[] {
  return VIEW_KEYS.filter((key) => !(key in view));
}

/** Every always-true rule this file checks, after one accepted command. */
function expectAllHold(game: Game): void {
  expect(checkInvariants(game.state, content)).toEqual([]);
  const view = game.view();
  expect(missingViewKeys(view)).toEqual([]);
  expect(hiddenPaths(view)).toEqual([]);
  expect(ledgerGaps(game.state)).toEqual({});
  expect(qualitiesOutOfRange(game.state)).toEqual([]);
  expect(JSON.parse(JSON.stringify(game.state)) as State).toEqual(game.state);
}

/** R-ENGINE-011, read from the view: a legal command while a turn is banked, and an answer while a set piece is open. */
function expectNotStuck(view: PlayerView): void {
  const legal = legalCommands(view);
  if (view.turns.banked > 0 && view.setpiece === null) expect(legal.length).toBeGreaterThan(0);
  if (view.setpiece !== null) expect(legal.some((command) => command.type === "setpiece/answer")).toBe(true);
}

function expectReplayMatches(game: Game): void {
  const rebuilt = replay(game.save, content, (tick) => standInWorld("world-1", tick, content));
  expect(hashState(rebuilt.state)).toBe(hashState(game.state));
}

const NAMES: StrategyName[] = ["careful", "borrower", "risky"];

describe("random play on the real lives", () => {
  for (const life of LIVES) {
    test.prop([fc.string({ minLength: 1, maxLength: 10 }), fc.array(fc.nat(), { minLength: COMMANDS, maxLength: COMMANDS })], {
      numRuns: SEEDS_PER_LIFE,
    })(
      `[R-ENGINE-001] [R-ENGINE-007] [R-ENGINE-010] [R-ENGINE-011] [R-WALLET-002] [R-QUALITY-001] given ${life}, when ${String(COMMANDS)} random legal commands are played, then each is accepted and after each the invariants hold, the view is whole and hides nothing, the books balance, every quality is in range and the state survives JSON`,
      (seed, picks) => {
        const game = start({ scenario: life, seed, content });
        for (const pick of picks) {
          const view = game.view();
          if (view.ended) break;
          expectNotStuck(view);
          const legal = legalCommands(view);
          if (legal.length === 0) {
            game.grant(1);
            continue;
          }
          const command = legal[pick % legal.length]!;
          const result = game.send(command);
          if (!result.ok) throw new Error(`${command.type} from the legal list was rejected with ${result.code}: ${result.detail}`);
          expectAllHold(game);
        }
        expectReplayMatches(game);
      },
    );
  }

  // The legal sample alone rarely gets as far as a deposit. One command in four
  // from it, the rest from one simulated player, carries most random lives
  // through the offer, the held funds, the interview, the decision and the flight.
  for (const life of LIVES) {
    test.prop([fc.string({ minLength: 1, maxLength: 10 }), fc.array(fc.nat(), { minLength: COMMANDS, maxLength: COMMANDS })], {
      numRuns: SEEDS_PER_LIFE,
    })(
      `[R-ENGINE-001] [R-ENGINE-007] [R-ENGINE-010] [R-ENGINE-011] [R-WALLET-002] [R-QUALITY-001] given ${life}, when ${String(COMMANDS)} commands mixing random legal ones with the simulated players' choices are played, then after each the same rules hold`,
      (seed, picks) => {
        const game = start({ scenario: life, seed, content });
        // The simulated players know nothing of the prologue; they take over a life that has one.
        finishPrologue(game);
        const name = NAMES[(picks[0] ?? 0) % NAMES.length]!;
        for (const pick of picks) {
          const view = game.view();
          if (view.ended) break;
          expectNotStuck(view);
          if (view.turns.banked === 0 && view.setpiece === null) {
            game.grant(1);
            continue;
          }
          const legal = legalCommands(view);
          const wanted = pick % 4 === 0 && legal.length > 0 ? [legal[pick % legal.length]!] : strategies[name](view, content);
          const accepted = wanted.some((command) => game.send(command).ok);
          if (!accepted) throw new Error(`Nothing the ${name} player wanted was accepted in month ${String(view.month)}.`);
          expectAllHold(game);
        }
        expectReplayMatches(game);
      },
    );
  }
});
