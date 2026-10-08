import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../engine/check";
import { step } from "../engine/step";
import type { Id, ReadCtx } from "../engine/types";
import type { Game } from "../testing/play";
import { legalCommands } from "../testing/legal";
import { NORTHGATE, UK, UNIT, applyEffects, answerFirst, draw, drawnQuestions, readyLife, seedWhere, toApplied, toHeld, uk } from "../route/route.journey";
import type { LifeOptions } from "../route/route.journey";
import { fundsRequired, offerChanceBp, unexplainedBp } from "../route/route.logic";
import { mulDivCeil } from "../engine/int";
import { answerScore } from "./setpiece.logic";

const INTERVIEW: Id<"setpiece"> = "setpiece.credibility-interview";
const entry = content.setpiece[INTERVIEW]!;
const PREP: Id<"quality"> = "quality.interview-prep";
const hintPrep = content.tuning.route.hintPrep;
/** Every question in content order, and those asked of a clean file: the deposit question needs over 30% unexplained. */
const ALL = entry.questions.map((question) => question.id);
const CLEAN = ALL.filter((id) => id !== "deposit");

const northgateOffers = (seed: string) => draw(seed, "school", 1, 10000) < offerChanceBp(content.school[NORTHGATE]!, 4, content.tuning.route);

function life(options: LifeOptions = {}): Game {
  return readyLife(content, { seed: seedWhere(northgateOffers), ...options });
}

function readOf(game: Game): ReadCtx {
  return { state: game.state, world: game.world(), content: game.content };
}

/** The score of an answer as the page's table gives it, for interview prep and the unexplained share. */
function pageScore(question: string, answer: string, prep: number, unexplained: number): number {
  const table: Record<string, number> = {
    "why-uk.course": prep >= 20 ? 2 : 0,
    "why-uk.better": -1,
    "why-uk.agent": -2,
    "who-pays.own": unexplained <= 2000 ? 2 : -2,
    "who-pays.lender": 0,
    "who-pays.sponsor": -1,
    "after.return": 2,
    "after.undecided": -1,
    "after.stay": -2,
    "course.detail": prep >= 40 ? 2 : -1,
    "course.brief": 0,
    "deposit.agreement": 0,
    "deposit.gift": -2,
    "deposit.savings": -2,
    "living.figures": prep >= 20 ? 1 : -1,
    "living.sort": -1,
  };
  const score = table[`${question}.${answer}`];
  if (score === undefined) throw new Error(`No answer ${question}.${answer}.`);
  return score;
}

/** Answers every open question with the answer `pick` names, and returns the page's total for those answers. */
function answerWith(game: Game, pick: (question: string, answers: string[]) => string, prep: number, unexplained: number): number {
  let total = 0;
  for (let guard = 0; guard < 10; guard += 1) {
    const question = game.view().setpiece?.question;
    if (question === undefined || question === null) return total;
    const answer = pick(question.id, question.answers);
    total += pageScore(question.id, answer, prep, unexplained);
    game.accept({ type: "setpiece/answer", question: question.id, answer });
  }
  throw new Error("The set piece did not close.");
}

