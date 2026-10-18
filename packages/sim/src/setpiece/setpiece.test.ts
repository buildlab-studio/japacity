import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../engine/check";
import { step } from "../engine/step";
import type { Currency, Effect, Id, SetpieceAnswer, SetpieceEntry } from "../engine/types";
import type { Game } from "../testing/play";
import { legalCommands } from "../testing/legal";
import { UNIT, applyEffects, answerFirst, drawnQuestions, northgateOffers, readyLife, seedWhere, toApplied, toHeld, uk } from "../testing/route.journey";
import type { LifeOptions } from "../testing/route.journey";
import { fundsRequired, unexplainedBp } from "../route/route.logic";
import { mulDivCeil } from "../engine/int";
import { answerScore } from "./setpiece.logic";
import { flown } from "../testing/place.journey";
import { readOf } from "../testing/read";
import { DECEMBER_SETPIECE, DECEMBER_VAR, INTERVIEW, PREP, STANDING, UK_ROUTE } from "../testing/ids";

const entry = content.setpiece[INTERVIEW]!;
const hintPrep = content.tuning.route.hintPrep;
/** Every question in content order, and those asked of a clean file: the deposit question needs over 30% unexplained, the papers one a transcript that is not genuine. */
const ALL = entry.questions.map((question) => question.id);
const CLEAN = ALL.filter((id) => id !== "deposit" && id !== "papers");
/** The pool with the deposit question in it, as a file with unexplained money has it; the papers one still needs a fake. */
const WITH_DEPOSIT = ALL.filter((id) => id !== "papers");

function life(options: LifeOptions = {}): Game {
  return readyLife(content, { seed: seedWhere((seed) => northgateOffers(content, seed)), ...options });
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
    "papers.genuine": -2,
    "papers.agent": -2,
    "papers.admit": -1,
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
  test("[route:set-piece-draws-questions] given a clean file, when the application goes in, then as many questions as the entry asks are drawn on visa, without repeats, in the order drawn", () => {
    for (const index of [0, 1, 2, 3]) {
      const seed = seedWhere((candidate) => northgateOffers(content, candidate) && Number(candidate.slice(5)) >= index * 7);
      const game = life({ seed });
      toApplied(game);
      const open = game.state.setpiece.open!;
      expect(open.questions).toHaveLength(entry.ask);
      expect(new Set(open.questions).size).toBe(entry.ask);
      expect(open.questions).toEqual(drawnQuestions(seed, CLEAN, entry.ask));
      expect(open).toMatchObject({ entry: INTERVIEW, route: UK_ROUTE, answers: {} });
      expect(game.state.draws.visa).toBe(entry.ask);
    }
  });

  test("[route:set-piece-draws-questions] given a share of unexplained money above 30%, when the application goes in, then the deposit question may be drawn too", () => {
    const seed = seedWhere((candidate) => northgateOffers(content, candidate) && drawnQuestions(candidate, WITH_DEPOSIT, entry.ask).includes("deposit"));
    const game = life({ seed, pockets: { NGN: { bank: 1000000 * UNIT, cash: 40000000 * UNIT }, GBP: { bank: 40000 * UNIT, cash: 0 } } });
    toHeld(game);
    // Upkeep is taken from cash first each month, so what is banked is the cash that is left.
    game.accept({ type: "wallet/move", currency: "NGN", amount: game.state.wallet.pockets.NGN.cash, to: "bank" });
    expect(unexplainedBp(readOf(game), UK_ROUTE)).toBeGreaterThan(3000);
    game.endTurn([{ activity: "activity.apply-for-visa", param: null }]);
    expect(game.state.setpiece.open?.questions).toEqual(drawnQuestions(seed, WITH_DEPOSIT, entry.ask));
    expect(game.state.setpiece.open?.questions).toContain("deposit");
  });

  test("[route:set-piece-draws-questions] given a clean file, when many applications go in, then the deposit question is never asked", () => {
    for (let i = 0; i < 12; i += 1) {
      const seed = seedWhere((candidate) => northgateOffers(content, candidate) && Number(candidate.slice(5)) >= i);
      const game = life({ seed });
      toApplied(game);
      expect(game.state.setpiece.open?.questions).not.toContain("deposit");
    }
  });
});

