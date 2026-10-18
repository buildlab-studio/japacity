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
      expect(effectsOf(`go-${suffix}`, "go")).toEqual([{ type: "money/take", currency, pocket: "transfer", amount, reason: "fare" }]);
      expect(effectsOf(`go-${suffix}`, "stay")).toEqual([]);
    }
  });

  test("[R-RETURN-005] given the spending questions, when their answers are read, then each moves the page's qualities, the costly ones pay in the country's currency, and the free one comes first", () => {
    expect(effectsOf("party-uk", "big")).toEqual([
      { type: "money/take", currency: "GBP", pocket: "transfer", amount: 22700, reason: "social" },
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

  test("[R-SETPIECE-001] [R-SETPIECE-004] given the entry, when its order and its going questions are read, then it is asked in the order written, each country's going question comes first, and staying closes the scene", () => {
    expect(december.order).toBe("fixed");
    for (const suffix of ["uk", "ca", "uae", "it"]) {
      const own = december.questions.filter((item) => item.id.endsWith(`-${suffix}`)).map((item) => item.id);
      expect(own).toEqual([`go-${suffix}`, `party-${suffix}`, `gifts-${suffix}`, `look-${suffix}`]);
      expect(question(`go-${suffix}`).answers.map((answer) => answer.closes ?? false)).toEqual([true, false]);
    }
    expect(december.questions.flatMap((item) => item.answers).filter((answer) => answer.closes === true)).toHaveLength(4);
  });

  test("[R-SETPIECE-003] given every answer, when its requirements are read, then each that pays requires that much in the currency it takes, each that pays nothing requires nothing, and every question has one", () => {
    for (const item of december.questions) {
      for (const answer of item.answers) {
        const takes = answer.effects.filter((effect) => effect.type === "money/take");
        expect(answer.requires ?? []).toEqual(takes.map((take) => ({ type: "money/min", currency: take.currency, amount: take.amount })));
      }
    }
    for (const item of december.questions) expect(item.answers.some((answer) => (answer.requires ?? []).length === 0)).toBe(true);
    expect(question("go-uk").answers.find((answer) => answer.id === "go")?.requires).toEqual([{ type: "money/min", currency: "GBP", amount: 310000 }]);
  });

  test("[R-LUCK-008] given the staged December line, when its words are looked up, then they are there", () => {
    expect(text["line.setpiece.december-go"] ?? "").not.toBe("");
  });
});