describe("opening the interview", () => {
  test("[R-SETPIECE-001] given a clean file, when the application goes in, then as many questions as the entry asks are drawn on visa, without repeats, in the order drawn", () => {
    for (const index of [0, 1, 2, 3]) {
      const seed = seedWhere((candidate) => northgateOffers(candidate) && Number(candidate.slice(5)) >= index * 7);
      const game = life({ seed });
      toApplied(game);
      const open = game.state.setpiece.open!;
      expect(open.questions).toHaveLength(entry.ask);
      expect(new Set(open.questions).size).toBe(entry.ask);
      expect(open.questions).toEqual(drawnQuestions(seed, CLEAN, entry.ask));
      expect(open).toMatchObject({ entry: INTERVIEW, route: UK, answers: {} });
      expect(game.state.draws.visa).toBe(entry.ask);
    }
  });

  test("[R-SETPIECE-001] given a share of unexplained money above 30%, when the application goes in, then the deposit question may be drawn too", () => {
    const seed = seedWhere((candidate) => northgateOffers(candidate) && drawnQuestions(candidate, ALL, entry.ask).includes("deposit"));
    const game = life({ seed, pockets: { NGN: { bank: 1000000 * UNIT, cash: 40000000 * UNIT }, GBP: { bank: 40000 * UNIT, cash: 0 } } });
    toHeld(game);
    // Upkeep is taken from cash first each month, so what is banked is the cash that is left.
    game.accept({ type: "wallet/move", currency: "NGN", amount: game.state.wallet.pockets.NGN.cash, to: "bank" });
    expect(unexplainedBp(readOf(game), UK)).toBeGreaterThan(3000);
    game.endTurn([{ activity: "activity.apply-for-visa", param: null }]);
    expect(game.state.setpiece.open?.questions).toEqual(drawnQuestions(seed, ALL, entry.ask));
    expect(game.state.setpiece.open?.questions).toContain("deposit");
  });

  test("[R-SETPIECE-001] given a clean file, when many applications go in, then the deposit question is never asked", () => {
    for (let i = 0; i < 12; i += 1) {
      const seed = seedWhere((candidate) => northgateOffers(candidate) && Number(candidate.slice(5)) >= i);
      const game = life({ seed });
      toApplied(game);
      expect(game.state.setpiece.open?.questions).not.toContain("deposit");
    }
  });
});

describe("while the interview is open", () => {
  test("[R-SETPIECE-002] given an open interview, when the turn is ended, then it is rejected with setpiece-open, while other commands work as usual", () => {
    const game = life();
    toApplied(game);
    game.expectRejected({ type: "turn/end", slots: [] }, "setpiece-open");
    game.accept({ type: "wallet/move", currency: "NGN", amount: 100 * UNIT, to: "cash" });
    expect(legalCommands(game.view()).filter((command) => command.type === "turn/end")).toEqual([]);
    expect(legalCommands(game.view()).filter((command) => command.type === "setpiece/answer").length).toBeGreaterThan(0);
    answerFirst(game);
    game.endTurn();
    expect(game.state.turn.month).toBeGreaterThan(0);
  });

  test("[R-ENGINE-011] given an open interview and no turn banked, when each question comes up, then the view offers answers, every one offered is accepted by step, and answering closes it", () => {
    // A first life finds how many months the file takes; the second banks exactly that many turns and one for the application.
    const trial = life();
    toHeld(trial);
    const months = trial.state.turn.month + 1;
    const game = life({ change: (used) => ({ ...used, tuning: { ...used.tuning, turn: { ...used.tuning.turn, start: months } } }) });
    toApplied(game);
    expect(game.state.turn.banked).toBe(0);
    expect(game.view().turns.banked).toBe(0);
    for (let guard = 0; guard < 10 && game.state.setpiece.open !== null; guard += 1) {
      const answers = legalCommands(game.view()).filter((command) => command.type === "setpiece/answer");
      expect(answers.length).toBeGreaterThan(0);
      for (const command of answers) {
        const tried = step(game.state, { ...command, basedOn: game.state.v }, game.world(), game.content);
        expect(tried.ok).toBe(true);
      }
      game.accept(answers[0]!);
    }
    expect(game.state.setpiece.open).toBeNull();
  });

  test("[R-SETPIECE-003] given an open interview, when a later question, an unknown answer or nothing open is answered, then it is rejected with not-legal", () => {
    const game = life();
    game.expectRejected({ type: "setpiece/answer", question: "why-uk", answer: "course" }, "not-legal");
    toApplied(game);
    const [first, second] = game.state.setpiece.open!.questions as [string, string];
    const firstEntry = entry.questions.find((question) => question.id === first)!;
    const secondEntry = entry.questions.find((question) => question.id === second)!;
    game.expectRejected({ type: "setpiece/answer", question: second, answer: secondEntry.answers[0]!.id }, "not-legal");
    game.expectRejected({ type: "setpiece/answer", question: first, answer: "nonsense" }, "not-legal");
    game.expectRejected({ type: "setpiece/answer", question: first, answer: secondEntry.answers.find((a) => !firstEntry.answers.some((b) => b.id === a.id))?.id ?? "x" }, "not-legal");
    game.accept({ type: "setpiece/answer", question: first, answer: firstEntry.answers[0]!.id });
    expect(game.state.setpiece.open?.answers).toEqual({ [first]: firstEntry.answers[0]!.id });
    expect(game.view().setpiece).toMatchObject({ asked: 1, question: { id: second } });
    game.expectRejected({ type: "setpiece/answer", question: first, answer: firstEntry.answers[0]!.id }, "not-legal");
  });
});

