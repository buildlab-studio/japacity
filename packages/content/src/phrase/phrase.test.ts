import { describe, expect, test } from "vitest";

import { phraseTable } from "./phrase.data";
import { phraseText } from "./phrase.text";

const HOLE = /\{([a-z]+)\}/g;

describe("the words of the phrases", () => {
  test("[R-PAIR-010] given every phrase, when its words are read, then it has words with at most one fill-in, the one its entry names", () => {
    const off = Object.values(phraseTable).flatMap((entry) => {
      const said = phraseText[`${entry.id}.name`] ?? "";
      const holes = [...said.matchAll(HOLE)].map((match) => match[1]);
      const wanted = entry.fill === null ? [] : [entry.fill];
      return said.trim() === "" || holes.length > 1 || JSON.stringify(holes) !== JSON.stringify(wanted) ? [entry.id] : [];
    });
    expect(Object.keys(phraseTable)).toHaveLength(23);
    expect(off).toEqual([]);
  });

  test("[R-PAIR-010] given every option of a phrase, when its words are read, then there are words for it", () => {
    const keys = Object.values(phraseTable).flatMap((entry) => (entry.options ?? []).map((option) => `${entry.id}.fill.${option}`));
    expect(keys.filter((key) => (phraseText[key] ?? "").trim() === "")).toEqual([]);
  });

  test("[R-PAIR-010] given every phrase's words, when read, then none carries a figure, a link or an address", () => {
    const words = Object.entries(phraseText).filter(([key]) => key.startsWith("phrase."));
    expect(words.filter(([, said]) => /[0-9@]|http|www\./.test(said))).toEqual([]);
  });
});
