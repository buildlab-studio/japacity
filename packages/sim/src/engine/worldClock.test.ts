import { describe, expect, test } from "vitest";

import { divFloor } from "./int";
import { GAME_DAY_EPOCH_MS, GAME_DAY_MS, HOUR_MS } from "./time";
import { nextGameMorning, partOf, worldClockAt } from "./worldClock";

/** A real moment some game hours into a game day. */
const at = (day: number, hour: number) => GAME_DAY_EPOCH_MS + day * GAME_DAY_MS + divFloor(hour * GAME_DAY_MS, 24);

describe("the world's clock", () => {
  test("[R-CLOCK-033] given the epoch, when the clock is read, then it is midnight of day 0, a Friday, and night", () => {
    expect(worldClockAt(GAME_DAY_EPOCH_MS)).toMatchObject({ day: 0, minute: 0, weekday: 5, part: "night" });
  });

  test("[R-CLOCK-033] given a game day of an hour and three quarters, when the clock is read through it, then the parts come in order, the day and weekday move, and the day does not divide the real one", () => {
    expect(worldClockAt(at(0, 6))).toMatchObject({ minute: 360, part: "morning" });
    expect(worldClockAt(at(0, 12))).toMatchObject({ part: "afternoon" });
    expect(worldClockAt(at(0, 18))).toMatchObject({ part: "evening" });
    expect(worldClockAt(at(0, 22))).toMatchObject({ part: "night" });
    expect(worldClockAt(at(1, 9))).toMatchObject({ day: 1, weekday: 6, part: "morning" });
    expect(worldClockAt(at(2, 9))).toMatchObject({ day: 2, weekday: 0 });
    expect(GAME_DAY_MS).toBe(105 * 60 * 1000);
    // A game minute is a whole number of milliseconds, and a real day is not a whole number of game days (item 41).
    expect(GAME_DAY_MS % 1440).toBe(0);
    expect((24 * HOUR_MS) % GAME_DAY_MS).not.toBe(0);
  });

  test("[R-CLOCK-033] [R-CLOCK-032] given a moment, when the next morning is worked out, then it is six o'clock of this day if it is still to come, else the next day's", () => {
    expect(nextGameMorning(at(0, 2))).toBe(at(0, 6));
    expect(nextGameMorning(at(0, 6))).toBe(at(1, 6));
    expect(nextGameMorning(at(0, 23))).toBe(at(1, 6));
    expect(worldClockAt(at(0, 10)).morningAt).toBe(at(1, 6));
  });

  test("[R-CLOCK-033] given a moment before the epoch, when the clock is read, then it stands at the first midnight", () => {
    expect(worldClockAt(GAME_DAY_EPOCH_MS - HOUR_MS)).toMatchObject({ day: 0, minute: 0 });
    expect(partOf(5)).toBe("night");
  });
});