describe("scoring", () => {
  test("[R-SETPIECE-004] given an answer and the conditions of its other score, when it is scored, then it gives the other score only when they all hold", () => {
    const course = entry.questions.find((question) => question.id === "why-uk")!.answers.find((answer) => answer.id === "course")!;
    expect(answerScore(course, () => ({ met: true }))).toBe(course.thenScore);
    expect(answerScore(course, () => ({ met: false }))).toBe(course.score);
    const plain = { id: "plain", score: -1, when: [], thenScore: null, effects: [] };
    expect(answerScore(plain, () => ({ met: true }))).toBe(-1);
  });

  test("[R-SETPIECE-004] given interview prep at each edge, when every question is answered with its first answer, then the sum the page gives is recorded on the visa application and the interview closes", () => {
    for (const prep of [0, 19, 20, 39, 40]) {
      const game = life({ qualities: { [PREP]: prep } });
      toApplied(game);
      const total = answerWith(game, (_question, answers) => answers[0]!, prep, 0);
      expect(game.state.setpiece.open).toBeNull();
      expect(uk(game).visa?.interviewScore).toBe(total);
    }
  });

  test("[R-SETPIECE-004] given money from flagged sources over 20% of what is needed, when the student says they pay from savings, then that answer scores against them", () => {
    const seed = seedWhere((candidate) => northgateOffers(candidate) && drawnQuestions(candidate, CLEAN, entry.ask).includes("who-pays"));
    const game = life({ seed, pockets: { NGN: { bank: 1000000 * UNIT, cash: 30000000 * UNIT }, GBP: { bank: 40000 * UNIT, cash: 0 } } });
    toHeld(game);
    game.accept({ type: "wallet/move", currency: "NGN", amount: 11000000 * UNIT, to: "bank" });
    const share = unexplainedBp(readOf(game), UK);
    expect(share).toBeGreaterThan(2000);
    expect(share).toBeLessThanOrEqual(3000);
    game.endTurn([{ activity: "activity.apply-for-visa", param: null }]);
    expect(game.state.setpiece.open?.questions).toEqual(drawnQuestions(seed, CLEAN, entry.ask));
    const total = answerWith(game, (question, answers) => (question === "who-pays" ? "own" : answers[0]!), 0, share);
    expect(uk(game).visa?.interviewScore).toBe(total);
    expect(check(readOf(game), { type: "route/unexplained-max", route: UK, bp: 2000 }).met).toBe(false);
  });

  /** A life rich in cash, so a cash move into the bank can make a lot of any size. */
  const CASH_RICH = { NGN: { bank: 1000000 * UNIT, cash: 30000000 * UNIT }, GBP: { bank: 40000 * UNIT, cash: 0 } };

  /** Moves into the bank the least naira cash that makes the unexplained share exactly `target` basis points (R-ROUTE-013). */
  function lotTo(game: Game, target: number): void {
    const required = fundsRequired(readOf(game), UK);
    const pence = mulDivCeil(target, required, 10000);
    const kobo = mulDivCeil(pence, game.world().rates.GBP.official, UNIT);
    game.accept({ type: "wallet/move", currency: "NGN", amount: kobo, to: "bank" });
    expect(unexplainedBp(readOf(game), UK)).toBe(target);
  }

  /** Answers every open question, `who-pays` with `own` and the rest with their first answer, with `between` run after `who-pays`. */
  function answerOwn(game: Game, between: () => void = () => undefined): void {
    for (let guard = 0; guard < 10; guard += 1) {
      const question = game.view().setpiece?.question;
      if (question === undefined || question === null) return;
      const own = question.id === "who-pays";
      game.accept({ type: "setpiece/answer", question: question.id, answer: own ? "own" : question.answers[0]! });
      if (own) between();
    }
    throw new Error("The set piece did not close.");
  }

  test("[R-SETPIECE-004] given a clean file, when a cash lot is made between two answers, then each answer keeps the score it was judged at when given, and the running sum is what is recorded", () => {
    const seed = seedWhere((candidate) => {
      if (!northgateOffers(candidate)) return false;
      const asked = drawnQuestions(candidate, CLEAN, entry.ask);
      return asked.includes("who-pays") && asked.indexOf("who-pays") < entry.ask - 1;
    });
    const game = life({ seed, qualities: { [PREP]: 0 }, pockets: CASH_RICH });
    toApplied(game);
    const asked = game.state.setpiece.open!.questions;
    const expected = asked.reduce((sum, id) => sum + (id === "who-pays" ? 2 : pageScore(id, entry.questions.find((question) => question.id === id)!.answers[0]!.id, 0, 0)), 0);
    answerOwn(game, () => {
      expect(game.state.setpiece.open?.score).toBe(asked.slice(0, asked.indexOf("who-pays") + 1).reduce((sum, id) => sum + (id === "who-pays" ? 2 : pageScore(id, entry.questions.find((question) => question.id === id)!.answers[0]!.id, 0, 0)), 0));
      lotTo(game, 2500);
    });
    expect(unexplainedBp(readOf(game), UK)).toBeGreaterThan(2000);
    expect(game.state.setpiece.open).toBeNull();
    expect(uk(game).visa?.interviewScore).toBe(expected);
  });

  test("[R-SETPIECE-004] given an unexplained share of 2000 and of 2001 basis points when who-pays is answered, when the student says own, then it scores +2 at 2000 and -2 at 2001", () => {
    const seed = seedWhere((candidate) => northgateOffers(candidate) && drawnQuestions(candidate, CLEAN, entry.ask).includes("who-pays"));
    for (const [share, own] of [
      [2000, 2],
      [2001, -2],
    ] as const) {
      const game = life({ seed, qualities: { [PREP]: 0 }, pockets: CASH_RICH });
      toApplied(game);
      lotTo(game, share);
      const asked = game.state.setpiece.open!.questions;
      const others = asked.filter((id) => id !== "who-pays").reduce((sum, id) => sum + pageScore(id, entry.questions.find((question) => question.id === id)!.answers[0]!.id, 0, share), 0);
      answerOwn(game);
      expect(uk(game).visa?.interviewScore).toBe(others + own);
    }
  });

  test("[R-SETPIECE-004] given the interview closes, when the last answer is given, then the closing is told without a score, and a score with no open application changes nothing", () => {
    const game = life();
    toApplied(game);
    const questions = game.state.setpiece.open!.questions;
    let last: ReturnType<Game["accept"]> | null = null;
    for (const id of questions) {
      const answer = entry.questions.find((question) => question.id === id)!.answers[0]!.id;
      last = game.accept({ type: "setpiece/answer", question: id, answer });
    }
    expect(last?.lines).toEqual([{ key: "line.setpiece.closed", params: { setpiece: INTERVIEW }, tone: "plain", attention: false, counts: [] }]);
    expect(last?.events.map((event) => event.type)).toEqual(["setpiece/answered", "setpiece/closed", "route/interview-scored", "engine/stepped"]);
    const fresh = life();
    applyEffects(fresh, [{ type: "route/interview-scored", route: UK, score: 5 }]);
    expect(uk(fresh).visa).toBeNull();
  });
});

