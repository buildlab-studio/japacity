// The Friday draw's public method: docs/rules/lottery.md R-LOTTERY-009 to 012.
// Pure code, so the server that runs the draw and the client page that checks
// it run the same function. SHA-256 is written out here because Web Crypto's
// digest is asynchronous and platform code (decision 0006).
import { BP_WHOLE, divFloor, mulDiv } from "../engine/int";
import type { Content, LotteryResult, Tuning } from "../engine/types";

export type Tier = "jackpot" | "mid" | "small";

/** One tier of a draw: how many tickets it pays, in the order the tiers are filled. */
export interface TierSpec {
  tier: Tier;
  count: number;
}

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
  return toHex(sha256(concat([fromHex(secret), drawBytes(draw)])));
}

/**
 * R-LOTTERY-008: the frozen list's SHA-256 in hex.
 * the hash of the tokens' bytes in ticket order, eight bytes each, so the client's draw page recomputes it the way the server made it.
 */
export function listHashOf(tokens: readonly string[]): string {
  return toHex(sha256(fromHex(tokens.join(""))));
}

/**
 * R-LOTTERY-009: the seed is the SHA-256 of the secret, the list's hash and the
 * beacon round's randomness, joined in that order.
 * each is given in hex and joined as the bytes the hex spells.
 */
export function drawSeed(secret: string, listHash: string, beaconRandomness: string): Uint8Array {
  return sha256(concat([fromHex(secret), fromHex(listHash), fromHex(beaconRandomness)]));
}

const TWO_TO_64 = 1n << 64n;

/** R-LOTTERY-010: block `i` is the SHA-256 of the seed and `i` as eight bytes, big end first, read as four 64-bit numbers. */
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
 * R-LOTTERY-010: the winning ticket numbers of each tier, in the tiers' order.
 * "without replacement by rejection sampling" is read as: draw a
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

/** R-LOTTERY-012: one jackpot, `midCount` mid prizes, and one small prize in every `smallEvery` tickets sold, at least one. */
export function tiersFor(count: number, tuning: Tuning["lottery"]): TierSpec[] {
  return [
    { tier: "jackpot", count: 1 },
    { tier: "mid", count: tuning.midCount },
    { tier: "small", count: Math.max(1, divFloor(count, tuning.smallEvery)) },
  ];
}

function shareBp(tier: Tier, tuning: Tuning["lottery"]): number {
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
 * R-LOTTERY-011: the prize fund and what each winning ticket is paid.
 * the fund is the pot times what is not burnt, rounded down; a tier's
 * share is split over the tickets its spec names, so the shares of places
 * left unfilled are destroyed with the rest.
 */
export function prizesFor(
  pot: number,
  tiers: TierSpec[],
  winners: number[][],
  tuning: Tuning["lottery"],
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

// ---------------------------------------------------------------------------
// The house top-up
// ---------------------------------------------------------------------------

/**
 * R-LOTTERY-021: the top-up of a draw that sold `count` tickets under its
 * declared `topUpTickets`: the pot made up to that many tickets' worth, and 0
 * once sales reach it.
 */
export function topUpFor(count: number, topUpTickets: number, ticket: number): number {
  return Math.max(0, topUpTickets - count) * ticket;
}

/**
 * R-LOTTERY-022: the part of a prize credited as `pot-top-up`: the prize times
 * the top-up over the pot, rounded down. An empty pot pays nothing, so its part is 0.
 */
export function topUpPart(amount: number, topUp: number, pot: number): number {
  return pot === 0 ? 0 : mulDiv(amount, topUp, pot);
}

/** Contract item 6: the three tiers share the whole prize fund, and the most the house can add is a whole number of kobo. For `checkContent`. */
export function checkLotteryContent(content: Content): string[] {
  const tuning = content.tuning.lottery;
  const problems: string[] = [];
  const total = tuning.jackpotBp + tuning.midBp + tuning.smallBp;
  if (total !== BP_WHOLE) problems.push(`tuning.lottery: the tiers' shares add up to ${String(total)}, not ${String(BP_WHOLE)} (R-LOTTERY-012).`);
  if (!Number.isSafeInteger(tuning.topUpTickets) || tuning.topUpTickets < 0) {
    problems.push(`tuning.lottery: topUpTickets is ${String(tuning.topUpTickets)}, not a whole number from 0 (R-LOTTERY-021).`);
  } else if (!Number.isSafeInteger(tuning.topUpTickets * tuning.ticket)) {
    problems.push(`tuning.lottery: ${String(tuning.topUpTickets)} tickets' worth of top-up is past a whole number of kobo (R-LOTTERY-021).`);
  }
  return problems;
}
