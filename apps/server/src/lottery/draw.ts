// The Friday draw on the server (lottery:fingerprint-commits-secret, lottery:ticket-list-frozen-anonymously, lottery:seed-from-secret-and-beacon, lottery:ticket-result-is-public-function, lottery:fixed-prizes-shared-jackpot, lottery:jackpot-rolls-over, lottery:winners-paid-by-authority, lottery:result-published-in-tick-row, lottery:payment-waits-for-away-player): open a draw with its fingerprint, beacon round, odds and jackpot,
// freeze the list at the close, take the beacon's randomness, read every
// ticket with the simulation's public function, pay each winner as the
// authority, then publish the result.
import type { LotteryResult } from "@japacity/sim";
import { int, drawResults, drawSeed, fingerprintOf, jackpotHit, listHashOf, openingJackpot, rollJackpot, toHex } from "@japacity/sim";
import type { DrawRow, TicketRow, WorldStore } from "@japacity/store";

import { sendAuthority } from "../authority/command";
import { tickAt, tickStartsAt } from "../clock/view";
import type { ServerDeps } from "../deps";
import { lotteryOdds } from "../switches/dials";
import type { Beacon } from "./beacon";
import { roundAfter } from "./beacon";

/** lottery:draw-sells-between-ticks, clock:world-tick-length-and-epoch: draw `n` sells from tick `14n` and closes when tick `14(n + 1)` begins. */
export const TICKS_PER_DRAW = 14;

/** lottery:fingerprint-commits-secret: 256 bits, the figure config's `lottery.secretBits` also holds; this constant is the one read. */
export const SECRET_BYTES = 32;

/** A token is the first 16 hex digits of the HMAC (lottery:ticket-list-frozen-anonymously). */
const TOKEN_DIGITS = 16;

/** The draw's beacon, passed in so a test can hand in its own. The tokens' HMAC key is `secrets.drawTokenKey` (server:secrets-stay-on-server, server:hidden-values-made-once). */
export interface DrawKeys {
  beacon: Beacon;
}

/** lottery:draw-sells-between-ticks: the draw on sale at a tick. */
export function drawOn(tick: number): number {
  return int.divFloor(tick, TICKS_PER_DRAW);
}

/** lottery:draw-sells-between-ticks: the tick whose start closes draw `n`. */
export function closesTickOf(draw: number): number {
  return TICKS_PER_DRAW * (draw + 1);
}

/** lottery:fingerprint-commits-secret: the fingerprint is the simulation's, so the client's draw page checks it the same way. */
export { fingerprintOf };

/**
 * lottery:ticket-list-frozen-anonymously: the first 16 hex digits of the HMAC-SHA-256 of the account id
 * and the draw number under the server's key.
 * The message is the account id, a colon and the draw number in decimal, as UTF-8.
 */
export async function tokenOf(key: string, account: string, draw: number): Promise<string> {
  if (key.length === 0) throw new Error("The draw's token key is not set, so a token would name its account to anyone.");
  const encoder = new TextEncoder();
  const imported = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", imported, encoder.encode(`${account}:${String(draw)}`));
  return toHex(new Uint8Array(mac)).slice(0, TOKEN_DIGITS);
}

/** lottery:ticket-list-frozen-anonymously: the list's hash is the simulation's, so the client's draw page recomputes it the same way. */
export { listHashOf };

/**
 * lottery:ticket-list-frozen-anonymously: the frozen list's tokens in ticket order.
 * A ticket whose character is gone (an account deleted) has no account id left to hash; its token is made from the character id instead. The first close stores the list (`listOf`), so the published list stays fixed whatever is deleted afterwards.
 */
