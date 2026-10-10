// The age the door prints (prologue.md R-PROLOGUE-004, R-PROLOGUE-009; decision 0023): the
// age picked is the age the life starts at, to the year. The door shows the tile's own year, the year its path reaches
// with no setback, and the page prints the same true number; a retake or a strike costs years of work before that
// age, never the age, and the page's setback chip says the work it cost.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority } from "../../authority/local";
import { createGameStore } from "../../authority/store";
import { startYearFor } from "../../shared/datapage/age";
import { ARCHETYPES, archetypeOf, doorAnswer, withAge } from "../../shared/frontdoor/archetypes";
import { newGame } from "../../shared/testing/fixtures";
import { say } from "../../shared/words/text";
import { type TrailStep, yearChips } from "../prologue/years";
import { ScenarioView } from "./ScenarioView";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

afterEach(() => {
  localStorage.clear();
});

const AGE = "quality.age-months";

function door(): void {
  const authority = localAuthority({ fastClock: true, storage: null, makeSeed: () => "run-seed", now: () => 0 });
  const store = createGameStore(authority, { life: authority, lifeAgain: true, choosingLife: true });
  render(
    <GameProvider store={store}>
      <ScenarioView />
    </GameProvider>,
  );
}

const next = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}`) });

/** The life a tile hands over stepped `older` years on the door, played on the engine with its preset; its age and the trail the page keeps. */
function handedOver(id: string, older: number, seed: string): { months: number; trail: TrailStep[]; life: ReturnType<ReturnType<typeof newGame>["view"]> } {
  const archetype = withAge(archetypeOf(id)!, older);
  const game = newGame("scenario.prologue", seed);
  const trail: TrailStep[] = [];
  for (let guard = 0; guard < 60 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    const answer = doorAnswer(archetype, prologue);
    if (answer === null) throw new Error(`No open answer at ${prologue.step}.`);
    trail.push({ step: prologue.step, answer, outcome: null });
    game.accept({ type: "prologue/choose", step: prologue.step, answer });
  }
  return { months: game.view().qualities.find((quality) => quality.id === AGE)?.value ?? 0, trail, life: game.view() };
}

const passed = (life: { trail: TrailStep[] }, step: string): boolean => life.trail.some((one) => one.step === step);

describe("the door's age and the page's", () => {
  test.each(ARCHETYPES.map((archetype) => archetype.id))("[R-PROLOGUE-004] [R-PROLOGUE-009] [R-PROLOGUE-013] given the %s's tile with the age under it, when the age shows and the page is printed, then both say the year its path reaches with no setback, the year its tile says, and never \"about\"", (id) => {
    door();
    fireEvent.change(screen.getByRole("textbox", { name: say("prologue.door.name.title") }), { target: { value: "Bola" } });
    fireEvent.click(next(say("ui.door.next")));
    fireEvent.click(screen.getByRole("radio", { name: say(`prologue.archetype.${id}.name`) }));
    const year = startYearFor(archetypeOf(id)!, 0);
    expect(say(`prologue.archetype.${id}.opens`)).toContain(`from ${String(year)}`);
    expect(document.querySelector("[data-age-years]")?.textContent).toBe(say("prologue.door.age.years", { years: year }));
    expect(document.querySelector("[data-age-give]")).toBeNull();
    expect(document.querySelector("[data-door-age]")?.textContent).not.toMatch(/about|give or take/i);
    fireEvent.click(next(say("ui.door.next")));
    expect(document.querySelector("[data-page] [data-field='age']")?.textContent).toContain(say("prologue.page.age.years", { years: year }));
    expect(document.querySelector("[data-page] [data-field='age']")?.textContent).not.toMatch(/about/i);
  });

  test("[R-PROLOGUE-004] [R-PROLOGUE-009] given nurses stepped two years older on the door, when some retake the exam and some pass, then every one of them starts in the year picked, and at her own year none retakes", () => {
    const picked = startYearFor(archetypeOf("nurse")!, 2);
    const lives = Array.from({ length: 40 }, (_, at) => handedOver("nurse", 2, `nurse-age-${String(at)}`));
    expect(lives.some((life) => passed(life, "retake"))).toBe(true);
    expect(lives.some((life) => !passed(life, "retake"))).toBe(true);
    for (const life of lives) expect(Math.floor(life.months / 12)).toBe(picked);
    const own = Array.from({ length: 40 }, (_, at) => handedOver("nurse", 0, `nurse-age-${String(at)}`));
    expect(own.some((life) => passed(life, "retake") || passed(life, "strike-drag"))).toBe(false);
    for (const life of own) expect(Math.floor(life.months / 12)).toBe(startYearFor(archetypeOf("nurse")!, 0));
  });

  test("[R-PROLOGUE-004] [R-PROLOGUE-014] given a degree three years older with a retake, a strike or both, when the page tells the years, then each setback's chip says the work it cost before the age picked", () => {
    const lives = Array.from({ length: 80 }, (_, at) => handedOver("developer", 3, `chips-${String(at)}`));
    const notes = (life: (typeof lives)[number]): Record<string, string | null> =>
      Object.fromEntries(yearChips({ draw: null, steps: life.trail }, life.life).filter((chip) => chip.state === "setback").map((chip) => [chip.id.replace(/-\d+$/, ""), chip.note]));
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
