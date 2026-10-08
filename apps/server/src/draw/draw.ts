// The Friday draw on the server (docs/rules/lottery.md R-LOTTERY-007 to 013,
// 015, 017): open a draw with its fingerprint and beacon round, freeze the
// list at the close, take the beacon's randomness, draw with the simulation's
// public function, pay each winner as the authority, then publish the result.
import type { LotteryResult } from "@japacity/sim";
import { int } from "@japacity/sim";
import type { DrawRow, TicketRow } from "@japacity/store";

import { sendAuthority } from "../authority/command";
import { tickAt, tickStartsAt } from "../clock/view";
import type { ServerDeps } from "../deps";
import { drawSeed, drawWinners, fromHex, listHashOf, prizesFor, sha256, tiersFor, toHex, topUpFor, topUpPart } from "../../../../packages/sim/src/lottery/lottery.draw";
import type { Beacon } from "./beacon";
import { roundAfter } from "./beacon";

/** R-LOTTERY-002, R-CLOCK-002: draw `n` sells from tick `14n` and closes when tick `14(n + 1)` begins. */
export const TICKS_PER_DRAW = 14;

/** R-LOTTERY-007: 256 bits. lottery.md puts this in config as `server.lottery.secretBits`, which config.ts does not hold yet. */
export const SECRET_BYTES = 32;

/** A token is the first 16 hex digits of the HMAC (R-LOTTERY-008). */
const TOKEN_DIGITS = 16;

/**
 * The draw's server-only keys, passed in beside the deps until `ServerDeps`
 * holds them: the HMAC key for the tokens (R-SERVER-015, R-SERVER-016) and the beacon.
 */
export interface DrawKeys {
  tokenKey: string;
  beacon: Beacon;
}

/** R-LOTTERY-002: the draw on sale at a tick. */
export function drawOn(tick: number): number {
  return int.divFloor(tick, TICKS_PER_DRAW);
}

/** R-LOTTERY-002: the tick whose start closes draw `n`. */
export function closesTickOf(draw: number): number {
  return TICKS_PER_DRAW * (draw + 1);
}

/** The draw number as eight bytes, big end first, the way R-LOTTERY-010 writes its block counter. */
function drawBytes(draw: number): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(draw), false);
  return bytes;
}

/**
 * R-LOTTERY-007: the SHA-256 of the secret followed by the draw number, in hex.
 * the secret is read as the bytes its hex spells and the number as eight bytes, big end first.
 */
export function fingerprintOf(secret: string, draw: number): string {
  const secretBytes = fromHex(secret);
  const joined = new Uint8Array(secretBytes.length + 8);
  joined.set(secretBytes);
  joined.set(drawBytes(draw), secretBytes.length);
  return toHex(sha256(joined));
}

/**
 * R-LOTTERY-008: the first 16 hex digits of the HMAC-SHA-256 of the account id
 * and the draw number under the server's key.
 * the message is the account id, a colon and the draw number in decimal, as UTF-8.
 */
export async function tokenOf(key: string, account: string, draw: number): Promise<string> {
  if (key.length === 0) throw new Error("The draw's token key is not set, so a token would name its account to anyone.");
  const encoder = new TextEncoder();
  const imported = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", imported, encoder.encode(`${account}:${String(draw)}`));
  return toHex(new Uint8Array(mac)).slice(0, TOKEN_DIGITS);
}

/** R-LOTTERY-008: the list's hash is the simulation's, so the client's draw page recomputes it the same way. */
export { listHashOf };

/**
 * R-LOTTERY-008: the frozen list's tokens in ticket order.
 * a ticket whose character is gone (an account deleted) has no account id left to hash; its token is made from the character id instead. A stored list (`DrawRow.list`) would keep the published list fixed whatever is deleted later.
 */