async function tokensOf(deps: Pick<ServerDeps, "stores">, key: string, draw: number, tickets: readonly TicketRow[]): Promise<string[]> {
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

export type DrawDeps = Pick<ServerDeps, "config" | "stores" | "contents" | "randomBytes" | "now">;

/**
 * How far back a draw looks for the stored draw before it. Draws open in order
 * on a five-minute job, so a gap is a run or two; past this many draws the
 * world is treated as never having drawn, and the jackpot starts again.
 */
const LOOK_BACK_DRAWS = 8;

/** The newest stored draw before `draw`, within `LOOK_BACK_DRAWS`, or null. */
export async function storedBefore(world: Pick<WorldStore, "draw">, draw: number): Promise<DrawRow | null> {
  for (let earlier = draw - 1; earlier >= Math.max(0, draw - LOOK_BACK_DRAWS); earlier -= 1) {
    const row = await world.draw(earlier);
    if (row !== null) return row;
  }
  return null;
}

/**
 * lottery:fingerprint-commits-secret, lottery:jackpot-rolls-over, lottery:odds-fixed-at-draw-open: stores draw `n` with a fresh
 * 256-bit secret, its fingerprint, the first beacon round after its close,
 * the odds the private settings hold now, and the jackpot standing, all fixed
 * for the draw. A draw already stored is returned as it is, so opening twice
 * is a no-op.
 * A draw opens only once the draw before it is drawn, because its
 * jackpot is that draw's result; until then it is not stored and null is
 * returned, and the world shows the draw before as closed (`lotteryFor`).
 */
export async function openDraw(deps: DrawDeps, beacon: Pick<Beacon, "genesis" | "period">, draw: number): Promise<DrawRow | null> {
  const stored = await deps.stores.world.draw(draw);
  if (stored !== null) return stored;
  const before = await storedBefore(deps.stores.world, draw);
  if (before !== null && before.result === null) return null;
  const odds = lotteryOdds(deps);
  const jackpot = openingJackpot(before?.result ?? null, odds);
  const secret = toHex(deps.randomBytes(SECRET_BYTES));
  const beaconRound = roundAfter(beacon, tickStartsAt(deps.config.clock, closesTickOf(draw)));
  const put = await deps.stores.world.putDraw({ draw, secret, fingerprint: fingerprintOf(secret, draw), beaconRound, odds, jackpot });
  if (put.ok) return put.value;
  // Two openers at once: the first stored wins and the second reads it.
  const winner = await deps.stores.world.draw(draw);
  if (winner === null) throw new Error(`Draw ${String(draw)} was refused with ${put.code} and is not stored: ${put.detail}`);
  return winner;
}

/** What a close came to: the published result, or why the draw waits for the next run. */
export type Closed = { kind: "drawn"; result: LotteryResult } | { kind: "waiting"; why: string };

/**
 * lottery:ticket-result-is-public-function, lottery:fixed-prizes-shared-jackpot, lottery:jackpot-rolls-over, lottery:odds-fixed-at-draw-open: the published result of a frozen list
 * under the given randomness, at the odds and jackpot the draw opened with.
 * Every ticket is read alone; the jackpot rolls on by the draw's sales, the
 * tickets sold at `ticket` each. `forced` is lottery:jackpot-rolls-over's forced win.
 */
export function resultOf(row: DrawRow, tokens: readonly string[], beaconRandomness: string, ticket: number, forced = false): LotteryResult {
  const listHash = listHashOf(tokens);
  const count = tokens.length;
  const winners = drawResults(drawSeed(row.secret, listHash, beaconRandomness), count, row.odds, row.jackpot, forced);
  const nextJackpot = rollJackpot(row.jackpot, count * ticket, jackpotHit(winners), row.odds);
  return { draw: row.draw, revealed: row.secret, beaconRound: row.beaconRound, beaconRandomness, listHash, count, odds: row.odds, jackpot: row.jackpot, winners, nextJackpot };
}

/**
 * lottery:jackpot-rolls-over: whether draw `row` is a forced win: its odds name
 * `forcedWinWeeks`, and that many draws, this one counted, have passed since
 * the last hit, read from the stored results before it.
 * With no hit stored, the draws are counted from the first stored one.
 */
export async function forcedWin(world: Pick<WorldStore, "draw">, row: DrawRow): Promise<boolean> {
  const weeks = row.odds.forcedWinWeeks;
  if (weeks === null) return false;
  let since = 1;
  let earlier = await storedBefore(world, row.draw);
  while (since < weeks && earlier !== null && earlier.result !== null && !jackpotHit(earlier.result.winners)) {
    since += 1;
    earlier = await storedBefore(world, earlier.draw);
  }
  return since >= weeks;
}

export type Prize = { tier: "jackpot" | "mid" | "small"; amount: number };

/**
 * lottery:fixed-prizes-shared-jackpot, lottery:winners-paid-by-authority: each winning character's prizes, one entry per
 * winning ticket, in ascending character id order. Zero-kobo prizes are left out.
 */
function prizesByCharacter(result: LotteryResult, tickets: readonly TicketRow[]): [string, Prize[]][] {
  const owed = new Map<string, Prize[]>();
  for (const tier of result.winners) {
    if (tier.amount < 1) continue;
    const prize: Prize = { tier: tier.tier, amount: tier.amount };
    for (const number of tier.tickets) {
      const ticket = tickets[number];
      if (ticket?.n !== number) throw new Error(`Ticket ${String(number)} of draw ${String(result.draw)} is not in the frozen list.`);
      owed.set(ticket.character, [...(owed.get(ticket.character) ?? []), prize]);
    }
  }
  return [...owed.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
}

/**
 * lottery:ticket-list-frozen-anonymously: the published list of a frozen draw. The first close stores
 * it, so a later run and the draw page read the same list whatever is deleted afterwards.
 */
async function listOf(deps: ServerDeps, row: DrawRow, tickets: readonly TicketRow[]): Promise<string[]> {
  if (row.list !== null) return row.list;
  const tokens = await tokensOf(deps, deps.secrets.drawTokenKey, row.draw, tickets);
  const stored = await deps.stores.world.setList(row.draw, tokens, listHashOf(tokens));
  if (stored.ok && stored.value.list !== null) return stored.value.list;
  // A second closer stored its list first: that one is published.
  const again = (await deps.stores.world.draw(row.draw))?.list ?? null;
  if (again === null) throw new Error(`Draw ${String(row.draw)}'s list was not stored: ${stored.ok ? "no list" : stored.detail}`);
  return again;
}

/**
 * lottery:ticket-list-frozen-anonymously, lottery:seed-from-secret-and-beacon, lottery:ticket-result-is-public-function, lottery:fixed-prizes-shared-jackpot, lottery:jackpot-rolls-over, lottery:winners-paid-by-authority, lottery:result-published-in-tick-row, lottery:payment-waits-for-away-player: closes draw `n` once its
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
  const tokens = await listOf(deps, row, frozen.value);
  const randomness = await keys.beacon.randomness(row.beaconRound);
  if (randomness === null) return { kind: "waiting", why: `Beacon round ${String(row.beaconRound)} for draw ${String(draw)} could not be read.` };

  const result = resultOf(row, tokens, randomness, deps.contents.current.tuning.lottery.ticket, await forcedWin(deps.stores.world, row));
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
        // A diverged winner holds the draw's result back until the rollback tool mends it; the draw is tried again on every run.
        unpaid.push(character);
        break;
      case "refused":
        // A winner whose character is gone is paid nothing; the prize is destroyed with the rest of the fund.
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
