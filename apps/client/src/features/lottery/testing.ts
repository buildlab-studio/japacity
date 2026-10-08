// An online life for the lottery's screen tests: the real engine and the real
// content, with a world that runs the draw the test sets, behind a store
// authority the way the server would answer.
import { content } from "@japacity/content";
import type { Command, LotteryResult, PlayerView, Reply, Rejection, World } from "@japacity/sim";
import { drawSeed, drawWinners, fingerprintOf, listHashOf, prizesFor, standInWorld, tiersFor, toHex, topUpFor, sha256 } from "@japacity/sim";

import type { StoreAuthority } from "../../authority/store";
// The rule tests' game handle is the sim's own test tool; the package exports only its contract.
import { start, type Game } from "../../../../../packages/sim/src/testing/play";
import type { DrawReply } from "./draw";

export type Draw = NonNullable<World["lottery"]>;

export const tuning = content.tuning.lottery;

export function drawOf(over: Partial<Draw> = {}): Draw {
  return { draw: 7, closesTick: 14, fingerprint: "ab".repeat(32), beaconRound: 1234, potSoFar: 3 * tuning.ticket, topUpTickets: 0, last: null, ...over };
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
 * and the winners and prizes the simulation's own functions give.
 */
export function drawnReply(draw: number, count: number, topUpTickets = 0): DrawReply {
  const tokens = ["0011223344556677", "8899aabbccddeeff", "0123456789abcdef"];
  const list = Array.from({ length: count }, (_, index) => tokens[index % tokens.length]!);
  const secret = hexOf(`secret-${String(draw)}`);
  const beaconRandomness = hexOf(`round-${String(draw)}`);
  const listHash = listHashOf(list);
  const tiers = tiersFor(count, tuning);
  const winners = drawWinners(drawSeed(secret, listHash, beaconRandomness), count, tiers);
  const topUp = topUpFor(count, topUpTickets, tuning.ticket);
  const pot = count * tuning.ticket + topUp;
  const prizes = prizesFor(pot, tiers, winners, tuning);
  const result: LotteryResult = { draw, revealed: secret, beaconRound: 5000 + draw, beaconRandomness, listHash, count, pot, topUp, fund: prizes.fund, winners: prizes.winners };
  return {
    draw,
    closesTick: 14 * (draw + 1),
    closesAt: Date.UTC(2026, 9, 9, 18),
    fingerprint: fingerprintOf(secret, draw),
    beaconRound: result.beaconRound,
    topUpTickets,
    list,
    count,
    listHash,
    result,
  };
}
