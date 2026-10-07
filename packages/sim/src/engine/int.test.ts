import { describe, expect, test } from "vitest";

import {
  bp,
  clamp,
  convertMinor,
  divCeil,
  divFloor,
  koboToMinor,
  minorToKobo,
  mulDiv,
  mulDivCeil,
  roundDownTo,
  valueInKobo,
} from "./int";

const RATES = { GBP: 175800, USD: 133150 };

describe("[R-ENGINE-009] whole-number arithmetic", () => {
  test("[R-ENGINE-009] given a positive and a negative dividend, when divided with divFloor, then both round down", () => {
    expect(divFloor(7, 2)).toBe(3);
    expect(divFloor(-7, 2)).toBe(-4);
    expect(divFloor(6, 3)).toBe(2);
    expect(divFloor(0, 5)).toBe(0);
  });

  test("[R-ENGINE-009] given a positive and a negative dividend, when divided with divCeil, then both round up", () => {
    expect(divCeil(7, 2)).toBe(4);
    expect(divCeil(-7, 2)).toBe(-3);
    expect(divCeil(6, 3)).toBe(2);
  });

  test("[R-ENGINE-009] given a zero, negative or fractional divisor, when dividing, then it throws", () => {
    expect(() => divFloor(1, 0)).toThrow(/zero/);
    expect(() => divFloor(1, -2)).toThrow(/above zero/);
    expect(() => divFloor(1, 1.5)).toThrow(/whole/);
    expect(() => divFloor(1.5, 1)).toThrow(/whole/);
  });

  test("[R-ENGINE-009] given a product past 2^53, when mulDiv runs, then the answer is exact", () => {
    // The products here pass 2^53, so a float product would be inexact.
    expect(mulDiv(1000000000000000, 1000, 10000)).toBe(100000000000000);
    expect(mulDiv(9007199254740991, 1000, 1000)).toBe(9007199254740991);
    expect(mulDiv(9007199254740991, 3, 3)).toBe(9007199254740991);
    expect(mulDivCeil(9007199254740991, 999, 1000)).toBe(8998192055486251);
    expect(mulDiv(7, 3, 2)).toBe(10);
    expect(mulDivCeil(7, 3, 2)).toBe(11);
    expect(mulDiv(-7, 3, 2)).toBe(-11);
    expect(mulDivCeil(-7, 3, 2)).toBe(-10);
  });

  test("[R-ENGINE-009] given a result past the safe range, when mulDiv runs, then it throws", () => {
    expect(() => mulDiv(9007199254740991, 9007199254740991, 1)).toThrow(/safe whole number/);
  });

  test("[R-ENGINE-009] given an amount and basis points, when bp runs, then it rounds down", () => {
    expect(bp(1000, 150)).toBe(15);
    expect(bp(999, 150)).toBe(14);
    expect(bp(1000, 10000)).toBe(1000);
    expect(bp(1000, 0)).toBe(0);
  });

  test("[R-ENGINE-009] given bounds, when clamped, then the value stays inside them", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
    expect(() => clamp(1, 5, 0)).toThrow(/above max/);
  });

  test("[R-ENGINE-009] given a step, when rounded down, then the value is a multiple of it", () => {
    expect(roundDownTo(67, 5)).toBe(65);
    expect(roundDownTo(65, 5)).toBe(65);
    expect(roundDownTo(-1, 5)).toBe(-5);
  });

  test("[R-ENGINE-009] given pence and the pound rate, when converted, then kobo round down and back", () => {
    // £1 is 100 pence; at 175800 kobo a pound that is 175800 kobo.
    expect(minorToKobo(100, RATES.GBP)).toBe(175800);
    expect(koboToMinor(175800, RATES.GBP)).toBe(100);
    expect(koboToMinor(175799, RATES.GBP)).toBe(99);
    expect(valueInKobo(100, "GBP", RATES)).toBe(175800);
    expect(valueInKobo(500, "NGN", RATES)).toBe(500);
  });

  test("[R-ENGINE-009] given two currencies, when converted in one step, then it rounds down once", () => {
    expect(convertMinor(175800, "NGN", "GBP", RATES)).toBe(100);
    expect(convertMinor(100, "GBP", "NGN", RATES)).toBe(175800);
    expect(convertMinor(100, "GBP", "USD", RATES)).toBe(132);
    expect(convertMinor(42, "USD", "USD", RATES)).toBe(42);
  });
});
