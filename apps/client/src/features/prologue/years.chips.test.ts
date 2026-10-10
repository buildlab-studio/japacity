// The page's setback chips (prologue.md R-PROLOGUE-004, R-PROLOGUE-014; decision 0023): the age picked is the age the
// life starts at, so a retake or a strike costs years of work before it, never the age, and its chip says the work lost.
import { describe, expect, test } from "vitest";

import { startYearFor } from "../../shared/datapage/age";
import { archetypeOf, doorAnswer, withAge } from "../../shared/frontdoor/archetypes";
import { newGame } from "../../shared/testing/fixtures";
import { say } from "../../shared/words/text";
import { type TrailStep, yearChips } from "./years";

const AGE = "quality.age-months";

/** A developer stepped three years older on the door, played with the door's answers; the trail the page keeps. */
function lived(seed: string) {
  const archetype = withAge(archetypeOf("developer")!, 3);
  const game = newGame("scenario.prologue", seed);
  const trail: TrailStep[] = [];
  for (let guard = 0; guard < 60 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    const answer = doorAnswer(archetype, prologue);
    if (answer === null) throw new Error(`No open answer at ${prologue.step}.`);
    trail.push({ step: prologue.step, answer, outcome: null });
    game.accept({ type: "prologue/choose", step: prologue.step, answer });
  }
  return { trail, view: game.view(), months: game.state.quality[AGE] ?? 0 };
}

const passed = (life: { trail: TrailStep[] }, step: string): boolean => life.trail.some((one) => one.step === step);

describe("the setback chips", () => {
  test("[R-PROLOGUE-004] [R-PROLOGUE-014] given a degree three years older with a retake, a strike or both, when the page tells the years, then each setback's chip says the work it cost before the age picked", () => {
    const lives = Array.from({ length: 80 }, (_, at) => lived(`chips-${String(at)}`));
    const notes = (life: (typeof lives)[number]): Record<string, string | null> =>
      Object.fromEntries(yearChips({ draw: null, steps: life.trail }, life.view).filter((chip) => chip.state === "setback").map((chip) => [chip.id.replace(/-\d+$/, ""), chip.note]));
    const year = say("ui.page.year.lost.one");
    // The degree's path ends at 23 and 1 month. A retake (its year and the exam again, 15 months) puts it past 24: a
    // year of work lost. A strike alone (8 months) leaves it in 23: no work lost. After a retake, the strike puts it past 25.
    const retakeOnly = lives.find((life) => passed(life, "retake") && !passed(life, "strike-drag"));
    const strikeOnly = lives.find((life) => !passed(life, "retake") && passed(life, "strike-drag"));
    const both = lives.find((life) => passed(life, "retake") && passed(life, "strike-drag"));
    if (retakeOnly === undefined || strikeOnly === undefined || both === undefined) throw new Error("Not every setback came in 80 seeds.");
    expect(notes(retakeOnly)).toEqual({ retake: year });
    expect(notes(strikeOnly)).toEqual({ strike: say("ui.page.year.lost.zero") });
    expect(notes(both)).toEqual({ retake: year, strike: year });
    for (const life of [retakeOnly, strikeOnly, both]) expect(Math.floor(life.months / 12)).toBe(startYearFor(archetypeOf("developer")!, 3));
  });
});

describe("the child of the water's chips", () => {
  test("[R-PROLOGUE-012] [R-PROLOGUE-014] given the child of the water's years played with the door's answers, when the page tells them, then the chips are hers: school by canoe and the fish racks, never a shop counter; the shop worker's same years keep the counter", () => {
    const trailOf = (id: string) => {
      const archetype = archetypeOf(id)!;
      const game = newGame("scenario.prologue", `${id}-chips`);
      const trail: TrailStep[] = [];
      for (let guard = 0; guard < 60 && game.state.prologue.open; guard += 1) {
        const prologue = game.view().prologue!;
        const answer = doorAnswer(archetype, prologue)!;
        trail.push({ step: prologue.step, answer, outcome: null });
        game.accept({ type: "prologue/choose", step: prologue.step, answer });
      }
      return { trail, view: game.view() };
    };
    const water = trailOf("water");
    const hers = yearChips({ draw: null, steps: water.trail }, water.view, true).map((chip) => chip.label);
    expect(hers).toContain("School by canoe");
    expect(hers).toContain("The fish racks");
    expect(hers).not.toContain(say("ui.page.year.shop"));
    const shop = trailOf("shop-worker");
    expect(yearChips({ draw: null, steps: shop.trail }, shop.view).map((chip) => chip.label)).toContain(say("ui.page.year.shop"));
  });
});
