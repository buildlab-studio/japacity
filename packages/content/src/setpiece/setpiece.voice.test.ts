// The officer's clip keys: every line the officer speaks has one in each of the officer's voices.
import { describe, expect, test } from "vitest";

import { content, OFFICER_REACTIONS, OFFICER_VOICES, setpieceVoice, text } from "../index";

declare global {
  interface ImportMeta {
    /** Vite's import of many files at once, here only for their names. Vitest runs on Vite, so it is there in tests. */
    glob(pattern: string): Record<string, () => Promise<unknown>>;
  }
}

// What this reads: the names of the clips the client ships, never their sound.
const shipped = new Set(Object.keys(import.meta.glob("../../../../apps/client/public/voice/officer/**/*.{mp3,opus}")).map((path) => path.replace(/^.*\/public\/voice\//, "")));

const INTERVIEW = "setpiece.credibility-interview";
const interview = content.setpiece[INTERVIEW]!;
const OFFICER = ["greet", "close"].map((line) => `${INTERVIEW}.officer.${line}`);

describe("the officer's clips", () => {
  test("[route:answer-may-ask-follow-up] given every question the interview can ask, follow-ups included, and the greeting, the reactions and the closing, when its clip is looked up in either voice, then there is one, in that voice's folder", () => {
    const spoken = [...interview.questions, ...(interview.followUps ?? [])].map((question) => `${INTERVIEW}.q.${question.id}`);
    for (const key of [...spoken, ...OFFICER, ...OFFICER_REACTIONS]) {
      for (const voice of OFFICER_VOICES) expect(setpieceVoice[key]?.[voice].clip).toMatch(new RegExp(`^officer/${voice}/[a-z0-9-]+$`));
    }
  });

  test("[route:view-shows-progress-not-score] given the reactions, when they are counted, then there are four, each a short neutral line with words", () => {
    expect(OFFICER_REACTIONS).toHaveLength(4);
    for (const key of OFFICER_REACTIONS) expect(text[key]?.split(" ").length).toBeLessThanOrEqual(2);
  });

  test("[engine:content-checked-before-play] given every clip in each voice, when its key is looked up, then it is a line with words, its path is its own, and it plays between half a second and five seconds", () => {
    const paths = Object.values(setpieceVoice).flatMap((voices) => OFFICER_VOICES.map((voice) => voices[voice].clip));
    expect(new Set(paths).size).toBe(paths.length);
    for (const [key, voices] of Object.entries(setpieceVoice)) {
      expect(text[key]).toBeTruthy();
      for (const voice of OFFICER_VOICES) {
        expect(voices[voice].ms).toBeGreaterThanOrEqual(500);
        expect(voices[voice].ms).toBeLessThanOrEqual(5000);
      }
    }
  });

  test("[engine:content-checked-before-play] [world:officer-voice-drawn-per-interview] given every clip in both voices, when the client's files are listed, then each ships as Opus and as MP3, and no other officer file ships", () => {
    const expected = Object.values(setpieceVoice).flatMap((voices) => OFFICER_VOICES.flatMap((voice) => [`${voices[voice].clip}.opus`, `${voices[voice].clip}.mp3`]));
    expect(expected).toHaveLength(Object.keys(setpieceVoice).length * OFFICER_VOICES.length * 2);
    expect([...shipped].sort()).toEqual([...expected].sort());
  });
});
