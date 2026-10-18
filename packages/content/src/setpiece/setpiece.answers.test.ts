// The interview's answers in one voice: each is what the character says to the
// officer, first person, never the narrator telling what the character does.
import { describe, expect, test } from "vitest";

import { content, text } from "../index";

const INTERVIEW = "setpiece.credibility-interview";

describe("the interview's answers", () => {
  test("[route:view-shows-progress-not-score] given every answer the interview can show, follow-ups included, when its words are read, then each is the character speaking, never the narrator's you", () => {
    const interview = content.setpiece[INTERVIEW];
    if (interview === undefined) throw new Error("No interview.");
    const answers = [...interview.questions, ...(interview.followUps ?? [])].flatMap((question) => question.answers.map((answer) => `${INTERVIEW}.a.${question.id}.${answer.id}`));
    expect(answers.length).toBeGreaterThan(10);
    for (const key of answers) {
      expect(text[key]).toBeTruthy();
      expect(text[key]).not.toMatch(/^You\b/);
    }
  });
});
