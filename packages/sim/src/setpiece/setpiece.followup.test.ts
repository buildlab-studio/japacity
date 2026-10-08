import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import type { Id, SetpieceAnswer, SetpieceEntry, SetpieceQuestion } from "../engine/types";
import { NORTHGATE, draw, drawnQuestions, readyLife, seedWhere, toApplied, uk } from "../route/route.journey";
import type { LifeOptions } from "../route/route.journey";
import { offerChanceBp } from "../route/route.logic";
import { legalCommands } from "../testing/legal";
import type { Game } from "../testing/play";

const INTERVIEW: Id<"setpiece"> = "setpiece.credibility-interview";
const entry = content.setpiece[INTERVIEW]!;
const PREP: Id<"quality"> = "quality.interview-prep";
const CLEAN = entry.questions.map((question) => question.id).filter((id) => id !== "deposit");

const northgateOffers = (seed: string) => draw(seed, "school", 1, 10000) < offerChanceBp(content.school[NORTHGATE]!, 4, content.tuning.route);

/** A seed whose interview asks `question` at `index` of the questions drawn for a clean file. */
function seedAsking(question: string, index: number): string {
  return seedWhere((candidate) => northgateOffers(candidate) && drawnQuestions(candidate, CLEAN, entry.ask)[index] === question);
}

function lifeAsking(question: string, index: number, options: LifeOptions = {}, used = content): Game {
  return readyLife(used, { seed: seedAsking(question, index), ...options });
}

function answerOf(question: string, answer: string): SetpieceAnswer {
  const found = entry.questions.find((candidate) => candidate.id === question)?.answers.find((candidate) => candidate.id === answer);
  if (found === undefined) throw new Error(`No answer ${question}.${answer}.`);
  return found;
}

function followUpOf(question: string, answer: string): SetpieceQuestion {
  const id = answerOf(question, answer).followUp;
  const found = entry.followUps?.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`${question}.${answer} names no follow-up.`);
  return found;
}

/** Answers with the first answer until `question` is the one asked. */
function answerFirstUntil(game: Game, question: string): void {
  for (let guard = 0; guard < 10; guard += 1) {
    const asked = game.view().setpiece?.question;
    if (asked === undefined || asked === null) throw new Error(`${question} was never asked.`);
    if (asked.id === question) return;
    game.accept({ type: "setpiece/answer", question: asked.id, answer: asked.answers[0]! });
  }
  throw new Error(`${question} was never asked.`);
}

/** The interview with its entry changed. */
function interviewAs(changed: SetpieceEntry): typeof content {
  return { ...content, setpiece: { ...content.setpiece, [INTERVIEW]: changed } };
}

