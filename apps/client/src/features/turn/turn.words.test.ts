// The words of the month (world.md R-WORLD-027): the bank behind the months is never named, and no button adds an act to
// the month. Every word table the player reads is walked: content's text and each table of the client's own words.
import { text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { uiText } from "../../shared/words/tables/ui.words";

/** The client's source, tests left out, as raw text: its word tables are the `"key": "words"` rows. */
const sources = import.meta.glob<string>(["../../**/*.ts", "../../**/*.tsx", "!../../**/*.test.ts", "!../../**/*.test.tsx"], { query: "?raw", import: "default", eager: true });

const ROW = /^\s*"([\w.{}-]+)":\s*"((?:[^"\\]|\\.)*)",?\s*$/gm;

/** Every word the player can read, by key, with the file it is written in: content's text wins over the interface's, as on screen. */
function allWords(): { key: string; words: string; file: string }[] {
  const client = Object.entries(sources).flatMap(([file, source]) =>
    [...source.matchAll(ROW)].map((row) => {
      const key = row[1] ?? "";
      return { key, words: text[key] ?? uiText[key] ?? row[2] ?? "", file };
    }),
  );
  const shared = Object.entries(text).map(([key, words]) => ({ key, words, file: "content" }));
  return [...client, ...shared];
}

/** Words that name the simulation's turns or the bank of them, or a button that adds an act to the month. */
const FORBIDDEN = [/\bbanked\b/i, /\badd to (this )?month\b/i, /\b(\d+|no|more|free|spare|banked) turns?\b/i, /\bturns? (left|banked|to play)\b/i];

describe("the words of the month", () => {
  test("[R-WORLD-027] given every word table the player reads, when its words are read, then none says turn or banked, and no button says Add to month", () => {
    const words = allWords();
    expect(words.length).toBeGreaterThan(1000);
    const said = words.filter(({ words: one }) => FORBIDDEN.some((pattern) => pattern.test(one))).map(({ key, words: one, file }) => `${file} ${key}: ${one}`);
    expect(said).toEqual([]);
  });
});
