// The door's third screen, Where you live, and the page after Begin (prologue.md R-PROLOGUE-013, 014):
// before Begin nothing is drawn or lived yet, so nothing is printed: no data page, no family, no money or japacity
// figure; the strip at the top goes back to the look and name and to the path and age. The page prints after Begin,
// where the years the tile will pass stand not yet lived until they are, and it says where the life starts and when its
// rent comes round.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { App } from "../../app/App";
import { bootGame } from "../../authority/boot";
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

/** Through the first two screens on a tile, to Where you live. */
async function toTheArchetypesFor(id: string): Promise<void> {
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${say("ui.door.next")}`) }));
  fireEvent.click(screen.getByRole("radio", { name: say(`prologue.archetype.${id}.name`) }));
  fireEvent.click(button("ui.door.next"));
}

describe("the door's page", () => {
  test("[R-PROLOGUE-013] [R-PROLOGUE-014] given Where you live before Begin, then nothing is printed that is not yet true: no page, no family, no money or japacity figure and no year lived; the strip at the top goes back to the look and name, and to the path and age", () => {
    door();
    fireEvent.click(button("ui.door.skip"));
    expect(stage()).toBe("page");
    for (const unprinted of ["[data-page]", "[data-family]", "[data-stat]", "[data-years]", "[data-japacity-line]"]) expect({ unprinted, there: document.querySelector(unprinted) !== null }).toEqual({ unprinted, there: false });
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.edit.life") }));
    expect(stage()).toBe("life");
    fireEvent.click(button("ui.door.next"));
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

  test("[R-PROLOGUE-013] [R-PROLOGUE-014] given the room picked on Where you live, when Begin is pressed and the years are in, then the page after Begin says where the life starts and that rent comes round in twelve months", async () => {
    render(<App store={bootGame({ storage: localStorage, fastClock: true, makeSeed: () => "page-room" })} />);
    await toTheArchetypesFor("accountant");
    fireEvent.click(screen.getByRole("radio", { name: say("ui.door.home.compound-room") }));
    fireEvent.click(button("ui.door.begin"));
    await waitFor(() => expect(document.querySelector("[data-page-handover]")).not.toBeNull(), { timeout: 10_000 });
    const line = document.querySelector("[data-starts-in] [data-fact='home']");
    expect(document.querySelector("[data-starts-in]")?.getAttribute("data-starts-in")).toBe("compound-room");
    expect(line?.textContent).toBe(`${say("ui.page.home.compound-room")}${say("ui.page.home.costs.prepaid", { count: 12 })}`);
  });
});
