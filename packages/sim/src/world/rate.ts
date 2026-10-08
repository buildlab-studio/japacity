// The rates: docs/rules/rate.md. A recurrence on the rates of the tick before,
// stepped once a tick after the director, so the premium follows the supply the
// tick's stories left. Every tick after the first makes the same two draws on
// the `rate` stream, so the nth tick always reads the same positions.
import { BP_WHOLE, bp, divFloor, mulDiv } from "../engine/int";
import { createRandom } from "../engine/random";
import type { Content, ForeignCurrency, Id } from "../engine/types";
import type { WorldStream } from "./schedule";

export const FOREIGN: readonly ForeignCurrency[] = ["GBP", "USD", "CAD", "AED", "EUR"];

/** The story whose coming into force floats the naira (R-RATE-004). */
export const FLOAT_STORY: Id<"news"> = "news.naira-float";

/** How freely the banks have foreign currency. Its distance below 100 drives the premium (R-RATE-003). */
export const SUPPLY: Id<"var"> = "var.fx-supply";
const FULL_SUPPLY = 100;

/** The rates and the premium after a tick. The premium is kept because the street rate is derived from it. */
export interface RateBook {
  official: Record<ForeignCurrency, number>;
  street: Record<ForeignCurrency, number>;
  premiumBp: number;
}

/** A third of a whole number, rounded toward zero, so the premium never overshoots its target. */
function thirdTowardZero(n: number): number {
  return n < 0 ? -divFloor(-n, 3) : divFloor(n, 3);
}

function streetOf(official: number, premiumBp: number): number {
  return official + bp(official, premiumBp);
}

/** The rates at tick 0: the content's start and the premium's floor. */
export function openRates(content: Content): RateBook {
  const { rate } = content.tuning;
  const official = { ...rate.start };
  const premiumBp = rate.premiumFloorBp;
  const street = {} as Record<ForeignCurrency, number>;
  for (const currency of FOREIGN) street[currency] = streetOf(official[currency], premiumBp);
  return { official, street, premiumBp };
}

/**
 * The rates one tick on. `draws` is the world's draw-count table and is moved
 * on in place; `supply` is the variable after this tick's stories, or
 * undefined in content without it; `floats` is whether the float came into
 * force this tick.
 */
export function stepRates(before: RateBook, draws: Partial<Record<WorldStream, number>>, worldSeed: string, content: Content, supply: number | undefined, floats: boolean): RateBook {
  const { rate } = content.tuning;
  const random = createRandom<WorldStream>(worldSeed, draws);
  const official = { ...before.official };
  const street = { ...before.street };
  // Both draws are made every tick, float or not, so positions never shift.
  const noise = random.between("rate", -rate.noiseBp, rate.noiseBp);
  const premiumNoise = random.between("rate", -rate.premiumNoiseBp, rate.premiumNoiseBp);
  const factor = BP_WHOLE + rate.driftBp + noise;
  // Content without the supply variable (the engine's mini content) has no shortage to price.
  const target = rate.premiumFloorBp + rate.premiumPerSupplyBp * Math.max(0, FULL_SUPPLY - (supply ?? FULL_SUPPLY));
  let premiumBp = Math.max(rate.premiumFloorBp, before.premiumBp + thirdTowardZero(target - before.premiumBp) + premiumNoise);
  for (const currency of FOREIGN) {
    if (floats) {
      // R-RATE-004: the street rate stays where it was and the official rate jumps to meet it.
      // "where it was" is read as the street rate of the tick before, so the street
      // rate skips that tick's drift and noise; the official rate is that over 1.03, rounded down.
      official[currency] = Math.max(1, mulDiv(street[currency], BP_WHOLE, BP_WHOLE + rate.floatPremiumBp));
    } else {
      // Whole and above zero (R-RATE-005), whatever the factor.
      official[currency] = Math.max(1, mulDiv(official[currency], factor, BP_WHOLE));
      street[currency] = streetOf(official[currency], premiumBp);
    }
  }
  if (floats) premiumBp = rate.floatPremiumBp;
  return { official, street, premiumBp };
}
