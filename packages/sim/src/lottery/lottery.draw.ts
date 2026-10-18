// The Friday draw's public method: lottery:fingerprint-commits-secret, lottery:ticket-list-frozen-anonymously, lottery:seed-from-secret-and-beacon, lottery:ticket-result-is-public-function, lottery:fixed-prizes-shared-jackpot, lottery:jackpot-rolls-over, lottery:odds-fixed-at-draw-open, lottery:expected-return-below-price. Pure code, so the server that runs the draw and the client page
// that checks it run the same function. SHA-256 is written out here because
// Web Crypto's digest is asynchronous and platform code (decision 0016).
import { BP_WHOLE, bp, divFloor, mulDiv } from "../engine/int";
import type { Content, LotteryOdds, LotteryResult } from "../engine/types";

export type Tier = "jackpot" | "mid" | "small";

/** The tiers in the order a result lists them. */
export const TIERS: readonly Tier[] = ["jackpot", "mid", "small"];

/** lottery:ticket-result-is-public-function: a ticket's draw is one in a million. */
export const PER_MILLION = 1_000_000;

// ---------------------------------------------------------------------------
// SHA-256 (FIPS 180-4)
// ---------------------------------------------------------------------------

const ROUND_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const INITIAL_HASH = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19] as const;

function rotr(word: number, bits: number): number {
  return (word >>> bits) | (word << (32 - bits));
}

/** The SHA-256 digest of the bytes, 32 bytes long. */
export function sha256(message: Uint8Array): Uint8Array {
  // The message, the 0x80 byte and the 8-byte length, rounded up to whole 64-byte blocks.
  const blocks = (message.length + 9 + 63) >>> 6;
  const padded = new Uint8Array(blocks * 64);
  padded.set(message);
  padded[message.length] = 0x80;
  const reader = new DataView(padded.buffer);
  reader.setBigUint64(padded.length - 8, BigInt(message.length) * 8n, false);

  const hash = new Uint32Array(INITIAL_HASH);
  const schedule = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let round = 0; round < 16; round += 1) schedule[round] = reader.getUint32(offset + round * 4, false);
    for (let round = 16; round < 64; round += 1) {
      const back15 = schedule[round - 15]!;
      const back2 = schedule[round - 2]!;
      const sigma0 = rotr(back15, 7) ^ rotr(back15, 18) ^ (back15 >>> 3);
      const sigma1 = rotr(back2, 17) ^ rotr(back2, 19) ^ (back2 >>> 10);
      schedule[round] = schedule[round - 16]! + sigma0 + schedule[round - 7]! + sigma1;
    }
    let [ha, hb, hc, hd, he, hf, hg, hh] = hash as unknown as [number, number, number, number, number, number, number, number];
    for (let round = 0; round < 64; round += 1) {
      const sum1 = rotr(he, 6) ^ rotr(he, 11) ^ rotr(he, 25);
      const choose = (he & hf) ^ (~he & hg);
      const first = (hh + sum1 + choose + ROUND_CONSTANTS[round]! + schedule[round]!) >>> 0;
      const sum0 = rotr(ha, 2) ^ rotr(ha, 13) ^ rotr(ha, 22);
      const majority = (ha & hb) ^ (ha & hc) ^ (hb & hc);
      const second = (sum0 + majority) >>> 0;
      hh = hg;
      hg = hf;
      hf = he;
      he = (hd + first) >>> 0;
      hd = hc;
      hc = hb;
      hb = ha;
      ha = (first + second) >>> 0;
    }
    hash[0] = hash[0]! + ha;
    hash[1] = hash[1]! + hb;
    hash[2] = hash[2]! + hc;
    hash[3] = hash[3]! + hd;
    hash[4] = hash[4]! + he;
    hash[5] = hash[5]! + hf;
    hash[6] = hash[6]! + hg;
    hash[7] = hash[7]! + hh;
  }
  const digest = new Uint8Array(32);
  const writer = new DataView(digest.buffer);
  hash.forEach((word, index) => writer.setUint32(index * 4, word, false));
  return digest;
}

