// The Friday draw's figures as the screens need them: the close as a real
// time, the pot with the house's part apart, and the public check of a drawn
// draw, worked out on the device with the simulation's own functions
// (docs/rules/lottery.md R-LOTTERY-006, 015, 021 to 023).
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { drawSeed, drawWinners, fingerprintOf, listHashOf, tiersFor, time, toHex } from "@japacity/sim";

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

/** R-LOTTERY-023: the pot as the kiosk shows it: sales and the house's part apart, and both together. */
export function potOf(lottery: Lottery): { sales: number; topUp: number; total: number; worth: number } {
  const worth = lottery.topUpTickets * lottery.ticket;
  return { sales: lottery.potSoFar, topUp: lottery.topUpSoFar, total: lottery.potSoFar + lottery.topUpSoFar, worth };
}

/** How many more tickets the character may buy now: the cap less what is held, and no more than the bank pays for. */
export function canBuy(lottery: Lottery, bank: number): number {
  const room = Math.max(0, lottery.maxTickets - lottery.tickets);
  return Math.min(room, Math.floor(bank / lottery.ticket));
}

export interface DrawCheck {
  /** The seed worked out on the device. */
  seed: string;
  /** The winning tickets drawn on the device, tier by tier. */
  winners: number[][];
  fingerprint: boolean;
  list: boolean;
  matches: boolean;
}

function isHex(value: string): boolean {
  return /^(?:[0-9a-fA-F]{2})*$/.test(value);
}

/**
 * R-LOTTERY-015: recomputes a drawn draw from what is published: the secret
 * against the opening fingerprint, the list against its hash, and the seed and
 * the winners with `drawSeed` and `drawWinners`, compared with the result.
 * Null when there is no result yet or the published values are not hex.
 */
export function checkDraw(reply: DrawReply): DrawCheck | null {
  const { result, list } = reply;
  if (result === null || list === null) return null;
  if (![result.revealed, result.listHash, result.beaconRandomness, ...list].every(isHex)) return null;
  const seed = drawSeed(result.revealed, result.listHash, result.beaconRandomness);
  const winners = drawWinners(seed, result.count, tiersFor(result.count, content.tuning.lottery));
  const published = result.winners.map((tier) => tier.tickets);
  const matches = winners.length === published.length && winners.every((tickets, index) => tickets.join(",") === published[index]?.join(","));
  return {
    seed: toHex(seed),
    winners,
    fingerprint: fingerprintOf(result.revealed, reply.draw) === reply.fingerprint,
    list: list.length === result.count && listHashOf(list) === result.listHash && result.listHash === reply.listHash,
    matches,
  };
}