describe("what the player sees", () => {
  test("[R-SETPIECE-005] given an open interview, when the view is read, then it shows one question with its answers and nothing that is a score", () => {
    const game = life();
    toApplied(game);
    const view = game.view().setpiece!;
    const first = game.state.setpiece.open!.questions[0]!;
    expect(view).toEqual({
      entry: INTERVIEW,
      asked: 0,
      total: entry.ask,
      question: { id: first, answers: entry.questions.find((question) => question.id === first)!.answers.map((answer) => answer.id), weak: [] },
    });
    expect(JSON.stringify(game.view()).toLowerCase()).not.toContain("score");
  });

  test("[R-SETPIECE-005] given interview prep one under the hint and at it, when the view is read, then weak answers are marked only at the hint, and they are those scoring below zero now", () => {
    for (const prep of [hintPrep - 1, hintPrep]) {
      const game = life({ qualities: { [PREP]: prep } });
      toApplied(game);
      for (let guard = 0; guard < entry.ask; guard += 1) {
        const question = game.view().setpiece!.question!;
        const weak = question.answers.filter((answer) => pageScore(question.id, answer, prep, 0) < 0);
        expect(question.weak).toEqual(prep >= hintPrep ? weak : []);
        game.accept({ type: "setpiece/answer", question: question.id, answer: question.answers[0]! });
      }
    }
    expect(hintPrep).toBe(40);
  });
});