export async function tokensOf(deps: Pick<ServerDeps, "stores">, key: string, draw: number, tickets: readonly TicketRow[]): Promise<string[]> {
  const byCharacter = new Map<string, string>();
  const tokens: string[] = [];
  for (const ticket of tickets) {
    let token = byCharacter.get(ticket.character);
    if (token === undefined) {
      const account = (await deps.stores.player.load(ticket.character))?.character.account ?? `character:${ticket.character}`;
      token = await tokenOf(key, account, draw);
      byCharacter.set(ticket.character, token);
    }
    tokens.push(token);
  }
  return tokens;
}

export type DrawDeps = Pick<ServerDeps, "config" | "stores" | "contents" | "randomBytes">;

/**
 * R-LOTTERY-007, R-LOTTERY-021: stores draw `n` with a fresh 256-bit secret,
 * its fingerprint, the first beacon round after its close, and the top-up the
 * private settings declare now, fixed for the draw. A draw already stored is
 * returned as it is, so opening twice is a no-op.
 */
export async function openDraw(deps: DrawDeps, beacon: Pick<Beacon, "genesis" | "period">, draw: number): Promise<DrawRow> {
  const stored = await deps.stores.world.draw(draw);
  if (stored !== null) return stored;
  const secret = toHex(deps.randomBytes(SECRET_BYTES));
  const beaconRound = roundAfter(beacon, tickStartsAt(deps.config.clock, closesTickOf(draw)));
  const { topUpTickets } = deps.contents.current.tuning.lottery;
  const put = await deps.stores.world.putDraw({ draw, secret, fingerprint: fingerprintOf(secret, draw), beaconRound, topUpTickets });
  if (put.ok) return put.value;
  // Two openers at once: the first stored wins and the second reads it.
  const winner = await deps.stores.world.draw(draw);
  if (winner === null) throw new Error(`Draw ${String(draw)} was refused with ${put.code} and is not stored: ${put.detail}`);
  return winner;
}

/** What a close came to: the published result, or why the draw waits for the next run. */
export type Closed = { kind: "drawn"; result: LotteryResult } | { kind: "waiting"; why: string };

/**
 * R-LOTTERY-010 to 012, R-LOTTERY-021: the published result of a frozen list
 * under the given randomness. The pot is the sales plus the top-up the draw
 * declared when it opened.
 */
export function resultOf(row: DrawRow, tokens: readonly string[], beaconRandomness: string, tuning: ServerDeps["contents"]["current"]["tuning"]["lottery"]): LotteryResult {
  const listHash = listHashOf(tokens);
  const count = tokens.length;
  const tiers = tiersFor(count, tuning);
  const winners = drawWinners(drawSeed(row.secret, listHash, beaconRandomness), count, tiers);
  const topUp = topUpFor(count, row.topUpTickets, tuning.ticket);
  const pot = count * tuning.ticket + topUp;
  const prizes = prizesFor(pot, tiers, winners, tuning);
  return { draw: row.draw, revealed: row.secret, beaconRound: row.beaconRound, beaconRandomness, listHash, count, pot, topUp, fund: prizes.fund, winners: prizes.winners };
}

export type Prize = { tier: "jackpot" | "mid" | "small"; amount: number; topUp: number };

/**
 * R-LOTTERY-013, R-LOTTERY-022: each winning character's prizes, one entry per
 * winning ticket, in ascending character id order, each with its part from the
 * top-up. Zero-kobo prizes are left out.
 */