describe("the follow-up question", () => {
  test("[R-SETPIECE-008] given who-pays drawn first, when a sponsor is the answer, then who the sponsor is comes next, ahead of the questions drawn after it, shown as a follow-up and counted in the total", () => {
    const game = lifeAsking("who-pays", 0);
    toApplied(game);
    const drawn = [...game.state.setpiece.open!.questions];
    const followUp = followUpOf("who-pays", "sponsor");
    game.accept({ type: "setpiece/answer", question: "who-pays", answer: "sponsor" });
    expect(game.state.setpiece.open?.questions).toEqual([drawn[0], followUp.id, ...drawn.slice(1)]);
    expect(game.view().setpiece).toMatchObject({ asked: 1, total: entry.ask + 1, question: { id: followUp.id, followUp: true, answers: followUp.answers.map((answer) => answer.id) } });
    expect(legalCommands(game.view()).filter((command) => command.type === "setpiece/answer")).toEqual(followUp.answers.map((answer) => ({ type: "setpiece/answer", question: followUp.id, answer: answer.id })));
  });

  test("[R-SETPIECE-008] given who-pays drawn first, when an answer that names no follow-up is given, then the next drawn question comes and the total is what was drawn", () => {
    const game = lifeAsking("who-pays", 0);
    toApplied(game);
    const drawn = [...game.state.setpiece.open!.questions];
    expect(answerOf("who-pays", "lender").followUp).toBeUndefined();
    game.accept({ type: "setpiece/answer", question: "who-pays", answer: "lender" });
    expect(game.state.setpiece.open?.questions).toEqual(drawn);
    expect(game.view().setpiece).toMatchObject({ asked: 1, total: entry.ask, question: { id: drawn[1], followUp: false } });
  });

  test("[R-SETPIECE-008] given the first question's own view, when nothing is answered yet, then it is not a follow-up", () => {
    const game = lifeAsking("why-uk", 0);
    toApplied(game);
    expect(game.view().setpiece?.question).toMatchObject({ id: "why-uk", followUp: false });
  });

  test("[R-SETPIECE-008] given the follow-up answered, when the next question comes, then it is the next one drawn: never a second follow-up for the one question", () => {
    const followUp = followUpOf("why-uk", "agent");
    // A follow-up whose own answer names another follow-up: the content check forbids it, and the set piece asks only one anyway.
    const chained: SetpieceEntry = {
      ...entry,
      followUps: (entry.followUps ?? []).map((question) => (question.id === followUp.id ? { ...question, answers: question.answers.map((answer) => ({ ...answer, followUp: followUp.id })) } : question)),
    };
    for (const used of [content, interviewAs(chained)]) {
      const game = lifeAsking("why-uk", 0, {}, used);
      toApplied(game);
      const drawn = [...game.state.setpiece.open!.questions];
      game.accept({ type: "setpiece/answer", question: "why-uk", answer: "agent" });
      expect(game.view().setpiece?.question?.id).toBe(followUp.id);
      game.accept({ type: "setpiece/answer", question: followUp.id, answer: followUp.answers[0]!.id });
      expect(game.state.setpiece.open?.questions).toEqual([drawn[0], followUp.id, ...drawn.slice(1)]);
      expect(game.view().setpiece).toMatchObject({ asked: 2, total: entry.ask + 1, question: { id: drawn[1], followUp: false } });
    }
  });

  test("[R-SETPIECE-008] [R-SETPIECE-004] given who-pays drawn last, when a sponsor is the answer, then the interview stays open for the follow-up and the score recorded counts the follow-up's answer", () => {
    const game = lifeAsking("who-pays", entry.ask - 1);
    toApplied(game);
    answerFirstUntil(game, "who-pays");
    const followUp = followUpOf("who-pays", "sponsor");
    const before = game.state.setpiece.open!.score;
    const sponsor = game.accept({ type: "setpiece/answer", question: "who-pays", answer: "sponsor" });
    expect(sponsor.events.map((event) => event.type)).not.toContain("setpiece/closed");
    expect(game.view().setpiece).toMatchObject({ asked: entry.ask, total: entry.ask + 1, question: { id: followUp.id, followUp: true } });
    const last = followUp.answers.at(-1)!;
    expect(last.score).not.toBe(0);
    const closing = game.accept({ type: "setpiece/answer", question: followUp.id, answer: last.id });
    expect(closing.events.map((event) => event.type)).toContain("setpiece/closed");
    expect(game.state.setpiece.open).toBeNull();
    expect(uk(game).visa?.interviewScore).toBe(before + answerOf("who-pays", "sponsor").score + last.score);
  });

  test("[R-SETPIECE-008] [R-SETPIECE-005] given one answer that scores differently with interview prep 0 and 20, when it names a follow-up, then the follow-up is asked at both: it follows what was said, never what it scored", () => {
    const followUp = followUpOf("why-uk", "agent");
    const why = entry.questions.find((question) => question.id === "why-uk")!;
    const changed: SetpieceEntry = { ...entry, questions: entry.questions.map((question) => (question.id === "why-uk" ? { ...why, answers: why.answers.map((answer) => (answer.id === "course" ? { ...answer, followUp: followUp.id } : answer)) } : question)) };
    const scores = new Set<number>();
    for (const prep of [0, 20]) {
      const game = lifeAsking("why-uk", 0, { qualities: { [PREP]: prep } }, interviewAs(changed));
      toApplied(game);
      const result = game.accept({ type: "setpiece/answer", question: "why-uk", answer: "course" });
      const answered = result.events.find((event) => event.type === "setpiece/answered") as { score: number } | undefined;
      scores.add(answered!.score);
      expect(game.view().setpiece?.question).toMatchObject({ id: followUp.id, followUp: true });
    }
    expect(scores.size).toBe(2);
  });

  test("[R-SETPIECE-008] given a follow-up whose conditions fail, when its answer is given, then it is not asked and the next drawn question comes", () => {
    const followUp = followUpOf("who-pays", "sponsor");
    const never: SetpieceEntry = {
      ...entry,
      followUps: (entry.followUps ?? []).map((question) => (question.id === followUp.id ? { ...question, when: [{ type: "quality/min", quality: PREP, value: 101 }] } : question)),
    };
    const game = lifeAsking("who-pays", 0, {}, interviewAs(never));
    toApplied(game);
    const drawn = [...game.state.setpiece.open!.questions];
    game.accept({ type: "setpiece/answer", question: "who-pays", answer: "sponsor" });
    expect(game.state.setpiece.open?.questions).toEqual(drawn);
    expect(game.view().setpiece?.question).toMatchObject({ id: drawn[1], followUp: false });
  });

  test("[R-SETPIECE-008] [R-SETPIECE-004] given an answer marked closes that names a follow-up, when it is given, then the set piece closes and the follow-up is not asked", () => {
    const followUp = followUpOf("who-pays", "sponsor");
    const who = entry.questions.find((question) => question.id === "who-pays")!;
    const closing: SetpieceEntry = { ...entry, questions: entry.questions.map((question) => (question.id === "who-pays" ? { ...who, answers: who.answers.map((answer): SetpieceAnswer => (answer.id === "sponsor" ? { ...answer, closes: true } : answer)) } : question)) };
    const game = lifeAsking("who-pays", 0, {}, interviewAs(closing));
    toApplied(game);
    const result = game.accept({ type: "setpiece/answer", question: "who-pays", answer: "sponsor" });
    expect(result.events.map((event) => event.type)).toContain("setpiece/closed");
    expect(result.events.map((event) => event.type)).not.toContain("setpiece/followed-up");
    expect(game.state.setpiece.open).toBeNull();
    expect(game.state.setpiece.given[INTERVIEW]?.[followUp.id]).toBeUndefined();
  });

  test("[R-SETPIECE-008] [R-SETPIECE-001] given follow-ups in the entry, when many interviews open, then none is ever drawn and the draws on visa are as many as the entry asks", () => {
    const followUps = new Set((entry.followUps ?? []).map((question) => question.id));
    expect(followUps.size).toBeGreaterThan(0);
    for (let index = 0; index < 8; index += 1) {
      const seed = seedWhere((candidate) => northgateOffers(candidate) && Number(candidate.slice(5)) >= index * 5);
      const game = readyLife(content, { seed });
      toApplied(game);
      const open = game.state.setpiece.open!;
      expect(open.questions).toEqual(drawnQuestions(seed, CLEAN, entry.ask));
      expect(open.questions.some((id) => followUps.has(id))).toBe(false);
      expect(game.state.draws.visa).toBe(entry.ask);
    }
  });

  test("[R-SETPIECE-008] [R-SETPIECE-007] given the follow-up answered, when the answer is looked up, then it is kept as the last answer to that question", () => {
    const game = lifeAsking("who-pays", 0);
    toApplied(game);
    const followUp = followUpOf("who-pays", "sponsor");
    game.accept({ type: "setpiece/answer", question: "who-pays", answer: "sponsor" });
    game.accept({ type: "setpiece/answer", question: followUp.id, answer: followUp.answers[0]!.id });
    expect(game.state.setpiece.given[INTERVIEW]).toMatchObject({ "who-pays": "sponsor", [followUp.id]: followUp.answers[0]!.id });
  });
});