describe("answers with effects, and set pieces with no route", () => {
  const WELLBEING: Id<"quality"> = "quality.wellbeing";

  test("[R-SETPIECE-006] given an answer carrying an effect, when it is given, then the effect applies at that moment under the set piece as source, and the close counts once", () => {
    const first = entry.questions[0]!;
    const changed = {
      ...content,
      setpiece: {
        ...content.setpiece,
        [INTERVIEW]: {
          ...entry,
          ask: 1,
          questions: [{ ...first, answers: first.answers.map((answer, index) => (index === 0 ? { ...answer, effects: [{ type: "quality/add", quality: WELLBEING, amount: -7 }] } : answer)) }],
        },
      },
    };
    const game = readyLife(changed, { seed: seedWhere(northgateOffers) });
    toApplied(game);
    const before = game.state.quality[WELLBEING] ?? 0;
    expect(game.state.setpiece.answered[INTERVIEW] ?? 0).toBe(0);
    const result = game.accept({ type: "setpiece/answer", question: first.id, answer: first.answers[0]!.id });
    expect(game.state.quality[WELLBEING]).toBe(before - 7);
    expect(result.events.filter((event) => event.type === "quality/changed").map((event) => ("source" in event ? event.source : null))).toEqual([INTERVIEW]);
    expect(game.state.setpiece.open).toBeNull();
    expect(game.state.setpiece.answered[INTERVIEW]).toBe(1);
    expect(check(readOf(game), { type: "setpiece/answered", setpiece: INTERVIEW })).toEqual({ met: true, have: 1, need: 1 });
    expect(check(readOf(game), { type: "setpiece/answered", setpiece: INTERVIEW, times: 2 }).met).toBe(false);
  });

  test("[R-SETPIECE-006] given a set piece opened with no route, when it is answered through, then it closes, counts, and records no score anywhere", () => {
    const game = life();
    expect(check(readOf(game), { type: "setpiece/answered", setpiece: INTERVIEW }).met).toBe(false);
    applyEffects(game, [{ type: "setpiece/open", setpiece: INTERVIEW, route: null }]);
    expect(game.state.setpiece.open?.entry).toBe(INTERVIEW);
    expect(game.state.setpiece.open?.route).toBeNull();
    answerFirst(game);
    expect(game.state.setpiece.open).toBeNull();
    expect(game.state.setpiece.answered[INTERVIEW]).toBe(1);
    expect(uk(game).visa).toBeNull();
    expect(legalCommands(game.view()).some((command) => command.type === "turn/end")).toBe(true);
  });
});
