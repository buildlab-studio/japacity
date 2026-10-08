// An online life for the lottery's screen tests: the real engine and the real
// content, with a world that runs the draw the test sets, behind a store
// authority the way the server would answer.
import { content } from "@japacity/content";
import type { Command, LotteryOdds, LotteryResult, PlayerView, Reply, Rejection, World } from "@japacity/sim";
import { drawResults, drawSeed, fingerprintOf, jackpotHit, listHashOf, rollJackpot, standInWorld, toHex, sha256 } from "@japacity/sim";

import type { StoreAuthority } from "../../authority/store";
// The rule tests' game handle is the sim's own test tool; the package exports only its contract.
import { start, type Game } from "../../../../../packages/sim/src/testing/play";
import type { DrawReply } from "./draw";

export type Draw = NonNullable<World["lottery"]>;

export const tuning = content.tuning.lottery;

/** Odds that pay often, so a few dozen tickets win in every tier. */
export const GENEROUS: LotteryOdds = { ...tuning.odds, smallPerMillion: 300_000, midPerMillion: 100_000, jackpotPerMillion: 50_000 };

export function drawOf(over: Partial<Draw> = {}): Draw {
  return { draw: 7, closesTick: 14, onSale: true, fingerprint: "ab".repeat(32), beaconRound: 1234, salesSoFar: 3 * tuning.ticket, jackpot: tuning.odds.jackpotStart, rolledOver: false, odds: tuning.odds, last: null, ...over };
}

export interface OnlineLife {
  game: Game;
  live: { lottery: World["lottery"] };
  authority: StoreAuthority & { sent: Command[] };
}

/** Tunde, online, with ₦4.2m in the bank: every command goes through the real engine. */
export function onlineLife(lottery: World["lottery"]): OnlineLife {
  const base = standInWorld("world-1", 0, content);
  const live = { lottery };
  const game = start({
    scenario: "scenario.tunde",
    content,
    worldAt: (tick) => ({ tick, rates: base.rates, vars: base.vars, news: [], era: null, lottery: live.lottery, placeNames: {} }),
  });
  const sent: Command[] = [];
  const authority = {
    sent,
    view: (): Promise<PlayerView> => Promise.resolve(game.view()),
    send(command: Command): Promise<Reply | Rejection> {
      sent.push(command);
      // The handle stamps its own version, so the store's is left to it.
      const result = game.send(command);
      if (!result.ok) return Promise.resolve(result);
      return Promise.resolve({ ok: true, view: game.view(), lines: result.lines });
    },
  };
  return { game, live, authority };
}

function bytes(text: string): Uint8Array {
  return Uint8Array.from(text, (character) => character.charCodeAt(0));
}

/** A hex string of 32 bytes made from a word, so each test value is fixed and readable. */
function hexOf(word: string): string {
  return toHex(sha256(bytes(word)));
}

/**
 * A drawn draw as the server publishes it: a list of `count` tickets over a
 * few players' tokens, the secret behind the fingerprint, the round's value,
 * and the winners the simulation's own functions give at `odds` and `jackpot`.
 */
export function drawnReply(draw: number, count: number, odds: LotteryOdds = GENEROUS, jackpot = odds.jackpotStart): DrawReply {
  const tokens = ["0011223344556677", "8899aabbccddeeff", "0123456789abcdef"];
  const list = Array.from({ length: count }, (_, index) => tokens[index % tokens.length]!);
  const secret = hexOf(`secret-${String(draw)}`);
  const beaconRandomness = hexOf(`round-${String(draw)}`);
  const listHash = listHashOf(list);
  const winners = drawResults(drawSeed(secret, listHash, beaconRandomness), count, odds, jackpot);
  const nextJackpot = rollJackpot(jackpot, count * tuning.ticket, jackpotHit(winners), odds);
  const result: LotteryResult = { draw, revealed: secret, beaconRound: 5000 + draw, beaconRandomness, listHash, count, odds, jackpot, winners, nextJackpot };
  return {
    draw,
    closesTick: 14 * (draw + 1),
    closesAt: Date.UTC(2026, 9, 9, 18),
    fingerprint: fingerprintOf(secret, draw),
    beaconRound: result.beaconRound,
    odds,
    jackpot,
    list,
    count,
    listHash,
    result,
  };
}