/** Bytes as lower-case hex. */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Hex, either case, as bytes. Throws on anything that is not whole bytes of hex. */
export function fromHex(hex: string): Uint8Array {
  if (!/^(?:[0-9a-fA-F]{2})*$/.test(hex)) throw new Error(`${hex} is not whole bytes of hex.`);
  const bytes = new Uint8Array(hex.length >>> 1);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  return bytes;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const joined = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    joined.set(part, at);
    at += part.length;
  }
  return joined;
}

// ---------------------------------------------------------------------------
// The draw
// ---------------------------------------------------------------------------

/** The draw number as eight bytes, big end first, the way lottery:ticket-result-is-public-function writes its block counter. */
function drawBytes(draw: number): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(draw), false);
  return bytes;
}

/**
 * lottery:fingerprint-commits-secret: the SHA-256 of the secret followed by the draw number, in hex.
 * The secret is read as the bytes its hex spells and the number as eight bytes, big end first.
 */
export function fingerprintOf(secret: string, draw: number): string {
  return toHex(sha256(concat([fromHex(secret), drawBytes(draw)])));
}

/**
 * lottery:ticket-list-frozen-anonymously: the frozen list's SHA-256 in hex.
 * The hash is of the tokens' bytes in ticket order, eight bytes each, so the client's draw page recomputes it the way the server made it.
 */
export function listHashOf(tokens: readonly string[]): string {
  return toHex(sha256(fromHex(tokens.join(""))));
}

/**
 * lottery:seed-from-secret-and-beacon: the seed is the SHA-256 of the secret, the list's hash and the
 * beacon round's randomness, joined in that order.
 * Each is given in hex and joined as the bytes the hex spells.
 */
export function drawSeed(secret: string, listHash: string, beaconRandomness: string): Uint8Array {
  return sha256(concat([fromHex(secret), fromHex(listHash), fromHex(beaconRandomness)]));
}

/** lottery:ticket-result-is-public-function: block `index` of the seed's counter-mode stream, the SHA-256 of the seed and `index` as eight bytes, big end first. */
function blockOf(seed: Uint8Array, index: number): Uint8Array {
  const input = new Uint8Array(seed.length + 8);
  input.set(seed);
  new DataView(input.buffer).setBigUint64(seed.length, BigInt(index), false);
  return sha256(input);
}

const MILLION = BigInt(PER_MILLION);

/**
 * lottery:ticket-result-is-public-function: the ticket's draw of one in a million, from 0 to 999,999.
 * The block's first eight bytes, big end first, modulo a million; the
 * lowest numbers are favoured by under one part in ten trillion, which no odds
 * in whole draws per million can feel.
 */
export function ticketDraw(seed: Uint8Array, ticket: number): number {
  if (!Number.isSafeInteger(ticket) || ticket < 0) throw new Error(`A ticket number is a whole number from 0, got ${String(ticket)}.`);
  return Number(new DataView(blockOf(seed, ticket).buffer).getBigUint64(0, false) % MILLION);
}

/** lottery:ticket-result-is-public-function: a draw of one in a million read against the odds: the jackpot first, then the mid prize, then the small. */
export function tierOfDraw(draw: number, odds: LotteryOdds): Tier | null {
  if (draw < odds.jackpotPerMillion) return "jackpot";
  if (draw < odds.jackpotPerMillion + odds.midPerMillion) return "mid";
  if (draw < odds.jackpotPerMillion + odds.midPerMillion + odds.smallPerMillion) return "small";
  return null;
}

/** lottery:ticket-result-is-public-function: what one ticket won, a pure public function of the seed, its number and the draw's odds. */
export function ticketResult(seed: Uint8Array, ticket: number, odds: LotteryOdds): Tier | null {
  return tierOfDraw(ticketDraw(seed, ticket), odds);
}

/**
 * lottery:jackpot-rolls-over: the forced win's ticket, the sold ticket whose draw is
 * highest; the lowest number among equals. Null with no ticket sold.
 */
export function forcedTicket(seed: Uint8Array, count: number): number | null {
  let best: number | null = null;
  let highest = -1;
  for (let ticket = 0; ticket < count; ticket += 1) {
    const draw = ticketDraw(seed, ticket);
    if (draw > highest) {
      highest = draw;
      best = ticket;
    }
  }
  return best;
}

