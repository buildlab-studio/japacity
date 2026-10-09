// The home card's answers say what each costs (docs/rules/prologue.md R-PROLOGUE-009): "The family house" and "Your own room" showed no cost, which first showed on the handover.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { answerHint, PrologueView } from "./PrologueView";

/** The living costs an answer of the home card opens, from content. */
function upkeepOf(answer: string): number {
  const effect = content.prologue.home?.answers.find((candidate) => candidate.id === answer)?.effects.find((one) => one.type === "obligation/open");
  if (effect?.type !== "obligation/open" || typeof effect.amount !== "number") throw new Error(`No living costs for ${answer}.`);
  return effect.amount;
}

describe("the home card", () => {
  test("[R-PROLOGUE-009] given the card that asks where you sleep, when its answers show, then each says its living costs a month, as every other card says its cost", async () => {
    const house = formatMoney(upkeepOf("family-house"), "NGN");
    const room = formatMoney(upkeepOf("room"), "NGN");
    expect(answerHint("home", "family-house")).toBe(`Living costs: ${house} a month.`);
    expect(answerHint("home", "room")).toBe(`Living costs: ${room} a month.`);
    expect(house).toBe("₦95,000");
    expect(room).toBe("₦180,000");
    const base = engineView("scenario.prologue");
    const view = { ...base, prologue: { step: "home", answers: [{ id: "family-house", allowed: true }, { id: "room", allowed: false }], lastOutcome: null, draw: null } };
    await renderWithView(<PrologueView />, view);
    const shown = document.querySelector("[data-prologue-card]")?.textContent ?? "";
    expect(shown).toContain(`Living costs: ${house} a month.`);
    // Shut for want of cash, the room still says what it would cost.
    expect(shown).toContain(`Living costs: ${room} a month.`);
  });
});
