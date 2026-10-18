import { time } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { productionConfig } from "../config";
import { drawToday, lagosDay, listOn, parseTodayList, recordSeen } from "./place.today";
import type { Seen, TodayList } from "./place.today";

const MAX = productionConfig.presence.todayMax;
/** Midnight in Lagos on 8 Oct 2026, which is 23:00 UTC on 8 Oct. */
const MIDNIGHT = Date.UTC(2026, 9, 8, 23);

function seen(index: number): Seen {
  return { name: `Name ${String(index)}`, look: `look-${String(index)}` };
}

function filled(count: number, day = 0): TodayList {
  let list: TodayList | undefined;
  for (let index = 0; index < count; index++) list = recordSeen(list, day, seen(index), MAX);
  return list ?? { day, seen: [] };
}

describe("the day's seen list", () => {
  test("[city:players-shown-present-not-tracked] given the last millisecond before Lagos midnight and midnight itself, when the day is read, then midnight starts the next day", () => {
    expect(lagosDay(MIDNIGHT) - lagosDay(MIDNIGHT - 1)).toBe(1);
    expect(lagosDay(MIDNIGHT + time.DAY_MS - 1)).toBe(lagosDay(MIDNIGHT));
    expect(lagosDay(Date.UTC(2026, 9, 9, 0))).toBe(lagosDay(MIDNIGHT));
  });

  test("[city:players-shown-present-not-tracked] given a list at todayMax and then one more, when each is recorded, then it holds todayMax and the oldest is dropped", () => {
    const atMax = filled(MAX);
    const over = recordSeen(atMax, 0, seen(MAX), MAX);

    expect(atMax.seen).toHaveLength(MAX);
    expect(atMax.seen[0]).toEqual(seen(0));
    expect(over.seen).toHaveLength(MAX);
    expect(over.seen[0]).toEqual(seen(1));
    expect(over.seen.at(-1)).toEqual(seen(MAX));
  });

  test("[city:players-shown-present-not-tracked] given a player already on the list, when they are seen again, then they are on it once, as the newest", () => {
    const list = recordSeen(filled(3), 0, seen(0), MAX);

    expect(list.seen).toEqual([seen(1), seen(2), seen(0)]);
  });

  test("[city:players-shown-present-not-tracked] given yesterday's list, when the day turns, then it reads empty and the next entry starts a new list", () => {
    const yesterday = filled(3, lagosDay(MIDNIGHT - 1));
    const today = lagosDay(MIDNIGHT);

    expect(listOn(yesterday, lagosDay(MIDNIGHT - 1))).toHaveLength(3);
    expect(listOn(yesterday, today)).toEqual([]);
    expect(recordSeen(yesterday, today, seen(9), MAX)).toEqual({ day: today, seen: [seen(9)] });
    expect(recordSeen(recordSeen(yesterday, today, seen(9), MAX), lagosDay(MIDNIGHT - 1), seen(8), MAX)).toEqual({ day: today, seen: [seen(9)] });
  });

  test("[city:players-shown-present-not-tracked] given a member with an account id, a place and a time, when they are recorded, then the list keeps only the name and the look", () => {
    const member = { account: "account-1", name: "Ada", look: "person_ada", place: "place.agege", joinedAt: 5, at: [1, 2] };

    expect(recordSeen(undefined, 0, member, MAX)).toEqual({ day: 0, seen: [{ name: "Ada", look: "person_ada" }] });
  });

  test("[city:players-shown-present-not-tracked] given what storage gave back, when it is read, then only a well-formed list is taken", () => {
    expect(parseTodayList(filled(2))).toEqual(filled(2));
    expect(parseTodayList(undefined)).toBeUndefined();
    expect(parseTodayList({ day: "0", seen: [] })).toBeUndefined();
    expect(parseTodayList({ day: 0, seen: [{ name: "Ada" }] })).toBeUndefined();
  });

  test("[city:players-shown-present-not-tracked] [clock:presence-is-a-sample] given a list and the members here now, when today is drawn, then no one here now is in it and it is at most the number asked", () => {
    const list = filled(10).seen;
    const here = [seen(2), seen(5)];

    for (const asked of [0, 1, 8, 9]) {
      const drawn = drawToday(list, here, asked, 7);
      expect(drawn).toHaveLength(Math.min(asked, 8));
      expect(drawn).not.toContainEqual(seen(2));
      expect(drawn).not.toContainEqual(seen(5));
      expect(new Set(drawn.map((each) => each.name)).size).toBe(drawn.length);
    }
    expect(drawToday(list, here, -1, 7)).toEqual([]);
  });

  test("[city:players-shown-present-not-tracked] [clock:presence-is-a-sample] given more on the list than asked, when today is drawn with different seeds, then the draws are not all the same", () => {
    const list = filled(MAX).seen;
    const draws = new Set([1, 2, 3, 4, 5].map((seed) => drawToday(list, [], 5, seed).map((each) => each.name).join(",")));

    expect(draws.size).toBeGreaterThan(1);
  });
});
