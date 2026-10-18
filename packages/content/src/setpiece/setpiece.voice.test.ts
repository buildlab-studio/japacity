// The officer's clip keys: every line the officer speaks has one.
import { describe, expect, test } from "vitest";

import { content, OFFICER_REACTIONS, setpieceVoice, text } from "../index";

const INTERVIEW = "setpiece.credibility-interview";
const interview = content.setpiece[INTERVIEW]!;
const OFFICER = ["greet", "close"].map((line) => `${INTERVIEW}.officer.${line}`);

describe("the officer's clips", () => {
  test("[route:answer-may-ask-follow-up] given every question the interview can ask, follow-ups included, and the greeting, the reactions and the closing, when its clip is looked up, then there is one", () => {
    const spoken = [...interview.questions, ...(interview.followUps ?? [])].map((question) => `${INTERVIEW}.q.${question.id}`);
    for (const key of [...spoken, ...OFFICER, ...OFFICER_REACTIONS]) expect(setpieceVoice[key]?.clip).toMatch(/^officer\/[a-z0-9-]+$/);
  });

  test("[route:view-shows-progress-not-score] given the reactions, when they are counted, then there are four, each a short neutral line with words", () => {
    expect(OFFICER_REACTIONS).toHaveLength(4);
    for (const key of OFFICER_REACTIONS) expect(text[key]?.split(" ").length).toBeLessThanOrEqual(2);
  });

  test("[engine:content-checked-before-play] given every clip, when its key is looked up, then it is a line with words, its path is its own, and it plays between half a second and five seconds", () => {
    const paths = Object.values(setpieceVoice).map((voice) => voice.clip);
    expect(new Set(paths).size).toBe(paths.length);
    for (const [key, voice] of Object.entries(setpieceVoice)) {
      expect(text[key]).toBeTruthy();
      expect(voice.ms).toBeGreaterThanOrEqual(500);
      expect(voice.ms).toBeLessThanOrEqual(5000);
    }
  });
});
