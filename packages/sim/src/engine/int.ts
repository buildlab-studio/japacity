// Whole-number arithmetic. This is the one file in the simulation allowed to
// divide (engine:no-fractions-in-simulation). Every helper takes and returns safe integers and
// throws on anything else, so a fraction can never leak into the state.
//
// Money convention. A rate is kobo for one whole unit of a currency: GBP
// 175800 means one pound (100 pence) costs 175800 kobo. Naira is treated the
// same way with a fixed rate of 100, because one naira is 100 kobo. So every
// amount is in its currency's smallest unit (kobo, pence, cents), every
// currency has a rate, and one formula values or converts any pair:
//   kobo  = floor(minor * rate / 100)
//   minor = floor(kobo * 100 / rate)
//   pair  = floor(amount * rateFrom / rateTo)
import type { Currency, ForeignCurrency } from "./types";

/** Kobo in one naira. Also naira's rate in the convention above. */
export const KOBO_PER_NAIRA = 100;

/** Smallest units in one whole unit of every currency. */
export const MINOR_PER_UNIT = 100;

/** Basis points in a whole: 10000 is 100%. */
export const BP_WHOLE = 10000;

function assertInt(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${name} must be a whole number, got ${String(value)}.`);
  }
}

function assertDivisor(value: number, name: string): void {
  assertInt(value, name);
  if (value === 0) throw new Error(`Division by zero: ${name} is 0.`);
  if (value < 0) throw new Error(`${name} must be above zero, got ${String(value)}.`);
}

function assertResult(value: number, what: string): number {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${what} gives ${String(value)}, which is not a safe whole number.`);
  }
  // Normalise -0 so results compare and serialise the same everywhere.
  return value === 0 ? 0 : value;
}

/** a over b, rounded down (toward minus infinity). b must be above zero. */
export function divFloor(a: number, b: number): number {
  assertInt(a, "divFloor: a");
  assertDivisor(b, "divFloor: b");
  // `%` on whole numbers is exact, and a - r is an exact multiple of b, so
  // the division below is exact too.
  const r = a % b;
  const q = (a - r) / b;
  return assertResult(r < 0 ? q - 1 : q, "divFloor");
}

/** a over b, rounded up (toward plus infinity). b must be above zero. */
export function divCeil(a: number, b: number): number {
  assertInt(a, "divCeil: a");
  return assertResult(-divFloor(-a, b), "divCeil");
}

function bigDiv(product: bigint, divisor: bigint, up: boolean): bigint {
  const q = product / divisor;
  const r = product % divisor;
  if (r === 0n) return q;
  // BigInt division truncates toward zero.
  if (up) return product > 0n ? q + 1n : q;
  return product < 0n ? q - 1n : q;
}

function mulDivBy(a: number, b: number, c: number, up: boolean, name: string): number {
  assertInt(a, `${name}: a`);
  assertInt(b, `${name}: b`);
  assertDivisor(c, `${name}: c`);
  const product = a * b;
  if (Number.isSafeInteger(product)) return up ? divCeil(product, c) : divFloor(product, c);
  // Past 2^53 the float product is inexact, so do it in BigInt.
  const q = bigDiv(BigInt(a) * BigInt(b), BigInt(c), up);
  return assertResult(Number(q), name);
}

/** a times b over c, rounded down. Exact for any product, even past 2^53. */
export function mulDiv(a: number, b: number, c: number): number {
  return mulDivBy(a, b, c, false, "mulDiv");
}

/** a times b over c, rounded up. Exact for any product, even past 2^53. */
export function mulDivCeil(a: number, b: number, c: number): number {
  return mulDivBy(a, b, c, true, "mulDivCeil");
}

/** The given basis points of an amount, rounded down: bp(1000, 150) is 15. */
export function bp(amount: number, basisPoints: number): number {
  return mulDiv(amount, basisPoints, BP_WHOLE);
}

/** True for a safe integer, of any sign; anything else, a fraction or not a number at all, is not whole. */
export function isWhole(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/** n kept between min and max, both included. No rounding. */
export function clamp(n: number, min: number, max: number): number {
  assertInt(n, "clamp: n");
  assertInt(min, "clamp: min");
  assertInt(max, "clamp: max");
  if (min > max) throw new Error(`clamp: min ${String(min)} is above max ${String(max)}.`);
  return n < min ? min : n > max ? max : n;
}

/** n moved down to the nearest multiple of step (toward minus infinity). */
export function roundDownTo(n: number, step: number): number {
  return assertResult(divFloor(n, step) * step, "roundDownTo");
}

/** n moved up to the nearest multiple of step (toward plus infinity). */
export function roundUpTo(n: number, step: number): number {
  return assertResult(divCeil(n, step) * step, "roundUpTo");
}

/** The whole square root of n, rounded down: the largest r with r * r at most n. n must be zero or above. */
export function isqrt(n: number): number {
  assertInt(n, "isqrt: n");
  if (n < 0) throw new Error(`isqrt: n ${String(n)} is below zero.`);
  if (n < 2) return n;
  // Newton's steps from n itself (always at or above the root), in whole numbers, until they stop falling: about forty
  // steps for the largest safe whole number, and no floating-point root, so every device agrees (engine:no-fractions-in-simulation).
  let r = n;
  for (;;) {
    const next = divFloor(r + divFloor(n, r), 2);
    if (next >= r) break;
    r = next;
  }
  while (r * r > n) r -= 1;
  while ((r + 1) * (r + 1) <= n) r += 1;
  return assertResult(r, "isqrt");
}

/** The rate of any currency in kobo per whole unit. Naira is always 100. */
export function rateOf(currency: Currency, rates: Readonly<Record<ForeignCurrency, number>>): number {
  const rate = currency === "NGN" ? KOBO_PER_NAIRA : rates[currency];
  assertDivisor(rate, `rate for ${currency}`);
  return rate;
}

/** Smallest units of a currency to kobo, rounded down: pence to kobo is mulDiv(pence, rate, 100). */
export function minorToKobo(minor: number, rate: number): number {
  assertDivisor(rate, "minorToKobo: rate");
  return mulDiv(minor, rate, MINOR_PER_UNIT);
}

/** Kobo to the smallest units of a currency, rounded down: kobo to pence is mulDiv(kobo, 100, rate). */
export function koboToMinor(kobo: number, rate: number): number {
  assertDivisor(rate, "koboToMinor: rate");
  return mulDiv(kobo, MINOR_PER_UNIT, rate);
}

/** The value in kobo of an amount in any currency, rounded down. */
export function valueInKobo(amount: number, currency: Currency, rates: Readonly<Record<ForeignCurrency, number>>): number {
  return minorToKobo(amount, rateOf(currency, rates));
}

/**
 * An amount of one currency in another, in one step and rounded down once:
 * floor(amount * rateFrom / rateTo). Naira to naira, or a currency to itself,
 * gives the amount back unchanged. The wallet's rules on charges and on going
 * through naira are the wallet's business, not this helper's.
 */
export function convertMinor(
  amount: number,
  from: Currency,
  to: Currency,
  rates: Readonly<Record<ForeignCurrency, number>>,
): number {
  if (from === to) {
    assertInt(amount, "convertMinor: amount");
    return amount;
  }
  return mulDiv(amount, rateOf(from, rates), rateOf(to, rates));
}
