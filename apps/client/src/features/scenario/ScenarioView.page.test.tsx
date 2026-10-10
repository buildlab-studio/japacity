// The door's third screen as designed (prologue.md R-PROLOGUE-013, 014; the design): the
// header over the travel data page, the page with its name, age, so far, family and ready, and under it in the sheet the
// family card, the years before as chips, where the life starts, the money and japacity boxes with the one line that
// says what japacity is, and the two links back. Before Begin nothing is drawn or lived yet, so the page says so: the
// family face down, the years not yet, and no figure printed that is not yet true.
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority } from "../../authority/local";
import { createGameStore } from "../../authority/store";
import { ARCHETYPES, archetypeOf } from "../../shared/frontdoor/archetypes";
import { say } from "../../shared/words/text";
import { plannedYears, ScenarioView } from "./ScenarioView";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

afterEach(() => {
  localStorage.clear();
});

function door(): void {
  const authority = localAuthority({ fastClock: true, storage: null, makeSeed: () => "page-seed", now: () => 0 });
  const store = createGameStore(authority, { life: authority, lifeAgain: true, choosingLife: true });
  render(
    <GameProvider store={store}>
      <ScenarioView />
    </GameProvider>,
  );
}

const stage = (): string | null => document.querySelector("[data-gate]")?.getAttribute("data-gate") ?? null;
const button = (key: string): HTMLElement => screen.getByRole("button", { name: new RegExp(`^${say(key)}`) });

describe("the door's page", () => {
  test("[R-PROLOGUE-013] [R-PROLOGUE-014] given the page before Begin, then the sheet holds the family face down, the years before not yet lived, where the life starts with what falls due, the money and japacity boxes with nothing printed yet, the line that says what japacity is, and the links back to the look and name and to the path and age", () => {
    door();
    fireEvent.click(button("ui.door.skip"));
    expect(stage()).toBe("page");
    const sheet = document.querySelector<HTMLElement>("[data-gate-sheet='page']")!;
    expect(sheet.querySelector("[data-family]")?.getAttribute("data-family")).toBe("face-down");
    expect(sheet.querySelector("[data-family]")?.textContent).toBe(say("ui.page.family.unseen"));
    const first = ARCHETYPES[0]!;
    const chips = [...sheet.querySelectorAll<HTMLElement>("[data-years-planned] [data-fact]")];
    expect(chips.map((chip) => chip.dataset["fact"])).toEqual(plannedYears(first).map((chip) => chip.id));
    expect(chips.every((chip) => chip.dataset["state"] === "waiting")).toBe(true);
    expect(sheet.querySelector("[data-page-home]")?.textContent).toContain(say("ui.page.home.family-house"));
    for (const stat of ["money", "ready"]) expect(sheet.querySelector(`[data-stat='${stat}']`)?.textContent).toContain(say("prologue.page.empty"));
    expect(sheet.querySelector("[data-japacity-line]")?.textContent).toBe(say("ui.page.japacity.line"));
    // The page prints the family and how ready only once they are true.
    expect(document.querySelector("[data-page] [data-field='family']")?.textContent).toContain(say("prologue.page.empty"));
    expect(document.querySelector("[data-page] [data-field='ready']")?.textContent).toContain(say("prologue.page.empty"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.edit.life") }));
    expect(stage()).toBe("life");
    fireEvent.click(button("prologue.door.print"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.edit.you") }));
    expect(stage()).toBe("you");
  });

  test("[R-PROLOGUE-014] given each tile, then the years it will pass are its own path's: the degree's school, exam, university and service; the trade's master; the counter's years at the shop", () => {
    expect(plannedYears(archetypeOf("nurse")!).map((chip) => chip.id)).toEqual(["waec", "exam", "university", "service"]);
    expect(plannedYears(archetypeOf("trader")!).map((chip) => chip.id)).toEqual(["waec", "master"]);
    expect(plannedYears(archetypeOf("shop-worker")!).map((chip) => chip.id)).toEqual(["waec", "shop"]);
    expect(plannedYears(archetypeOf("water")!).map((chip) => chip.id)).toEqual(["waec", "shop"]);
    for (const tile of ARCHETYPES) for (const chip of plannedYears(tile)) expect(chip.state).toBe("waiting");
  });

  test("[R-PROLOGUE-013] given the room picked, then the page's line says where the life starts and that rent comes round in twelve months", () => {
    door();
    fireEvent.click(button("ui.door.next"));
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.accountant.name") }));
    fireEvent.click(screen.getByRole("radio", { name: say("ui.door.home.compound-room") }));
    fireEvent.click(button("prologue.door.print"));
    const line = document.querySelector("[data-page-home]");
    expect(line?.getAttribute("data-page-home")).toBe("compound-room");
    expect(line?.textContent).toBe(`${say("ui.page.home.compound-room")}${say("ui.page.home.costs.prepaid", { count: 12 })}`);
  });
});