/**
 * lottery:ticket-result-is-public-function, lottery:fixed-prizes-shared-jackpot: every sold ticket's result, as the published
 * winners: each tier's tickets in number order and what one of them is paid.
 * The small and mid prizes are their fixed amounts; the jackpot is shared
 * equally to the kobo among its hits, and with no hit its amount is what one
 * hit would have taken. `forced` (lottery:jackpot-rolls-over) gives the jackpot to the
 * forced ticket when no ticket hit it.
 */
export function drawResults(seed: Uint8Array, count: number, odds: LotteryOdds, jackpot: number, forced = false): LotteryResult["winners"] {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error(`A draw's ticket count must be a whole number from 0, got ${String(count)}.`);
  if (!Number.isSafeInteger(jackpot) || jackpot < 0) throw new Error(`A jackpot is a whole number of kobo from 0, got ${String(jackpot)}.`);
  const won: Record<Tier, number[]> = { jackpot: [], mid: [], small: [] };
  for (let ticket = 0; ticket < count; ticket += 1) {
    const tier = ticketResult(seed, ticket, odds);
    if (tier !== null) won[tier].push(ticket);
  }
  const lucky = forced && won.jackpot.length === 0 ? forcedTicket(seed, count) : null;
  if (lucky !== null) {
    won.mid = won.mid.filter((ticket) => ticket !== lucky);
    won.small = won.small.filter((ticket) => ticket !== lucky);
    won.jackpot = [lucky];
  }
  const hits = won.jackpot.length;
  return [
    { tier: "jackpot", tickets: won.jackpot, amount: hits === 0 ? jackpot : divFloor(jackpot, hits) },
    { tier: "mid", tickets: won.mid, amount: odds.mid },
    { tier: "small", tickets: won.small, amount: odds.small },
  ];
}

/** lottery:jackpot-rolls-over: whether any ticket of a result hit the jackpot. */
export function jackpotHit(winners: LotteryResult["winners"]): boolean {
  return winners.some((tier) => tier.tier === "jackpot" && tier.tickets.length > 0);
}

/** lottery:money-report-checks-draws: what lottery:fixed-prizes-shared-jackpot pays for a result: every winning ticket at its tier's amount. */
export function prizesOwed(winners: LotteryResult["winners"]): number {
  return winners.reduce((sum, tier) => sum + tier.tickets.length * tier.amount, 0);
}

/**
 * lottery:jackpot-rolls-over: the jackpot after a draw under its own odds: the start after
 * a hit, else the smaller of the cap and the jackpot plus `jackpotGrowthBp` of
 * the draw's sales, rounded down.
 */
export function rollJackpot(jackpot: number, sales: number, hit: boolean, odds: LotteryOdds): number {
  if (hit) return odds.jackpotStart;
  return Math.min(odds.jackpotCap, jackpot + bp(sales, odds.jackpotGrowthBp));
}

/**
 * lottery:jackpot-rolls-over, lottery:odds-fixed-at-draw-open: the jackpot a draw opens with under the odds
 * it opens with, from the last draw's result: the start for the first draw or
 * after a hit, else the rolled-over amount.
 * When the settings changed between the two draws, the start is the
 * new one and the rolled-over amount is held under the new cap, so a draw never
 * stands above the cap its odds were checked at (lottery:expected-return-below-price).
 */
export function openingJackpot(previous: Pick<LotteryResult, "winners" | "nextJackpot"> | null, odds: LotteryOdds): number {
  if (previous === null || jackpotHit(previous.winners)) return odds.jackpotStart;
  return Math.min(odds.jackpotCap, previous.nextJackpot);
}

/**
 * lottery:expected-return-below-price: what a ticket returns on average under the odds with the
 * jackpot at `jackpot`, in kobo times a million, so it is exact:
 * `small × smallPerMillion + mid × midPerMillion + jackpot × jackpotPerMillion`.
 */
export function expectedReturnPerMillion(odds: LotteryOdds, jackpot: number): number {
  return odds.small * odds.smallPerMillion + odds.mid * odds.midPerMillion + jackpot * odds.jackpotPerMillion;
}

/**
 * lottery:odds-fixed-at-draw-open, lottery:expected-return-below-price: the odds leave room in a million, the jackpot
 * starts under its cap, and a ticket returns less than its price on average at
 * the starting jackpot and at the cap.
 */
