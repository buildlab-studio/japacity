// The month's name and phase the band carries (docs/rules/world.md R-WORLD-002; turn.md R-TURN-010; decision 0034):
// month 0 of a life is the month of the year it began in, in Lagos; the phase is the month's free time spent, in
// words only, never a count or a percentage.
import { describe, expect, test } from "vitest";

import { monthIndexOf, monthNameOf, phaseOf, phaseWords } from "./monthName";

/** Noon on 15 March 2026, Lagos. */
const MARCH = Date.UTC(2026, 2, 15, 11);

describe("the month's name", () => {
  test("[R-WORLD-002] given a life begun in March, when the month's name is read at months 0, 1 and 10, then it is March, April and January, and the year turns over after December", () => {
    expect(monthNameOf(MARCH, 0)).toBe("March");
    expect(monthNameOf(MARCH, 1)).toBe("April");
    expect(monthNameOf(MARCH, 10)).toBe("January");
    // Two years on, the months still run: month 22 is January, 23 February.
    expect([monthIndexOf(MARCH, 22), monthIndexOf(MARCH, 23)]).toEqual([0, 1]);
  });

  test("[R-WORLD-002] given a life begun at half past eleven at night on the last day of March by the world's clock, when the month's name is read, then it is April: the month is Lagos's", () => {
    expect(monthNameOf(Date.UTC(2026, 2, 31, 23, 30), 0)).toBe("April");
  });

  test("[R-WORLD-002] given every month of the year, then each has its name in words, none a key or a number", () => {
    const names = Array.from({ length: 12 }, (_, month) => monthNameOf(Date.UTC(2026, 0, 15, 11), month));
    expect(names).toEqual(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]);
  });
});

describe("the month's phase", () => {
  test("[R-TURN-010] given the month's free time, when its phase is read at each edge, then it is Early below a third, Mid below two thirds, Late below the whole and Month end at the whole", () => {
    expect(phaseOf({ spent: 0, free: 60 })).toBe("early");
    expect(phaseOf({ spent: 19, free: 60 })).toBe("early");
    expect(phaseOf({ spent: 20, free: 60 })).toBe("mid");
    expect(phaseOf({ spent: 39, free: 60 })).toBe("mid");
    expect(phaseOf({ spent: 40, free: 60 })).toBe("late");
    expect(phaseOf({ spent: 59, free: 60 })).toBe("late");
    expect(phaseOf({ spent: 60, free: 60 })).toBe("end");
    // A worker's month of 20 half-days.
    expect(phaseOf({ spent: 6, free: 20 })).toBe("early");
    expect(phaseOf({ spent: 7, free: 20 })).toBe("mid");
    expect(phaseOf({ spent: 14, free: 20 })).toBe("late");
    expect(phaseOf({ spent: 20, free: 20 })).toBe("end");
    // A month with no free time at all is at its end.
    expect(phaseOf({ spent: 0, free: 0 })).toBe("end");
  });

  test("[R-TURN-010] given each phase, when it is said, then it is Early, Mid, Late or Month end, and never a digit or a percentage", () => {
    expect([phaseWords("early"), phaseWords("mid"), phaseWords("late"), phaseWords("end")]).toEqual(["Early", "Mid", "Late", "Month end"]);
    for (const phase of ["early", "mid", "late", "end"] as const) expect(phaseWords(phase)).not.toMatch(/[\d%]/);
  });
});
