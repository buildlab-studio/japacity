// The age in steps (prologue.md R-PROLOGUE-009, the review) on the real content: never typed, a few
// years either side of the tile's own age inside 18 to 29, older with a little more saved and the passport held,
// younger with more years before the young-favouring routes close, applied as the prologue's own effects.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { answersInOrder, ARCHETYPES, type Archetype, presetAnswer, withAge } from "../frontdoor/archetypes";
import { newGame } from "../testing/fixtures";
import { formatMoney } from "../words/format";
import { say } from "../words/text";
import { AGE_CARD, ageSteps, ageStepWords, OLDEST, stepsOpen, YOUNGEST, youngLimitYears } from "./age";
import { middleMonths } from "./years";

const PROLOGUE = "scenario.prologue";
const AGE = "quality.age-months";
const PASSPORT = "document.passport";

/** Plays the tile's preset with the age step, the open cards as the tile leans; the age when the card came, and the game. */
function play(archetype: Archetype, step: number, seed: string) {
  const game = newGame(PROLOGUE, seed);
  let atCard: number | null = null;
  const tile = withAge(archetype, step);
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    if (prologue.step === AGE_CARD) atCard = game.state.quality[AGE] ?? 0;
    const answer = presetAnswer(tile, prologue) ?? answersInOrder(tile, prologue.step, prologue.answers).find((one) => one.allowed)?.id;
    if (answer === undefined) throw new Error(`No open answer at ${prologue.step}.`);
    game.accept({ type: "prologue/choose", step: prologue.step, answer });
  }
  if (atCard === null) throw new Error("The age card never came.");
  return { game, atCard };
}

const naira = (game: ReturnType<typeof newGame>): number => game.view().pockets.NGN.bank + game.view().pockets.NGN.cash;

describe("the age card", () => {
  test("[R-PROLOGUE-009] given the real content, then the age card comes after the send-off and before the home, takes no months, and steps a few years either side", () => {
    expect(content.prologue["friend"]?.next).toBe(AGE_CARD);
    expect(content.prologue[AGE_CARD]?.next).toBe("home");
    expect(content.prologue[AGE_CARD]?.months).toBe(0);
    expect(ageSteps().map((one) => one.years)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
    // The card's first answer changes nothing, so a life that only takes the first open answer keeps its years.
    expect(content.prologue[AGE_CARD]?.answers[0]?.effects).toEqual([]);
    expect(YOUNGEST).toBe(18);
    expect(OLDEST).toBe(29);
  });

  test("[R-PROLOGUE-009] given each tile's own age as the middle, then the steps open are those that keep the start inside 18 to 29", () => {
    for (const archetype of ARCHETYPES) {
      const middle = middleMonths(archetype);
      const open = stepsOpen(middle);
      expect(open).toContain(0);
      for (const step of ageSteps()) {
        const years = Math.floor((middle + step.years * 12) / 12);
        expect(open.includes(step.years), `${archetype.id} ${String(step.years)}`).toBe(years >= YOUNGEST && years <= OLDEST);
      }
    }
    // The edges: a card reached at 18 and a few months opens no younger step; at 29 and some, no older one.
    expect(stepsOpen(18 * 12 + 4).filter((years) => years < 0)).toEqual([]);
    expect(stepsOpen(29 * 12 + 4).filter((years) => years > 0)).toEqual([]);
    expect(stepsOpen(19 * 12)).toContain(-1);
    expect(stepsOpen(28 * 12 + 11)).toContain(1);
  });

  test("[R-PROLOGUE-009] given every tile and every step open at its middle, when its run is played with the step, then the life closes that many years from the card, older with the saving and from two years the passport, and inside 18 to 29", () => {
    const wrong: string[] = [];
    for (const archetype of ARCHETYPES) {
      const seed = `age-${archetype.id}`;
      const plain = play(archetype, 0, seed);
      for (const years of stepsOpen(middleMonths(archetype))) {
        const step = ageSteps().find((one) => one.years === years)!;
        const { game, atCard } = play(archetype, years, seed);
        const age = game.state.quality[AGE] ?? 0;
        if (game.state.prologue.open) wrong.push(`${archetype.id} ${String(years)}: still open`);
        if (age !== atCard + years * 12) wrong.push(`${archetype.id} ${String(years)}: ${String(age)} months, card at ${String(atCard)}`);
        if (Math.floor(age / 12) < YOUNGEST || Math.floor(age / 12) > OLDEST) wrong.push(`${archetype.id} ${String(years)}: ${String(age)} months`);
        if (naira(game) - naira(plain.game) !== step.saved) wrong.push(`${archetype.id} ${String(years)}: saved ${String(naira(game) - naira(plain.game))}`);
        const passport = game.view().documents.some((paper) => paper.id === PASSPORT && paper.state === "held");
        if (passport !== step.passport) wrong.push(`${archetype.id} ${String(years)}: passport ${String(passport)}`);
      }
    }
    expect(wrong).toEqual([]);
    expect(ageSteps().filter((step) => step.years > 0).every((step) => step.saved > 0)).toBe(true);
    expect(ageSteps().filter((step) => step.years <= 0).every((step) => step.saved === 0 && !step.passport)).toBe(true);
    expect(ageSteps().filter((step) => step.years >= 2).every((step) => step.passport)).toBe(true);
  });

  test("[R-PROLOGUE-009] given a step the card cannot take after the draws, when the run reaches the card, then the nearest step toward the middle is taken", () => {
    const tile = withAge(ARCHETYPES[0]!, 3);
    expect(tile.preset[AGE_CARD]).toEqual(["older-3", "older-2", "older-1", "as-is"]);
    expect(withAge(ARCHETYPES[0]!, -2).preset[AGE_CARD]).toEqual(["younger-2", "younger-1", "as-is"]);
    expect(withAge(ARCHETYPES[0]!, 0).preset[AGE_CARD]).toEqual(["as-is"]);
  });

  test("[R-PROLOGUE-009] given an age step, then the page says what it does in content's words: the saving and the passport for older, the years before Canada's age points fall for younger", () => {
    const limit = youngLimitYears();
    expect(limit).toBe(30);
    const older = ageSteps().find((step) => step.years === 2)!;
    expect(ageStepWords(2, 23 * 12)).toBe(say("prologue.age.older.passport", { amount: formatMoney(older.saved, "NGN") }));
    expect(ageStepWords(1, 23 * 12)).toBe(say("prologue.age.older", { amount: formatMoney(ageSteps().find((step) => step.years === 1)!.saved, "NGN") }));
    expect(ageStepWords(-2, 23 * 12)).toBe(say("prologue.age.younger", { count: limit - 21 }));
    expect(ageStepWords(0, 23 * 12)).toBe(say("prologue.age.as-is", { count: limit - 23 }));
    // Counted from the age the step lands at: 23 years and 9 months is 6 whole years before 30, beside "About 24".
    expect(ageStepWords(0, 23 * 12 + 9)).toBe(say("prologue.age.as-is", { count: limit - 24 }));
    expect(ageStepWords(-1, 23 * 12 + 9)).toBe(say("prologue.age.younger", { count: limit - 23 }));
    expect(ageStepWords(1, 23 * 12)).toContain("₦120,000");
    expect(ageStepWords(2, 23 * 12)).toContain("passport");
  });
});