describe("while the interview is open", () => {
  test("[route:open-set-piece-holds-month] given an open interview, when the turn is ended, then it is rejected with setpiece-open, while other commands work as usual", () => {
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

  test("[engine:player-never-stuck] given an open interview and no turn banked, when each question comes up, then the view offers answers, every one offered is accepted by step, and answering closes it", () => {
    // A first life finds how many months the file takes; the second banks exactly that many turns.
    // activity:now-acts-and-month-acts: the application is sent at once and the interview opens in the month in hand, so it takes no turn.
    const trial = life();
    toHeld(trial);
    const months = trial.state.turn.month;
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

  test("[route:set-piece-answers-in-order] given an open interview, when a later question, an unknown answer or nothing open is answered, then it is rejected with not-legal", () => {
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
  test("[route:answers-score-and-close] given an answer and the conditions of its other score, when it is scored, then it gives the other score only when they all hold", () => {
    const course = entry.questions.find((question) => question.id === "why-uk")!.answers.find((answer) => answer.id === "course")!;
    expect(answerScore(course, () => ({ met: true }))).toBe(course.thenScore);
    expect(answerScore(course, () => ({ met: false }))).toBe(course.score);
    const plain = { id: "plain", score: -1, when: [], thenScore: null, effects: [] };
    expect(answerScore(plain, () => ({ met: true }))).toBe(-1);
  });

  test("[route:answers-score-and-close] given interview prep at each edge, when every question is answered with its first answer, then the sum the page gives is recorded on the visa application and the interview closes", () => {
    for (const prep of [0, 19, 20, 39, 40]) {
      const game = life({ qualities: { [PREP]: prep } });
      toApplied(game);
      const total = answerWith(game, (_question, answers) => answers[0]!, prep, 0);
      expect(game.state.setpiece.open).toBeNull();
      expect(uk(game).visa?.interviewScore).toBe(total);
    }
  });

  test("[route:answers-score-and-close] given money from flagged sources over 20% of what is needed, when the student says they pay from savings, then that answer scores against them", () => {
    const seed = seedWhere((candidate) => northgateOffers(content, candidate) && drawnQuestions(candidate, CLEAN, entry.ask).includes("who-pays"));
    const game = life({ seed, pockets: { NGN: { bank: 1000000 * UNIT, cash: 30000000 * UNIT }, GBP: { bank: 40000 * UNIT, cash: 0 } } });
    toHeld(game);
    game.accept({ type: "wallet/move", currency: "NGN", amount: 11000000 * UNIT, to: "bank" });
    const share = unexplainedBp(readOf(game), UK_ROUTE);
    expect(share).toBeGreaterThan(2000);
    expect(share).toBeLessThanOrEqual(3000);
    game.endTurn([{ activity: "activity.apply-for-visa", param: null }]);
    expect(game.state.setpiece.open?.questions).toEqual(drawnQuestions(seed, CLEAN, entry.ask));
    const total = answerWith(game, (question, answers) => (question === "who-pays" ? "own" : answers[0]!), 0, share);
    expect(uk(game).visa?.interviewScore).toBe(total);
    expect(check(readOf(game), { type: "route/unexplained-max", route: UK_ROUTE, bp: 2000 }).met).toBe(false);
  });

  /** A life rich in cash, so a cash move into the bank can make a lot of any size. */
  const CASH_RICH = { NGN: { bank: 1000000 * UNIT, cash: 30000000 * UNIT }, GBP: { bank: 40000 * UNIT, cash: 0 } };

  /** Moves into the bank the least naira cash that makes the unexplained share exactly `target` basis points (route:unexplained-share-of-funds). */
  function lotTo(game: Game, target: number): void {
    const required = fundsRequired(readOf(game), UK_ROUTE);
    const pence = mulDivCeil(target, required, 10000);
    const kobo = mulDivCeil(pence, game.world().rates.GBP.official, UNIT);
    game.accept({ type: "wallet/move", currency: "NGN", amount: kobo, to: "bank" });
    expect(unexplainedBp(readOf(game), UK_ROUTE)).toBe(target);
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

  test("[route:answers-score-and-close] given a clean file, when a cash lot is made between two answers, then each answer keeps the score it was judged at when given, and the running sum is what is recorded", () => {
    const seed = seedWhere((candidate) => {
      if (!northgateOffers(content, candidate)) return false;
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
    expect(unexplainedBp(readOf(game), UK_ROUTE)).toBeGreaterThan(2000);
    expect(game.state.setpiece.open).toBeNull();
    expect(uk(game).visa?.interviewScore).toBe(expected);
  });

  test("[route:answers-score-and-close] given an unexplained share of 2000 and of 2001 basis points when who-pays is answered, when the student says own, then it scores +2 at 2000 and -2 at 2001", () => {
    const seed = seedWhere((candidate) => northgateOffers(content, candidate) && drawnQuestions(candidate, CLEAN, entry.ask).includes("who-pays"));
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

  test("[route:answers-score-and-close] given the interview closes, when the last answer is given, then the closing is told without a score, and a score with no open application changes nothing", () => {
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
    applyEffects(fresh, [{ type: "route/interview-scored", route: UK_ROUTE, score: 5 }]);
    expect(uk(fresh).visa).toBeNull();
  });
});

describe("what the player sees", () => {
  test("[route:view-shows-progress-not-score] given an open interview, when the view is read, then it shows one question with its answers and nothing that is a score", () => {
    const game = life();
    toApplied(game);
    const view = game.view().setpiece!;
    const first = game.state.setpiece.open!.questions[0]!;
    expect(view).toEqual({
      entry: INTERVIEW,
      asked: 0,
      total: entry.ask,
      question: { id: first, answers: entry.questions.find((question) => question.id === first)!.answers.map((answer) => answer.id), allowed: entry.questions.find((question) => question.id === first)!.answers.map((answer) => answer.id), weak: [], followUp: false },
    });
    expect(JSON.stringify(game.view()).toLowerCase()).not.toContain("score");
  });

  test("[route:view-shows-progress-not-score] given interview prep one under the hint and at it, when the view is read, then weak answers are marked only at the hint, and they are those scoring below zero now", () => {
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

  test("[route:answers-carry-effects] given an answer carrying an effect, when it is given, then the effect applies at that moment under the set piece as source, and the close counts once", () => {
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
    const game = readyLife(changed, { seed: seedWhere((seed) => northgateOffers(content, seed)) });
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

  test("[route:answers-carry-effects] given a set piece opened with no route, when it is answered through, then it closes, counts, and records no score anywhere", () => {
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

  test("[route:answers-carry-effects] [route:open-set-piece-holds-month] given a set piece open, when setpiece/close names another, then nothing changes; when it names the open one, then it closes unscored and uncounted, and the turn may end", () => {
    const game = life();
    applyEffects(game, [{ type: "setpiece/open", setpiece: INTERVIEW, route: null }]);
    applyEffects(game, [{ type: "setpiece/close", setpiece: DECEMBER_SETPIECE }]);
    expect(game.state.setpiece.open?.entry).toBe(INTERVIEW);
    expect(legalCommands(game.view()).some((command) => command.type === "turn/end")).toBe(false);
    applyEffects(game, [{ type: "setpiece/close", setpiece: INTERVIEW }]);
    expect(game.state.setpiece.open).toBeNull();
    expect(game.state.setpiece.answered[INTERVIEW]).toBeUndefined();
    expect(game.state.setpiece.given[INTERVIEW]).toBeUndefined();
    expect(uk(game).visa).toBeNull();
    expect(legalCommands(game.view()).some((command) => command.type === "turn/end")).toBe(true);
    applyEffects(game, [{ type: "setpiece/close", setpiece: INTERVIEW }]);
    expect(game.state.setpiece.open).toBeNull();
  });
});

const MONTHS_A_YEAR = 12;

/** A life flown to the UK on the study route, with every tick December. */
function flownInDecember(): Game {
  return flown(content, { vars: () => ({ [DECEMBER_VAR]: 1 }) });
}

/** The same life a month later, the December visit open. */
function december(): Game {
  const game = flownInDecember();
  game.endTurn();
  expect(game.state.setpiece.open?.entry).toBe(DECEMBER_SETPIECE);
  return game;
}

/** What an answer of the December visit takes, as content gives it. */
function priceOf(question: string, answer: string): { currency: Currency; amount: number } {
  const found = content.setpiece[DECEMBER_SETPIECE]!.questions.find((item) => item.id === question)?.answers.find((item) => item.id === answer);
  const take = found?.effects.find((effect) => effect.type === "money/take");
  if (take?.type !== "money/take" || typeof take.amount !== "number") throw new Error(`${question}.${answer} takes no fixed amount.`);
  return { currency: take.currency, amount: take.amount };
}

/** Leaves this currency's cash empty and its bank holding exactly `bank`, and the naira bank holding exactly `naira`. */
function holdOnly(game: Game, currency: Currency, bank: number, naira: number): void {
  const effects: Effect[] = [];
  for (const each of [currency, "NGN"] as const) {
    const pocket = game.state.wallet.pockets[each];
    if (pocket.bank + pocket.cash > 0) effects.push({ type: "money/take", currency: each, pocket: "any", amount: pocket.bank + pocket.cash, reason: "mishap" });
  }
  if (bank > 0) effects.push({ type: "money/add", currency, pocket: "bank", amount: bank, reason: "gift" });
  if (naira > 0) effects.push({ type: "money/add", currency: "NGN", pocket: "bank", amount: naira, reason: "gift" });
  applyEffects(game, effects);
}

/** The interview with its questions and order changed. */
function interviewAs(changed: SetpieceEntry, options: LifeOptions = {}): Game {
  return readyLife({ ...content, setpiece: { ...content.setpiece, [INTERVIEW]: changed } }, { seed: seedWhere((seed) => northgateOffers(content, seed)), ...options });
}

describe("a set piece asked in a fixed order", () => {
  test("[route:set-piece-draws-questions] given a fixed entry whose second question's conditions fail, when it opens, then the first that many whose conditions hold are asked in the order written, with no draw", () => {
    const deposit = entry.questions.find((question) => question.id === "deposit")!;
    const others = entry.questions.filter((question) => question.id !== "deposit");
    const game = interviewAs({ ...entry, order: "fixed", questions: [others[0]!, deposit, ...others.slice(1)] });
    toApplied(game);
    expect(game.state.setpiece.open?.questions).toEqual(others.slice(0, entry.ask).map((question) => question.id));
    expect(game.state.draws.visa ?? 0).toBe(0);
  });

  test("[route:set-piece-draws-questions] given a character in the UK in December, when the visit opens, then its four UK questions are asked, the going question first, and nothing is drawn on visa", () => {
    const game = flownInDecember();
    const before = game.state.draws.visa ?? 0;
    game.endTurn();
    expect(game.state.setpiece.open).toMatchObject({ entry: DECEMBER_SETPIECE, route: null, questions: ["go-uk", "party-uk", "gifts-uk", "look-uk"] });
    expect(game.state.draws.visa ?? 0).toBe(before);
  });
});

describe("closing on an answer", () => {
  test("[route:answers-score-and-close] [route:answers-carry-effects] given the December visit, when staying home is the first answer, then the set piece closes there, the questions after it are not asked, the count rises by one, and no score is recorded", () => {
    const game = december();
    const result = game.accept({ type: "setpiece/answer", question: "go-uk", answer: "stay" });
    expect(result.events.map((event) => event.type)).toEqual(["setpiece/answered", "setpiece/closed", "engine/stepped"]);
    expect(result.lines).toEqual([{ key: "line.setpiece.closed", params: { setpiece: DECEMBER_SETPIECE }, tone: "plain", attention: false, counts: [] }]);
    expect(game.state.setpiece.open).toBeNull();
    expect(game.state.setpiece.answered[DECEMBER_SETPIECE]).toBe(1);
    expect(game.view().setpiece).toBeNull();
    game.expectRejected({ type: "setpiece/answer", question: "party-uk", answer: "home" }, "not-legal");
    expect(legalCommands(game.view()).some((command) => command.type === "turn/end")).toBe(true);
  });

  test("[route:answers-score-and-close] given an answer marked closes on the only question, when it is given, then the set piece closes once, the count rises by one and the score is recorded", () => {
    const after = entry.questions.find((question) => question.id === "after")!;
    const game = interviewAs({ ...entry, ask: 1, questions: [{ ...after, answers: after.answers.map((item): SetpieceAnswer => ({ ...item, closes: true })) }] });
    toApplied(game);
    const result = game.accept({ type: "setpiece/answer", question: "after", answer: "return" });
    expect(result.events.filter((event) => event.type === "setpiece/closed")).toHaveLength(1);
    expect(game.state.setpiece.answered[INTERVIEW]).toBe(1);
    expect(uk(game).visa?.interviewScore).toBe(pageScore("after", "return", 0, 0));
  });
});

describe("answers that need something", () => {
  test("[route:set-piece-answers-in-order] given the pounds one penny short of the fare both ways, when going is answered, then it is refused with not-legal and nothing moves, though the naira bank could cover it", () => {
    const game = december();
    holdOnly(game, "GBP", priceOf("go-uk", "go").amount - 1, 1000000000 * UNIT);
    const before = game.state;
    game.expectRejected({ type: "setpiece/answer", question: "go-uk", answer: "go" }, "not-legal");
    expect(game.state).toBe(before);
    expect(game.view().setpiece?.question?.id).toBe("go-uk");
  });

  test("[route:set-piece-answers-in-order] [luck:big-wins-are-staged] given exactly the fare both ways, when going is answered, then it is accepted, the fare is taken, the going is staged as a big line, and the party comes next", () => {
    const game = december();
    holdOnly(game, "GBP", priceOf("go-uk", "go").amount, 0);
    const result = game.accept({ type: "setpiece/answer", question: "go-uk", answer: "go" });
    expect(game.state.wallet.pockets.GBP.bank + game.state.wallet.pockets.GBP.cash).toBe(0);
    expect(result.lines.filter((line) => line.big === true)).toEqual([
      { key: "line.setpiece.december-go", params: { setpiece: DECEMBER_SETPIECE }, tone: "good", attention: true, big: true, counts: [] },
    ]);
    expect(game.view().setpiece).toMatchObject({ asked: 1, total: 4, question: { id: "party-uk" } });
  });

  test("[route:set-piece-answers-in-order] given a spending answer, when the pocket is one penny short of its price and then holds exactly it, then it is refused and then accepted, and the free answers are allowed with nothing", () => {
    const game = december();
    holdOnly(game, "GBP", priceOf("go-uk", "go").amount, 0);
    game.accept({ type: "setpiece/answer", question: "go-uk", answer: "go" });
    const big = priceOf("party-uk", "big");
    holdOnly(game, "GBP", big.amount - 1, 0);
    game.expectRejected({ type: "setpiece/answer", question: "party-uk", answer: "big" }, "not-legal");
    holdOnly(game, "GBP", big.amount, 0);
    const standing = game.state.quality[STANDING] ?? 0;
    game.accept({ type: "setpiece/answer", question: "party-uk", answer: "big" });
    expect(game.state.wallet.pockets.GBP.bank).toBe(0);
    expect(game.state.quality[STANDING]).toBe(standing + 6);
    game.expectRejected({ type: "setpiece/answer", question: "gifts-uk", answer: "some" }, "not-legal");
    game.accept({ type: "setpiece/answer", question: "gifts-uk", answer: "none" });
    game.accept({ type: "setpiece/answer", question: "look-uk", answer: "plain" });
    expect(game.state.setpiece.open).toBeNull();
    expect(game.state.setpiece.answered[DECEMBER_SETPIECE]).toBe(1);
  });

  test("[share:cards-due-at-set-moments] given the December visit, when going is answered and the scene is answered through, then the December card is due for the rest of that month; staying home gives none", () => {
    const game = december();
    holdOnly(game, "GBP", priceOf("go-uk", "go").amount, 0);
    game.accept({ type: "setpiece/answer", question: "go-uk", answer: "go" });
    expect(game.view().card?.kind).not.toBe("december");
    game.accept({ type: "setpiece/answer", question: "party-uk", answer: "home" });
    game.accept({ type: "setpiece/answer", question: "gifts-uk", answer: "none" });
    game.accept({ type: "setpiece/answer", question: "look-uk", answer: "plain" });
    expect(game.state.setpiece.open).toBeNull();
    expect(game.view().card).toMatchObject({ kind: "december", months: game.state.turn.month, name: null });
    game.endTurn();
    expect(game.view().card?.kind).not.toBe("december");
    const stayed = december();
    stayed.accept({ type: "setpiece/answer", question: "go-uk", answer: "stay" });
    expect(stayed.state.setpiece.open).toBeNull();
    expect(stayed.view().card?.kind).not.toBe("december");
  });

  test("[route:set-piece-answers-in-order] [engine:player-never-stuck] given the pounds for the fare and the party but not the gifts, when the view is read at each question, then it lists only the answers allowed now, and step accepts every one", () => {
    const game = december();
    holdOnly(game, "GBP", priceOf("go-uk", "go").amount + priceOf("party-uk", "small").amount, 0);
    const listed: string[][] = [];
    for (let guard = 0; guard < 4 && game.state.setpiece.open !== null; guard += 1) {
      const answers = legalCommands(game.view()).filter((command) => command.type === "setpiece/answer");
      listed.push(answers.map((command) => String(command.answer)));
      for (const command of answers) expect(step(game.state, { ...command, basedOn: game.state.v }, game.world(), game.content).ok).toBe(true);
      game.accept(answers[answers.length - 1]!);
    }
    expect(listed).toEqual([["stay", "go"], ["home", "small"], ["none"], ["plain"]]);
    expect(game.state.setpiece.open).toBeNull();
  });

  test("[route:set-piece-answers-in-order] given an answer whose requirement fails when the set piece opens, when it is met before answering, then the answer is judged at that moment and allowed", () => {
    const after = entry.questions.find((question) => question.id === "after")!;
    const guarded: SetpieceAnswer = { ...after.answers[0]!, requires: [{ type: "quality/min", quality: PREP, value: 50 }] };
    const game = interviewAs({ ...entry, ask: 1, questions: [{ ...after, answers: [guarded, ...after.answers.slice(1)] }] }, { qualities: { [PREP]: 49 } });
    toApplied(game);
    game.expectRejected({ type: "setpiece/answer", question: "after", answer: guarded.id }, "not-legal");
    applyEffects(game, [{ type: "quality/add", quality: PREP, amount: 1 }]);
    game.accept({ type: "setpiece/answer", question: "after", answer: guarded.id });
    expect(game.state.setpiece.open).toBeNull();
  });
});

describe("the staged December line", () => {
  test("[luck:big-wins-are-staged] given the interview, and the December visit stayed home from, when they are answered through, then no big line is given", () => {
    const interview = life();
    toApplied(interview);
    const lines: ReturnType<Game["accept"]>["lines"] = [];
    for (const id of interview.state.setpiece.open!.questions) {
      lines.push(...interview.accept({ type: "setpiece/answer", question: id, answer: entry.questions.find((question) => question.id === id)!.answers[0]!.id }).lines);
    }
    lines.push(...december().accept({ type: "setpiece/answer", question: "go-uk", answer: "stay" }).lines);
    expect(lines.filter((line) => line.big === true)).toEqual([]);
  });
});

describe("the interview's drawn order", () => {
  test("[route:set-piece-draws-questions] [route:answers-score-and-close] given the interview, which has no fixed order and no closing answer, when it opens and is answered, then its order is drawn on visa and it stays open until the last answer", () => {
    expect(entry.order).toBeUndefined();
    expect(entry.questions.flatMap((question) => question.answers).filter((answer) => answer.closes === true || answer.requires !== undefined)).toEqual([]);
    const seed = seedWhere((seed) => northgateOffers(content, seed));
    const game = life({ seed });
    toApplied(game);
    const asked = game.state.setpiece.open!.questions;
    expect(asked).toEqual(drawnQuestions(seed, CLEAN, entry.ask));
    asked.forEach((id, index) => {
      game.accept({ type: "setpiece/answer", question: id, answer: entry.questions.find((question) => question.id === id)!.answers[0]!.id });
      expect(game.state.setpiece.open === null).toBe(index === asked.length - 1);
    });
    expect(game.state.setpiece.answered[INTERVIEW]).toBe(1);
  });
});

describe("the December visit, once a year", () => {
  test("[return:december-visit-set-piece] given two turns played in one December tick, when the second ends, then the visit does not open again", () => {
    const game = december();
    // The handle moves the tick on after each turn; holding it back plays the answer and a second turn in the same tick.
    game.tick -= 1;
    game.accept({ type: "setpiece/answer", question: "go-uk", answer: "stay" });
    expect(game.state.setpiece.answered[DECEMBER_SETPIECE]).toBe(1);
    game.endTurn();
    expect(game.state.setpiece.open).toBeNull();
  });

  test("[return:december-visit-set-piece] [place:view-shows-place-and-returns] given a December that spans many ticks, as online, when turns are played through it, then the visit opens again only twelve months of the character's own time on, and the place slice records that month", () => {
    const game = december();
    const opened = game.state.turn.month;
    expect(game.state.place.decemberMonth).toBe(opened);
    game.accept({ type: "setpiece/answer", question: "go-uk", answer: "stay" });
    while (game.state.turn.month < opened + MONTHS_A_YEAR - 1) {
      game.endTurn();
      expect(game.state.setpiece.open).toBeNull();
    }
    expect(game.state.place.decemberMonth).toBe(opened);
    game.endTurn();
    expect(game.state.turn.month).toBe(opened + MONTHS_A_YEAR);
    expect(game.state.setpiece.open?.entry).toBe(DECEMBER_SETPIECE);
    expect(game.state.place.decemberMonth).toBe(opened + MONTHS_A_YEAR);
  });

  test("[return:december-visit-set-piece] given the visit opened in the last turn played and the world twelve ticks on, when the next turn ends in December, then the visit does not open: the gap is read in the character's months, not the ticks", () => {
    const game = december();
    game.accept({ type: "setpiece/answer", question: "go-uk", answer: "stay" });
    game.tick += MONTHS_A_YEAR;
    game.endTurn();
    expect(game.state.setpiece.open).toBeNull();
  });
});
