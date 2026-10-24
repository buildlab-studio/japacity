// The papers of a trade: document:trade-papers. The teaching registration asked for from the Papers app, and the chartered
// exams sat in three sittings six months apart. Real content, played through `step`.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Accepted, Id, SlotPick } from "../engine/types";
import { pointsScore } from "../route/gates/points";
import { applyEffects, slot } from "../testing/route.journey";
import type { Game } from "../testing/play";
import { start } from "../testing/play";
import { moneyOf, readOf } from "../testing/read";
import { setPockets } from "../testing/wallet";
import { CANADA_ROUTE, HUNT, REST } from "../testing/ids";

const TRCN: Id<"document"> = "document.trcn";
const ICAN: Id<"document"> = "document.ican";
const GET_TRCN: Id<"activity"> = "activity.get-trcn";
const EXAMS: Id<"activity"> = "activity.ican-exams";
const QUIZ: Id<"setpiece"> = "setpiece.ican-exam";

function month(game: Game, picks: SlotPick[] = []): Accepted {
  if (game.state.turn.banked < 1) game.grant(1);
  const free = game.view().freeSlots;
  const rests = Array.from({ length: Math.max(0, free - picks.length) }, () => slot(REST));
  return game.endTurn([...picks, ...rests]);
}

/** Answers the open sitting: right on the first `right` questions, wrong after. */
function sit(game: Game, right: number): void {
  const quiz = content.setpiece[QUIZ];
  if (quiz === undefined) throw new Error("No chartered exams quiz in content.");
  quiz.questions.forEach((question, index) => {
    const answer = question.answers.find((candidate) => (candidate.score > 0) === index < right);
    if (answer === undefined) throw new Error(`${question.id} has no answer to give.`);
    game.accept({ type: "setpiece/answer", question: question.id, answer: answer.id });
  });
  expect(game.state.setpiece.open).toBeNull();
}

/** Plays the exams' months up to the next sitting, which opens in its last month; returns that month. */
function toSitting(game: Game, monthsLeft: number): Accepted {
  let last: Accepted | undefined;
  for (let at = 0; at < monthsLeft; at += 1) last = month(game, [slot(EXAMS)]);
  if (last === undefined) throw new Error("No month was played.");
  return last;
}

describe("the teaching registration", () => {
  test("[document:trade-papers] given the registration, when its entries are read, then it waits two months, never expires, and costs ₦25,000 under fee-document for a bachelor's", () => {
    expect(content.document[TRCN]).toEqual({ id: TRCN, wait: [2, 2], validMonths: null, result: null });
    expect(content.activity[GET_TRCN]).toMatchObject({
      when: "now",
      cost: [{ currency: "NGN", amount: 25000_00, reason: "fee-document" }],
      effects: [{ type: "document/request", document: TRCN }],
    });
  });

  test("[document:trade-papers] [activity:each-trade-climbs-its-ladder] given the teacher of four years, when she registers and two months pass, then the registration is held and the senior teacher's rung is on her board", () => {
    const game = start({ content, scenario: "scenario.teacher" });
    const hunted = () => game.view().activities.find((option) => option.id === HUNT)?.params ?? [];
    expect(hunted()).not.toContain("activity.job-senior-teacher");
    game.accept({ type: "activity/now", activity: GET_TRCN, param: null });
    month(game);
    month(game);
    expect(game.state.document[TRCN]?.state).toBe("held");
    expect(hunted()).toContain("activity.job-senior-teacher");
    game.expectRejected({ type: "activity/now", activity: GET_TRCN, param: null }, "not-legal");
  });
});

describe("the chartered exams", () => {
  /** A graduate on the exams with money for every sitting. */
  function candidate(): Game {
    const game = start({ content, scenario: "scenario.graduate" });
    setPockets(game, { NGN: 1000000_00 });
    return game;
  }

  test("[document:trade-papers] given the exams held 18 months with every sitting passed, when the sittings come in the 6th, 12th and 18th months, then each is paid ₦50,000 under fee-test on the day, and passing the third gives the paper with no wait", () => {
    const game = candidate();
    for (const sitting of [1, 2, 3]) {
      const quiet = toSitting(game, 5);
      expect(moneyOf(quiet, "fee-test")).toEqual([]);
      const day = toSitting(game, 1);
      expect(moneyOf(day, "fee-test").map((event) => event.amount)).toEqual([50000_00]);
      expect(game.state.setpiece.open?.entry).toBe(QUIZ);
      sit(game, 2);
      expect({ sitting, held: game.state.document[ICAN]?.state ?? null }).toEqual({ sitting, held: sitting === 3 ? "pending" : null });
    }
    month(game);
    expect(game.state.document[ICAN]?.state).toBe("held");
    expect(content.document[ICAN]).toEqual({ id: ICAN, wait: [0, 0], validMonths: null, result: null });
    expect(game.view().activities.find((option) => option.id === EXAMS)?.allowed).toBe(false);
  });

  test("[document:trade-papers] given a failed sitting, when six more months of study pass, then it is sat again; one right of three is a fail", () => {
    const game = candidate();
    toSitting(game, 6);
    sit(game, 1);
    expect(game.state.activity.sittings?.[EXAMS] ?? 0).toBe(0);
    const again = toSitting(game, 6);
    expect(moneyOf(again, "fee-test").map((event) => event.amount)).toEqual([50000_00]);
    expect(game.state.setpiece.open?.entry).toBe(QUIZ);
    sit(game, 3);
    expect(game.state.activity.sittings?.[EXAMS]).toBe(1);
  });

  test("[document:trade-papers] given a sitting's month with no money for its fee, when the month is played, then nothing is paid and no sitting opens; it waits for the next", () => {
    const game = candidate();
    toSitting(game, 5);
    setPockets(game, { NGN: 0 });
    const day = month(game, [slot(EXAMS)]);
    expect(moneyOf(day, "fee-test")).toEqual([]);
    expect(game.state.setpiece.open).toBeNull();
    setPockets(game, { NGN: 1000000_00 });
    toSitting(game, 6);
    expect(game.state.setpiece.open?.entry).toBe(QUIZ);
  });

  test("[document:trade-papers] given the chartered paper, when Canada's points are read, then it adds nothing: the table reads degrees", () => {
    const game = candidate();
    const before = pointsScore(readOf(game), CANADA_ROUTE);
    applyEffects(game, [{ type: "document/grant", document: ICAN }]);
    expect(pointsScore(readOf(game), CANADA_ROUTE)).toBe(before);
  });
});
