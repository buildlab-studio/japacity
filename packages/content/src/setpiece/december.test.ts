// The December visit's entry against return.md R-RETURN-005 and place.md R-PLACE-006.
import type { Effect, SetpieceQuestion } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { content, text } from "../index";

const december = content.setpiece["setpiece.december"]!;

function question(id: string): SetpieceQuestion {
  const found = december.questions.find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`setpiece.december has no question ${id}.`);
  return found;
}

function effectsOf(questionId: string, answer: string): Effect[] {
  return question(questionId).answers.find((candidate) => candidate.id === answer)?.effects ?? [];
}

describe("the December visit", () => {
  test("[R-RETURN-005] given each country, when the go question is read, then going takes the fare both ways times the December factor in the country's currency, and staying, listed first, takes nothing", () => {
    // £620 x 2 x 2.5, C$1,350 x 2 x 2.2, AED 1,900 x 2 x 1.8, €480 x 2 x 2.0.
    const fares = { uk: ["GBP", 310000], ca: ["CAD", 594000], uae: ["AED", 684000], it: ["EUR", 192000] } as const;
    for (const [suffix, [currency, amount]] of Object.entries(fares)) {
      expect(question(`go-${suffix}`).answers.map((answer) => answer.id)).toEqual(["stay", "go"]);
      expect(effectsOf(`go-${suffix}`, "go")).toEqual([{ type: "money/take", currency, pocket: "any", amount, reason: "fare" }]);
      expect(effectsOf(`go-${suffix}`, "stay")).toEqual([]);
    }
  });

  test("[R-RETURN-005] given the spending questions, when their answers are read, then each moves the page's qualities, the costly ones pay in the country's currency, and the free one comes first", () => {
    expect(effectsOf("party-uk", "big")).toEqual([
      { type: "money/take", currency: "GBP", pocket: "any", amount: 22700, reason: "social" },
      { type: "quality/add", quality: "quality.standing", amount: 6 },
      { type: "quality/add", quality: "quality.wellbeing", amount: 6 },
      { type: "quality/add", quality: "quality.network", amount: 4 },
    ]);
    expect(effectsOf("gifts-uk", "none")).toEqual([
      { type: "quality/add", quality: "quality.standing", amount: -6 },
      { type: "quality/add", quality: "quality.wellbeing", amount: -3 },
    ]);
    expect(effectsOf("gifts-ca", "all")[0]).toMatchObject({ type: "money/take", currency: "CAD", reason: "family" });
    expect(effectsOf("look-it", "outfit")[0]).toMatchObject({ type: "money/take", currency: "EUR", reason: "social" });
    for (const id of ["party", "gifts", "look"]) {
      for (const suffix of ["uk", "ca", "uae", "it"]) expect(effectsOf(`${id}-${suffix}`, question(`${id}-${suffix}`).answers[0]!.id).filter((effect) => effect.type === "money/take")).toEqual([]);
    }
  });

  test("[R-RETURN-005] given the entry, when its questions are counted, then each country has its four and every one is asked, and every question and answer has words", () => {
    expect(december.questions).toHaveLength(16);
    expect(december.ask).toBe(4);
    const missing = december.questions.flatMap((item) => [`setpiece.december.q.${item.id}`, ...item.answers.map((answer) => `setpiece.december.a.${item.id}.${answer.id}`)]).filter((key) => (text[key] ?? "") === "");
    expect(missing).toEqual([]);
    expect(text["setpiece.december.a.go-uk.go"]).toBe("Book the flight: £3,100 there and back");
    expect(text["setpiece.december.a.party-uk.big"]).toBe("Go big: £227");
  });
});
