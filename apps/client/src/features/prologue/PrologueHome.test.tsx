// The home card's answers say what each costs (docs/rules/prologue.md R-PROLOGUE-009): "The family house" and "Your own room" showed no cost, which first showed on the handover.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { answerHint, PageHandover, PrologueView } from "./PrologueView";

/** The living costs an answer of the home card opens, from content. */
function upkeepOf(answer: string): number {
  const effect = content.prologue.home?.answers.find((candidate) => candidate.id === answer)?.effects.find((one) => one.type === "obligation/open");
  if (effect?.type !== "obligation/open" || typeof effect.amount !== "number") throw new Error(`No living costs for ${answer}.`);
  return effect.amount;
}

describe("the home card", () => {
  test("[R-PROLOGUE-009] [R-PROLOGUE-013] given the card that asks where you sleep, when its answers show, then there are the family house and Makoko only, and each says its living costs a month, as every other card says its cost", async () => {
    const house = formatMoney(upkeepOf("family-house"), "NGN");
    const makoko = formatMoney(upkeepOf("makoko"), "NGN");
    expect(content.prologue.home?.answers.map((answer) => answer.id)).toEqual(["family-house", "makoko"]);
    expect(answerHint("home", "family-house")).toBe(`Living costs: ${house} a month.`);
    expect(house).toBe("₦95,000");
    expect(makoko).toBe("₦25,000");
    const base = engineView("scenario.prologue");
    const view = { ...base, prologue: { step: "home", answers: [{ id: "family-house", allowed: true }, { id: "makoko", allowed: true }], lastOutcome: null, draw: null } };
    await renderWithView(<PrologueView />, view);
    const shown = document.querySelector("[data-prologue-card]")?.textContent ?? "";
    expect(shown).toContain(`Living costs: ${house} a month.`);
    expect(shown).toContain(`Living costs: ${makoko} a month.`);
  });
});

describe("the page's home", () => {
  test("[R-PROLOGUE-012] [R-PROLOGUE-014] given a life that closed on a room in Makoko, when the page tells where it sleeps, then the page says it starts in the room on the water in Makoko, with the rent next month", async () => {
    const base = engineView();
    const rent = upkeepOf("makoko");
    const family = base.obligations[0];
    if (family === undefined) throw new Error("The fixture owes nothing.");
    const view = {
      ...base,
      home: { ...base.home, place: "place.makoko" as const, rent: { currency: "NGN" as const, amount: rent } },
      obligations: [{ ...family, entry: "obligation.upkeep-makoko" as const, amount: rent }],
    };
    await renderWithView(<PageHandover onDone={() => undefined} />, view);
    const home = document.querySelector("[data-handover-story] [data-fact='home']");
    expect(home?.textContent).toBe(`${say("ui.page.home.makoko")}${say("ui.page.home.costs", { amount: formatMoney(rent, "NGN") })}`);
    expect(home?.textContent).toBe("You start in a room on the water, MakokoRent next month: ₦25,000");
  });
});
