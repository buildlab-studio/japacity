// The age the door prints (prologue.md R-PROLOGUE-004, R-PROLOGUE-009): "About 24" at the door
// opened at 23 yrs 1 mo for one developer and 25 yrs 0 mo for a nurse, since the cards' draws (an exam retaken, a strike)
// add their months. The simulation keeps the years the cards take; the door says so in a second line, and the page
// prints the same "About" as the door.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority } from "../../authority/local";
import { createGameStore } from "../../authority/store";
import { aboutYears, middleMonths } from "../../shared/datapage/years";
import { ARCHETYPES, answersInOrder, archetypeOf, presetAnswer } from "../../shared/frontdoor/archetypes";
import { newGame } from "../../shared/testing/fixtures";
import { say } from "../../shared/words/text";
import { ScenarioView } from "./ScenarioView";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

afterEach(() => {
  localStorage.clear();
});

const AGE = "quality.age-months";
const YEAR = 12;

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

/** The life a tile hands over, played on the engine with its preset; the steps the cards took on the way. */
function handedOver(id: string, seed: string): { months: number; steps: string[] } {
  const archetype = archetypeOf(id)!;
  const game = newGame("scenario.prologue", seed);
  const steps: string[] = [];
  for (let guard = 0; guard < 60 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    steps.push(prologue.step);
    const answer = presetAnswer(archetype, prologue) ?? answersInOrder(archetype, prologue.step, prologue.answers).find((one) => one.allowed)?.id;
    if (answer === undefined) throw new Error(`No open answer at ${prologue.step}.`);
    game.accept({ type: "prologue/choose", step: prologue.step, answer });
  }
  return { months: game.view().qualities.find((quality) => quality.id === AGE)?.value ?? 0, steps };
}

describe("the door's age and the page's", () => {
  test.each(ARCHETYPES.map((archetype) => [archetype.id, (archetype.preset["after-school"] ?? []).includes("jamb")] as const))("[R-PROLOGUE-009] [R-PROLOGUE-013] given the %s's tile with the age under it, when the age shows and the page is printed, then both say the same \"About\", and no line under the age speaks of a year an exam can cost (the tile sits the exam: %s)", (id, exam) => {
    door();
    fireEvent.change(screen.getByRole("textbox", { name: say("prologue.door.name.title") }), { target: { value: "Bola" } });
    fireEvent.click(next(say("ui.door.next")));
    fireEvent.click(screen.getByRole("radio", { name: say(`prologue.archetype.${id}.name`) }));
    const about = say("prologue.door.age.years", { years: aboutYears(middleMonths(archetypeOf(id)!)) });
    expect(document.querySelector("[data-age-years]")?.textContent).toBe(about);
    expect(document.querySelector("[data-age-give]")).toBeNull();
    expect(document.body.textContent).not.toContain(say("prologue.door.age.give-or-take"));
    expect(typeof exam).toBe("boolean");
    fireEvent.click(next(say("ui.door.next")));
    expect(document.querySelector("[data-page] [data-field='age']")?.textContent).toContain(about);
    expect(say("prologue.page.age.about", { years: 24 })).toBe(say("prologue.door.age.years", { years: 24 }));
  });

  test("[R-PROLOGUE-004] [R-PROLOGUE-009] given two nurses at the same step of the door and the same strike, when one passes the exam and one retakes it, then the one who retook opens one year older, as the door's second line says", () => {
    const lives = Array.from({ length: 40 }, (_, at) => handedOver("nurse", `nurse-age-${String(at)}`));
    const struck = (life: { steps: string[] }): boolean => life.steps.includes("strike-drag");
    const retook = (life: { steps: string[] }): boolean => life.steps.includes("retake");
    const passed = lives.find((life) => !retook(life) && !struck(life));
    const again = lives.find((life) => retook(life) && !struck(life));
    if (passed === undefined || again === undefined) throw new Error("No pair of nurses in 40 seeds.");
    expect(Math.floor((again.months - passed.months) / YEAR)).toBe(1);
    // The door's own figure is the life that passes, so the one who retook is a year past it, never two.
    expect(Math.abs(aboutYears(again.months) - aboutYears(passed.months))).toBe(1);
  });
});