export function checkLotteryContent(content: Content): string[] {
  const { ticket, odds } = content.tuning.lottery;
  const problems: string[] = [];
  const chances = odds.jackpotPerMillion + odds.midPerMillion + odds.smallPerMillion;
  if (chances > PER_MILLION) problems.push(`tuning.lottery.odds: the chances add up to ${String(chances)} in a million, more than a million (lottery:ticket-result-is-public-function).`);
  if (odds.jackpotStart > odds.jackpotCap) {
    problems.push(`tuning.lottery.odds: the jackpot starts at ${String(odds.jackpotStart)}, over its cap of ${String(odds.jackpotCap)} (lottery:jackpot-rolls-over).`);
  }
  for (const [name, jackpot] of [
    ["the starting jackpot", odds.jackpotStart],
    ["the cap", odds.jackpotCap],
  ] as const) {
    const back = expectedReturnPerMillion(odds, jackpot);
    if (!Number.isSafeInteger(back)) {
      problems.push(`tuning.lottery.odds: the expected return at ${name} is past a whole number of kobo (lottery:expected-return-below-price).`);
    } else if (back >= ticket * PER_MILLION) {
      problems.push(
        `tuning.lottery.odds: a ticket returns ${String(divFloor(back, PER_MILLION))} kobo on average at ${name}, not under its price of ${String(ticket)} (lottery:expected-return-below-price).`,
      );
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// The raffle: switched off by decision 0016
// ---------------------------------------------------------------------------
// A raffle among the sold tickets, with a pot the house made up. Decision 0016
// draws by fixed odds instead. The code and its tests stay, unused: a feature
// switched off keeps its code.

/** One tier of the raffle: how many tickets it pays, in the order the tiers are filled. */
export interface TierSpec {
  tier: Tier;
  count: number;
}

/** The raffle's settings as `tuning.lottery` held them before decision 0016. */
export interface RaffleSettings {
  ticket: number;
  burnBp: number;
  jackpotBp: number;
  midBp: number;
  midCount: number;
  smallBp: number;
  smallEvery: number;
  topUpTickets: number;
}

/** The raffle's working values when it was switched off, for its tests. */
export const RAFFLE_AT_SWITCH_OFF: RaffleSettings = { ticket: 20000, burnBp: 4500, jackpotBp: 4000, midBp: 3000, midCount: 10, smallBp: 3000, smallEvery: 50, topUpTickets: 5000 };

const TWO_TO_64 = 1n << 64n;

/** The raffle's stream: block `i` is the SHA-256 of the seed and `i` as eight bytes, big end first, read as four 64-bit numbers. */
function counterStream(seed: Uint8Array): () => bigint {
  const input = new Uint8Array(seed.length + 8);
  input.set(seed);
  const counter = new DataView(input.buffer, seed.length, 8);
  let block = 0n;
  let words: bigint[] = [];
  return () => {
    if (words.length === 0) {
      counter.setBigUint64(0, block, false);
      const digest = new DataView(sha256(input).buffer);
      words = [0, 8, 16, 24].map((at) => digest.getBigUint64(at, false));
      block += 1n;
    }
    return words.shift()!;
  };
}

/** A number from 0 to `below` minus one. Values in the last partial run of `below` are thrown away, so none is favoured. */
function uniform(next: () => bigint, below: number): number {
  const size = BigInt(below);
  const limit = TWO_TO_64 - (TWO_TO_64 % size);
  for (;;) {
    const value = next();
    if (value < limit) return Number(value % size);
  }
}

/**
 * The raffle (lottery:ticket-result-is-public-function before decision 0016): the winning ticket numbers of each tier, in the tiers' order.
 * "Without replacement by rejection sampling" means: draw a
 * ticket number uniformly, and draw again if it has already won. A tier takes
 * tickets until it is full or none is left; the tiers after an empty pool
 * get none.
 */
export function drawWinners(seed: Uint8Array, count: number, tiers: TierSpec[]): number[][] {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error(`A draw's ticket count must be a whole number from 0, got ${String(count)}.`);
  for (const spec of tiers) {
    if (!Number.isSafeInteger(spec.count) || spec.count < 0) throw new Error(`The ${spec.tier} tier's count must be a whole number from 0, got ${String(spec.count)}.`);
  }
  const next = counterStream(seed);
  const won = new Set<number>();
  return tiers.map((spec) => {
    const tickets: number[] = [];
    while (tickets.length < spec.count && won.size < count) {
      const ticket = uniform(next, count);
      if (won.has(ticket)) continue;
      won.add(ticket);
      tickets.push(ticket);
    }
    return tickets;
  });
}

/**
 * The raffle (lottery:jackpot-rolls-over before decision 0016): one jackpot, `midCount` mid prizes, and one small prize in every `smallEvery` tickets sold.
 * The page says at least one small place. With few tickets sold, and above all with the house top-up filling the
 * pot, one in fifty sold can make a small prize pay more than a mid one (₦41,250 against ₦16,500), so there are
 * never fewer small places than keep a small share under a mid share.
 */
export function tiersFor(count: number, tuning: RaffleSettings): TierSpec[] {
  return [
    { tier: "jackpot", count: 1 },
    { tier: "mid", count: tuning.midCount },
    { tier: "small", count: Math.max(1, divFloor(count, tuning.smallEvery), fewestSmall(tuning)) },
  ];
}

/** The fewest small places whose share is under a mid share: more than `midCount` times `smallBp` over `midBp`. */
function fewestSmall(tuning: RaffleSettings): number {
  return tuning.midBp === 0 ? 1 : divFloor(tuning.midCount * tuning.smallBp, tuning.midBp) + 1;
}

function shareBp(tier: Tier, tuning: RaffleSettings): number {
  switch (tier) {
    case "jackpot":
      return tuning.jackpotBp;
    case "mid":
      return tuning.midBp;
    case "small":
      return tuning.smallBp;
    default: {
      const never: never = tier;
      throw new Error(`Unknown tier ${String(never)}.`);
    }
  }
}

/**
 * The raffle (lottery:fixed-prizes-shared-jackpot before decision 0016): the prize fund and what each winning ticket is paid.
 * The fund is the pot times what is not burnt, rounded down; a tier's
 * share is split over the tickets its spec names, so the shares of places
 * left unfilled are destroyed with the rest.
 */
export function prizesFor(
  pot: number,
  tiers: TierSpec[],
  winners: number[][],
  tuning: RaffleSettings,
): { fund: number; winners: LotteryResult["winners"] } {
  const fund = mulDiv(pot, BP_WHOLE - tuning.burnBp, BP_WHOLE);
  return {
    fund,
    winners: tiers.map((spec, index) => ({
      tier: spec.tier,
      tickets: winners[index] ?? [],
      amount: spec.count === 0 ? 0 : mulDiv(fund, shareBp(spec.tier, tuning), BP_WHOLE * spec.count),
    })),
  };
}

/**
 * The raffle's house top-up (lottery:odds-fixed-at-draw-open before decision 0016): the top-up of a draw that sold `count` tickets under its
 * declared `topUpTickets`: the pot made up to that many tickets' worth, and 0
 * once sales reach it.
 */
export function topUpFor(count: number, topUpTickets: number, ticket: number): number {
  return Math.max(0, topUpTickets - count) * ticket;
}

/**
 * The raffle (lottery:expected-return-below-price before decision 0016): the part of a prize credited as `pot-top-up`: the prize times
 * the top-up over the pot, rounded down. An empty pot pays nothing, so its part is 0.
 */
export function topUpPart(amount: number, topUp: number, pot: number): number {
  return pot === 0 ? 0 : mulDiv(amount, topUp, pot);
}

/** The raffle's settings check, as the content check ran it before decision 0016: the three tiers share the whole fund, and the most the house adds is a whole number of kobo. */
export function raffleProblems(settings: RaffleSettings): string[] {
  const problems: string[] = [];
  const total = settings.jackpotBp + settings.midBp + settings.smallBp;
  if (total !== BP_WHOLE) problems.push(`The raffle's tiers' shares add up to ${String(total)}, not ${String(BP_WHOLE)}.`);
  if (!Number.isSafeInteger(settings.topUpTickets) || settings.topUpTickets < 0) {
    problems.push(`The raffle's topUpTickets is ${String(settings.topUpTickets)}, not a whole number from 0.`);
  } else if (!Number.isSafeInteger(settings.topUpTickets * settings.ticket)) {
    problems.push(`${String(settings.topUpTickets)} tickets' worth of top-up is past a whole number of kobo.`);
  }
  return problems;
}