export function prizesByCharacter(result: LotteryResult, tickets: readonly TicketRow[]): [string, Prize[]][] {
  const owed = new Map<string, Prize[]>();
  for (const tier of result.winners) {
    if (tier.amount < 1) continue;
    const prize: Prize = { tier: tier.tier, amount: tier.amount, topUp: topUpPart(tier.amount, result.topUp, result.pot) };
    for (const number of tier.tickets) {
      const ticket = tickets[number];
      if (ticket?.n !== number) throw new Error(`Ticket ${String(number)} of draw ${String(result.draw)} is not in the frozen list.`);
      owed.set(ticket.character, [...(owed.get(ticket.character) ?? []), prize]);
    }
  }
  return [...owed.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
}

/**
 * R-LOTTERY-008: the published list of a frozen draw. The first close stores
 * it, so a later run and the draw page read the same list whatever is deleted afterwards.
 */
async function listOf(deps: ServerDeps, keys: DrawKeys, row: DrawRow, tickets: readonly TicketRow[]): Promise<string[]> {
  if (row.list !== null) return row.list;
  const tokens = await tokensOf(deps, keys.tokenKey, row.draw, tickets);
  const stored = await deps.stores.world.setList(row.draw, tokens, listHashOf(tokens));
  if (stored.ok && stored.value.list !== null) return stored.value.list;
  // A second closer stored its list first: that one is published.
  const again = (await deps.stores.world.draw(row.draw))?.list ?? null;
  if (again === null) throw new Error(`Draw ${String(row.draw)}'s list was not stored: ${stored.ok ? "no list" : stored.detail}`);
  return again;
}

/**
 * R-LOTTERY-008 to 013, R-LOTTERY-015, R-LOTTERY-017: closes draw `n` once its
 * close tick has begun. Freezes the list, reads the beacon round, draws, pays
 * each winner by one `lottery/pay` as the authority, and stores the result
 * only after every payment is committed. Safe to run again at any point: a
 * stored result ends it, and a payment already made is refused by the kind
 * with `not-legal` and counted as made.
 */
export async function closeDraw(deps: ServerDeps, keys: DrawKeys, draw: number): Promise<Closed> {
  const row = await deps.stores.world.draw(draw);
  if (row === null) return { kind: "waiting", why: `Draw ${String(draw)} was never opened.` };
  if (row.result !== null) return { kind: "drawn", result: row.result };
  if (tickAt(deps.config.clock, deps.now()) < closesTickOf(draw)) return { kind: "waiting", why: `Draw ${String(draw)} is still on sale.` };

  const frozen = await deps.stores.world.freeze(draw, deps.now());
  if (!frozen.ok) throw new Error(`Draw ${String(draw)} did not freeze: ${frozen.code} ${frozen.detail}`);
  const tokens = await listOf(deps, keys, row, frozen.value);
  const randomness = await keys.beacon.randomness(row.beaconRound);
  if (randomness === null) return { kind: "waiting", why: `Beacon round ${String(row.beaconRound)} for draw ${String(draw)} could not be read.` };

  const result = resultOf(row, tokens, randomness, deps.contents.current.tuning.lottery);
  const unpaid: string[] = [];
  for (const [character, prizes] of prizesByCharacter(result, frozen.value)) {
    const outcome = await sendAuthority(deps, character, { type: "lottery/pay", draw, prizes, basedOn: 0 });
    switch (outcome.kind) {
      case "done":
        break;
      case "rejected":
        if (outcome.rejection.code !== "not-legal") throw new Error(`Paying ${character} for draw ${String(draw)} was rejected with ${outcome.rejection.code}: ${outcome.rejection.detail}`);
        break;
      case "diverged":
        // a diverged winner holds the draw's result back until the rollback tool mends it; the draw is tried again on every run.
        unpaid.push(character);
        break;
      case "refused":
        // a winner whose character is gone is paid nothing; the prize is destroyed with the rest of the fund.
        break;
      default: {
        const never: never = outcome;
        throw new Error(`Unknown outcome ${String(never)}.`);
      }
    }
  }
  if (unpaid.length > 0) return { kind: "waiting", why: `Draw ${String(draw)} could not pay ${unpaid.join(", ")}.` };

  const stored = await deps.stores.world.setResult(draw, result);
  if (stored.ok && stored.value.result !== null) return { kind: "drawn", result: stored.value.result };
  // A second closer stored the same result first.
  const again = await deps.stores.world.draw(draw);
  const settled = again?.result ?? null;
  if (settled === null) throw new Error(`Draw ${String(draw)}'s result was not stored.`);
  return { kind: "drawn", result: settled };
}
