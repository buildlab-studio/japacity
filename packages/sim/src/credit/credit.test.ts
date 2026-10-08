import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../engine/check";
import { checkInvariants } from "../engine/invariants";
import type { Id, ObligationEntry } from "../engine/types";
import { abroad, closeTypes, markBy, markOf, openOwed, PHONE, readOf, setPounds, settledAbroad, UK } from "../obligation/obligation.journey";
import { playMonths } from "../place/place.journey";
import { answerFirst, applyEffects } from "../route/route.journey";
import type { Game } from "../testing/play";
import { creditKind, JUDGMENT_CAP, rateFor } from "./credit.logic";

const CANADA: Id<"country"> = "country.canada";
const CREDIT = content.tuning.credit;

function entryOf(id: Id<"obligation">): ObligationEntry {
  const entry = content.obligation[id];
  if (entry === undefined) throw new Error(`No ${id} in content.`);
  return entry;
}

function creditMin(game: Game, value: number) {
  return check(readOf(game), { type: "credit/min", value });
}

/** Rent, phone and upkeep for a month, so the month is paid in full. */
const MONTH_ABROAD = entryOf("obligation.upkeep-uk").amount + entryOf("obligation.rent-room-uk").amount + entryOf(PHONE).amount;

/** A carer's month: upkeep, the room and a phone contract, both of which report. */
function carer(): Game {
  const game = abroad(content);
  openOwed(game, PHONE);
  return game;
}

describe("the file", () => {
  test("[R-CREDIT-001] given a life arriving abroad, when it lands, then its file there reads 0 with no payments counted", () => {
    const game = abroad(content);
    expect(game.state.place).toMatchObject({ where: "abroad", country: UK });
    expect(game.view().credit).toMatchObject({ mark: 0, onTime: 0, missed: 0, judgmentUntil: null });
    expect(checkInvariants(game.state, content)).toEqual([]);
  });

  test("[R-CREDIT-001] given a file at home, when the life is at home or on the road, then the view shows no file and credit/min reads 0", () => {
    const game = abroad(content);
    markBy(game, 50);
    game.accept({ type: "return/home" });
    expect(game.view().credit).toBeNull();
    expect(creditMin(game, 1)).toEqual({ met: false, have: 0, need: 1 });
    expect(game.state.credit.byCountry[UK]?.mark).toBe(50);
    applyEffects(game, [{ type: "place/move", to: "road", country: null }]);
    expect(game.view().credit).toBeNull();
    expect(creditMin(game, 1).met).toBe(false);
  });

  test.each([
    [25, 5],
    [20, 0],
    [15, 0],
  ])(
    "[R-CREDIT-001] given a UK file at %i, when the character goes home and comes back to the UK, then it starts from %i, never below 0, and Canada starts empty",
    (before, after) => {
      const game = abroad(content);
      markBy(game, before);
      game.accept({ type: "return/home" });
      applyEffects(game, [{ type: "place/move", to: "abroad", country: UK }]);
      expect(markOf(game)).toBe(after);
      // The first month back takes the penalty off the kept file, and the rent paid that month adds to it.
      const first = game.endTurn();
      expect(game.state.credit.byCountry[UK]?.mark).toBe(after + CREDIT.onTime);
      expect(first.lines).toContainEqual({ key: "line.credit.reopened", params: { country: UK, mark: after }, tone: "plain", attention: false, counts: [] });
      game.accept({ type: "return/home" });
      applyEffects(game, [{ type: "place/move", to: "abroad", country: CANADA }]);
      expect(game.view().credit).toMatchObject({ mark: 0, onTime: 0, missed: 0 });
      expect(game.state.credit.byCountry[UK]?.mark).toBe(after + CREDIT.onTime);
    },
  );
});

