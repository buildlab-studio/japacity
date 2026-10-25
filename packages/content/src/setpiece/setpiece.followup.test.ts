// The follow-up questions (route:answer-may-ask-follow-up) as content: each named by one answer, each
// leading to no other, each with its words.
import { describe, expect, test } from "vitest";

import { content, text } from "../index";

const INTERVIEW = "setpiece.credibility-interview";
const interview = content.setpiece[INTERVIEW]!;

function followUpNamedBy(question: string, answer: string): string | undefined {
  return interview.questions.find((candidate) => candidate.id === question)?.answers.find((candidate) => candidate.id === answer)?.followUp;
}

describe("the follow-up questions", () => {
  test("[route:answer-may-ask-follow-up] given the credibility interview, when a sponsor or a course chosen for the admission is the answer, then who the sponsor is and what the course is about follow, in content's words", () => {
    expect(followUpNamedBy("who-pays", "sponsor")).toBe("sponsor-who");
    expect(followUpNamedBy("why-uk", "admission")).toBe("course-about");
    expect(text[`${INTERVIEW}.q.sponsor-who`]).toBe("Who is the sponsor, and what do they do?");
    expect(text[`${INTERVIEW}.q.course-about`]).toBe("Then what is the course about, in your own words?");
  });

  test("[route:answer-may-ask-follow-up] given every set piece, when its answers name follow-ups, then each names one of its own entry's follow-ups, a follow-up's answers name none, and every follow-up is named", () => {
    for (const entry of Object.values(content.setpiece)) {
      const followUps = entry.followUps ?? [];
      const ids = new Set(followUps.map((question) => question.id));
      const named = entry.questions.flatMap((question) => question.answers.flatMap((answer) => (answer.followUp === undefined ? [] : [answer.followUp])));
      for (const id of named) expect(ids.has(id), `${entry.id} names the follow-up ${id}, which it does not have`).toBe(true);
      for (const id of ids) expect(named, `${entry.id} has the follow-up ${id} and no answer names it`).toContain(id);
      for (const question of followUps) expect(question.answers.filter((answer) => answer.followUp !== undefined).map((answer) => answer.id), `${entry.id}.${question.id}`).toEqual([]);
      const drawn = new Set(entry.questions.map((question) => question.id));
      expect([...ids].filter((id) => drawn.has(id))).toEqual([]);
    }
  });

  test("[route:answer-may-ask-follow-up] given the credibility interview's follow-ups, when they are read, then there are two or three, each has two or three answers, and none is the first answer to its question", () => {
    const followUps = interview.followUps ?? [];
    expect(followUps.length).toBeGreaterThanOrEqual(2);
    expect(followUps.length).toBeLessThanOrEqual(3);
    for (const question of followUps) {
      expect(question.answers.length).toBeGreaterThanOrEqual(2);
      expect(question.answers.length).toBeLessThanOrEqual(3);
    }
    // The answer listed first is the one the journeys give, so a follow-up never lengthens them.
    for (const question of interview.questions) expect(question.answers[0]?.followUp).toBeUndefined();
  });

  test("[engine:content-checked-before-play] [route:answer-may-ask-follow-up] given every follow-up, when its words are looked up, then the question and every answer have words", () => {
    for (const entry of Object.values(content.setpiece)) {
      for (const question of entry.followUps ?? []) {
        expect(text[`${entry.id}.q.${question.id}`]).toBeTruthy();
        for (const answer of question.answers) expect(text[`${entry.id}.a.${question.id}.${answer.id}`], `${question.id}.${answer.id}`).toBeTruthy();
      }
    }
  });
});
