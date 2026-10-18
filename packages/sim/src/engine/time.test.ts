import { describe, expect, test } from "vitest";

import { DAY_MS, DAY_S, SECOND_MS, dayName, dayNumber, dayStart, utcDay } from "./time";

describe("UTC days", () => {
  test("[server:daily-money-report] given a moment, when its UTC day is read, then it is the whole days since 1970 and the day starts at its first millisecond", () => {
    expect(DAY_S * SECOND_MS).toBe(DAY_MS);
    expect(utcDay(0)).toBe(0);
    expect(utcDay(DAY_MS - 1)).toBe(0);
    expect(utcDay(DAY_MS)).toBe(1);
    expect(utcDay(-1)).toBe(-1);
    expect(dayStart(utcDay(1_791_568_800_000))).toBe(1_791_504_000_000);
  });

  test("[analytics:rows-stored-as-day-totals] given a UTC day number, when it is named, then it is its date as YYYY-MM-DD, leap days and centuries included", () => {
    const named: [number, string][] = [
      [0, "1970-01-01"],
      [-1, "1969-12-31"],
      [-719_528, "0000-01-01"],
      [10_956, "1999-12-31"],
      [11_016, "2000-02-29"],
      [20_744, "2026-10-18"],
      [47_540, "2100-02-28"],
      [47_541, "2100-03-01"],
      [2_932_896, "9999-12-31"],
    ];
    for (const [day, name] of named) {
      expect(dayName(day)).toBe(name);
      expect(dayNumber(name)).toBe(day);
    }
  });

  test("[analytics:rows-stored-as-day-totals] given text that is no real date, when its day number is read, then it is null", () => {
    for (const name of ["2026-02-29", "2100-02-29", "2026-02-30", "2026-04-31", "2026-13-01", "2026-00-10", "2026-10-00", "2026-1-01", "26-10-18", "2026-10-18T00:00:00Z", ""]) expect(dayNumber(name)).toBeNull();
    expect(dayNumber("2024-02-29")).toBe(19_782);
  });

  test("[analytics:rows-stored-as-day-totals] given every day from 1900 to 2200, when it is named and read back, then each date is the day after the one before", () => {
    let before = dayName(-25_567);
    expect(before).toBe("1900-01-01");
    expect(dayName(84_370)).toBe("2200-12-31");
    for (let day = -25_566; day <= 84_370; day += 1) {
      const name = dayName(day);
      expect(name > before).toBe(true);
      expect(dayNumber(name)).toBe(day);
      before = name;
    }
  });
});