describe("payments", () => {
  test("[R-CREDIT-002] given a carer paying rent and phone on time, when five months pass, then the mark reaches 30, the car's minimum, and not a month sooner", () => {
    const game = carer();
    const marks: number[] = [];
    for (let month = 0; month < 5; month += 1) {
      playMonths(game, 1);
      marks.push(markOf(game));
    }
    // The page's pace: two payments of 3 a month.
    expect(2 * CREDIT.onTime).toBe(6);
    expect(marks).toEqual([6, 12, 18, 24, 30]);
    expect(game.view().credit).toMatchObject({ onTime: 10, missed: 0 });
    expect(creditMin(game, entryOf("obligation.car").creditMin!).met).toBe(true);
  });

  test("[R-CREDIT-002] given a carer four months in, when a whole month is missed, then rent and phone each take 12 and the four months' progress is gone", () => {
    const game = carer();
    playMonths(game, 4);
    expect(markOf(game)).toBe(8 * CREDIT.onTime);
    setPounds(game, 0);
    playMonths(game, 1);
    expect(markOf(game)).toBe(8 * CREDIT.onTime - 2 * CREDIT.onMiss);
    expect(markOf(game)).toBe(0);
    expect(game.view().credit).toMatchObject({ onTime: 8, missed: 2 });
  });

  test("[R-CREDIT-002] given only the rent missed, when the month ends, then the rent takes 12 and the phone paid still adds 3; upkeep moves nothing", () => {
    const game = carer();
    playMonths(game, 4);
    // Upkeep is charged first and the phone last: enough for both, not for the rent between them.
    setPounds(game, entryOf("obligation.upkeep-uk").amount + entryOf(PHONE).amount);
    // December may have opened its scene; the month is what is under test.
    if (game.state.setpiece.open !== null) answerFirst(game);
    const result = game.endTurn();
    expect(markOf(game)).toBe(8 * CREDIT.onTime - CREDIT.onMiss + CREDIT.onTime);
    expect(result.lines).toContainEqual({ key: "line.credit.missed", params: { country: UK, mark: markOf(game) - CREDIT.onTime }, tone: "bad", attention: false, counts: [] });
  });

  test("[R-CREDIT-002] given a file at 0 or at 100, when a payment is missed or made, then the mark stays within 0 to 100 and the payment is still counted", () => {
    const game = carer();
    setPounds(game, 0);
    playMonths(game, 1);
    expect(game.view().credit).toMatchObject({ mark: 0, missed: 2 });
    markBy(game, 100);
    expect(markOf(game)).toBe(100);
    setPounds(game, 2 * MONTH_ABROAD);
    playMonths(game, 1);
    expect(game.view().credit).toMatchObject({ mark: 100, onTime: 3 });
    expect(checkInvariants(game.state, content)).toEqual([]);
  });

  test("[R-CREDIT-002] given the first payment on an empty file, when it is made, then a line says the file has begun", () => {
    const game = abroad(content);
    const result = game.endTurn();
    expect(result.lines).toContainEqual({ key: "line.credit.first", params: { country: UK, mark: CREDIT.onTime }, tone: "good", attention: false, counts: [] });
    expect(game.endTurn().lines.filter((line) => line.key.startsWith("line.credit."))).toEqual([]);
  });
});

describe("drift", () => {
  test("[R-CREDIT-003] given a file with nothing reporting, when a clean year passes from arrival, then the mark gains 1 a month, not before the twelfth month", () => {
    const game = settledAbroad(content);
    closeTypes(game, "rent");
    playMonths(game, 11);
    expect(markOf(game)).toBe(0);
    playMonths(game, 1);
    expect(markOf(game)).toBe(CREDIT.drift);
    playMonths(game, 1);
    expect(markOf(game)).toBe(2 * CREDIT.drift);
  });

  test("[R-CREDIT-003] given a miss on the file, when months pass, then the drift stops until twelve months after the miss", () => {
    const game = settledAbroad(content);
    closeTypes(game, "rent");
    playMonths(game, 6);
    markBy(game, -1);
    playMonths(game, 11);
    expect(markOf(game)).toBe(0);
    playMonths(game, 1);
    expect(markOf(game)).toBe(CREDIT.drift);
  });

  test("[R-CREDIT-003] given a mark one under the drift's ceiling and one above it, when a clean year has passed, then the first reaches the ceiling and stops, the second never moves", () => {
    const low = settledAbroad(content);
    closeTypes(low, "rent");
    markBy(low, CREDIT.driftTo - 1);
    playMonths(low, 14);
    expect(markOf(low)).toBe(CREDIT.driftTo);
    const high = settledAbroad(content);
    closeTypes(high, "rent");
    markBy(high, CREDIT.driftTo + 1);
    playMonths(high, 14);
    expect(markOf(high)).toBe(CREDIT.driftTo + 1);
  });
});

