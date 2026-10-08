// The Friday draw's figures as the screens need them: the close as a real
// time, the odds as chances, and the public check of a drawn draw, every
// ticket worked out on the device with the simulation's own functions
// (docs/rules/lottery.md R-LOTTERY-006, 015, 021 to 023).
import type { LotteryOdds, LotteryResult, PlayerView, Tier } from "@japacity/sim";
import { drawResults, drawSeed, fingerprintOf, listHashOf, PER_MILLION, ticketResult, time, toHex } from "@japacity/sim";

import { authorityMode } from "../../authority/mode";
import type { ClockView, DrawReply, ServerRejection } from "../../shared/net/contract";
import { api, type Fetch } from "../../shared/net/http";

export type Lottery = NonNullable<PlayerView["lottery"]>;

export type { DrawReply };

export type LoadDraw = (draw: number) => Promise<DrawReply | ServerRejection>;

/** The draw page's fetch from the server the build names; null when the build runs the local authority, which runs no draw. */
export function serverDrawLoader(fetch?: Fetch): LoadDraw | null {
  const mode = authorityMode();
  if (mode.authority !== "remote") return null;
  const http = api({ baseUrl: mode.baseUrl, ...(fetch === undefined ? {} : { fetch }) });
  return (draw) => http.get<DrawReply | ServerRejection>(`/api/draw/${String(draw)}`);
}

export function isRefusal(reply: DrawReply | ServerRejection): reply is ServerRejection {
  return "ok" in reply;
}

/**
 * R-LOTTERY-002, R-CLOCK-002: the real time sales close, from the server's
 * clock: the next tick begins at `nextTickAt` and every tick after it is
 * twelve hours long. Null without a clock.
 */
export function closesAt(lottery: Pick<Lottery, "closesTick">, clock: Pick<ClockView, "tick" | "nextTickAt"> | null): number | null {
  if (clock === null) return null;
  return clock.nextTickAt + (lottery.closesTick - clock.tick - 1) * time.WORLD_TICK_MS;
}

/** One prize's chance as the kiosk says it: one ticket in `every` wins `amount`, `exact` when a million divides evenly. */
export interface Chance {
  tier: Tier;
  every: number;
  exact: boolean;
  amount: number;
}

/**
 * R-LOTTERY-023: the odds as plain chances, the jackpot first, with the
 * jackpot standing as its amount. A prize no ticket can win is left out.
 */
export function chancesOf(odds: LotteryOdds, jackpot: number): Chance[] {
  const chance = (tier: Tier, perMillion: number, amount: number): Chance[] =>
    perMillion <= 0 ? [] : [{ tier, every: Math.round(PER_MILLION / perMillion), exact: PER_MILLION % perMillion === 0, amount }];
  return [...chance("jackpot", odds.jackpotPerMillion, jackpot), ...chance("mid", odds.midPerMillion, odds.mid), ...chance("small", odds.smallPerMillion, odds.small)];
}

/** R-LOTTERY-012, R-LOTTERY-016: whether a ticket hit the result's jackpot, and how many tickets won anything. */
export function resultCounts(result: LotteryResult): { hit: boolean; winners: number } {
  return {
    hit: result.winners.some((tier) => tier.tier === "jackpot" && tier.tickets.length > 0),
    winners: result.winners.reduce((sum, tier) => sum + tier.tickets.length, 0),
  };
}

/** How many more tickets the character may buy now: the cap less what is held, and no more than the bank pays for. */
export function canBuy(lottery: Lottery, bank: number): number {
  const room = Math.max(0, lottery.maxTickets - lottery.tickets);
  return Math.min(room, Math.floor(bank / lottery.ticket));
}

export interface DrawCheck {
  /** The seed worked out on the device. */
  seed: string;
  /** Every ticket's result worked out on the device with `ticketResult`, by ticket number. */
  tickets: (Tier | null)[];
  /** The winning tickets and amounts worked out on the device, tier by tier. */
  winners: LotteryResult["winners"];
  fingerprint: boolean;
  list: boolean;
  matches: boolean;
}

function isHex(value: string): boolean {
  return /^(?:[0-9a-fA-F]{2})*$/.test(value);
}

function sameWinners(mine: LotteryResult["winners"], published: LotteryResult["winners"]): boolean {
  return JSON.stringify(mine) === JSON.stringify(published);
}

/**
 * R-LOTTERY-015: recomputes a drawn draw from what is published: the secret
 * against the opening fingerprint, the list against its hash, the seed with
 * `drawSeed`, every ticket with `ticketResult` at the published odds, and the
 * winners and their amounts at the published jackpot, compared with the
 * result. A forced win (R-LOTTERY-012) matches only when the odds name one.
 * Null when there is no result yet or the published values are not hex.
 */
export function checkDraw(reply: DrawReply): DrawCheck | null {
  const { result, list } = reply;
  if (result === null || list === null) return null;
  if (![result.revealed, result.listHash, result.beaconRandomness, ...list].every(isHex)) return null;
  const seed = drawSeed(result.revealed, result.listHash, result.beaconRandomness);
  const tickets = Array.from({ length: result.count }, (_, number) => ticketResult(seed, number, result.odds));
  const natural = drawResults(seed, result.count, result.odds, result.jackpot);
  const forced = result.odds.forcedWinWeeks === null ? null : drawResults(seed, result.count, result.odds, result.jackpot, true);
  const matches = sameWinners(natural, result.winners) || (forced !== null && sameWinners(forced, result.winners));
  return {
    seed: toHex(seed),
    tickets,
    winners: forced !== null && sameWinners(forced, result.winners) ? forced : natural,
    fingerprint: fingerprintOf(result.revealed, reply.draw) === reply.fingerprint,
    list: list.length === result.count && listHashOf(list) === result.listHash && result.listHash === reply.listHash,
    matches,
  };
}