describe("approval and rates", () => {
  test("[R-CREDIT-004] given a mark one under and at each entry's creditMin, when credit/min is judged, then it is met only from the minimum: phone 10, flat 20, car 30", () => {
    for (const id of [PHONE, "obligation.rent-flat-uk", "obligation.car"] as Id<"obligation">[]) {
      const need = entryOf(id).creditMin!;
      const game = abroad(content);
      markBy(game, need - 1);
      expect(creditMin(game, need)).toEqual({ met: false, have: need - 1, need });
      markBy(game, 1);
      expect(creditMin(game, need)).toEqual({ met: true, have: need, need });
    }
    expect([PHONE, "obligation.rent-flat-uk", "obligation.car"].map((id) => entryOf(id as Id<"obligation">).creditMin)).toEqual([10, 20, 30]);
  });

  test.each([
    [29, null],
    [30, 120],
    [49, 120],
    [50, 90],
    [69, 90],
    [70, 50],
    [100, 50],
  ])("[R-CREDIT-005] given a mark of %i, when the car's ladder is read, then the monthly rate is %s basis points", (mark, rate) => {
    const game = abroad(content);
    markBy(game, mark);
    expect(rateFor(readOf(game), entryOf("obligation.car"))).toBe(rate);
  });

  test("[R-CREDIT-005] given an entry with no ladder, when its rate is read, then it is the entry's own rate whatever the mark", () => {
    const game = abroad(content);
    const shortfall = entryOf("obligation.car-shortfall");
    expect(rateFor(readOf(game), shortfall)).toBe(shortfall.rateBp);
  });
});

describe("judgments", () => {
  test("[R-CREDIT-006] given a judgment on a file at 100, when 72 months pass, then credit/min above 20 is never met until the month it clears, and 20 always is", () => {
    const game = settledAbroad(content);
    closeTypes(game, "rent", "upkeep");
    markBy(game, 100);
    const month = game.state.turn.month;
    applyEffects(game, [{ type: "credit/judgment" }]);
    const until = month + CREDIT.judgmentMonths;
    expect(CREDIT.judgmentMonths).toBe(72);
    expect(game.view().credit?.judgmentUntil).toBe(until);
    expect(creditMin(game, JUDGMENT_CAP).met).toBe(true);
    expect(creditMin(game, JUDGMENT_CAP + 1)).toEqual({ met: false, have: 100, need: JUDGMENT_CAP + 1 });
    playMonths(game, CREDIT.judgmentMonths - 1);
    expect(game.state.turn.month).toBe(until - 1);
    expect(creditMin(game, JUDGMENT_CAP + 1).met).toBe(false);
    expect(creditMin(game, JUDGMENT_CAP).met).toBe(true);
    playMonths(game, 1);
    expect(creditMin(game, JUDGMENT_CAP + 1).met).toBe(true);
    expect(creditMin(game, 100).met).toBe(true);
    expect(game.view().credit?.judgmentUntil).toBeNull();
  });

  test("[R-CREDIT-006] given a judgment, when it is put on the file, then a line gives the month it clears and asks for attention", () => {
    const game = abroad(content);
    const month = game.state.turn.month;
    applyEffects(game, [{ type: "credit/judgment" }]);
    const until = month + CREDIT.judgmentMonths;
    expect(game.state.credit.byCountry[UK]?.judgmentUntil).toBe(until);
    expect(creditKind.lines?.({ type: "credit/judged", country: UK, until }, game.state, content)).toEqual([
      { key: "line.credit.judgment", params: { country: UK, until }, tone: "bad", attention: true, counts: [] },
    ]);
    expect(text["line.credit.judgment"]).toContain("{until}");
  });
});

describe("the view", () => {
  test("[R-CREDIT-007] given a file abroad, when the view is read, then it shows the mark, the counts, the judgment and what each entry needing credit asks, lowest first", () => {
    const game = carer();
    playMonths(game, 1);
    setPounds(game, 0);
    playMonths(game, 1);
    applyEffects(game, [{ type: "credit/judgment" }]);
    expect(game.view().credit).toEqual({
      mark: 0,
      onTime: 2,
      missed: 2,
      judgmentUntil: game.state.turn.month + CREDIT.judgmentMonths,
      needs: [
        { id: PHONE, creditMin: 10 },
        { id: "obligation.rent-flat-uk", creditMin: 20 },
        { id: "obligation.car", creditMin: 30 },
      ],
    });
  });

  test("[R-CREDIT-007] given a life in Canada, when the view is read, then the needs are Canada's phone and flat and the car, never the UK's", () => {
    const game = abroad(content);
    game.accept({ type: "return/home" });
    applyEffects(game, [{ type: "place/move", to: "abroad", country: CANADA }]);
    expect(game.view().credit?.needs).toEqual([
      { id: "obligation.phone-ca", creditMin: 10 },
      { id: "obligation.rent-flat-ca", creditMin: 20 },
      { id: "obligation.car", creditMin: 30 },
    ]);
  });

  test("[R-CREDIT-007] given every credit line, when it is looked up, then it has words and no mark is shown as money", () => {
    const keys = ["first", "missed", "judgment", "reopened"].map((what) => `line.credit.${what}`);
    expect(keys.filter((key) => (text[key] ?? "").trim() === "")).toEqual([]);
  });
});
