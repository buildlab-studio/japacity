// The front door as the design's data page onboarding (prologue.md R-PROLOGUE-009, 010; the review items 14 and
// 15): one question a screen in a sheet over the compound (the look, the tile, the typed name), every answer printed
// onto the travel data page with the look as the photo, "Begin" stamps it and the life starts; a reload at any step
// comes back to that step.
import { render, screen, waitFor, within, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority } from "../../authority/local";
import { readPerson } from "../../authority/person";
import { createGameStore, type GameStore } from "../../authority/store";
import { DOOR_KEY } from "../../shared/datapage/door";
import { problemWords } from "../../shared/datapage/name";
import { LOOKS } from "../../shared/frontdoor/looks";
import { say } from "../../shared/words/text";
import { ScenarioView } from "./ScenarioView";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

afterEach(() => {
  localStorage.clear();
});

function door(): GameStore {
  const authority = localAuthority({ fastClock: true, storage: null, makeSeed: () => "run-seed", now: () => 0 });
  const store = createGameStore(authority, { life: authority, lifeAgain: true, choosingLife: true });
  render(
    <GameProvider store={store}>
      <ScenarioView />
    </GameProvider>,
  );
  return store;
}

const stage = (): string | null => document.querySelector("[data-gate]")?.getAttribute("data-gate") ?? null;
const next = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}`) });
const nameBox = () => screen.getByRole<HTMLInputElement>("textbox", { name: say("prologue.door.name.title") });

describe("the run through the front door", () => {
  test("[R-PROLOGUE-009] given a new player, when they pick a look, a tile and type a name, then each is one screen, the page prints them with the look as the photo, and Begin stamps it and starts the tile's life", async () => {
    const store = door();
    expect(stage()).toBe("you");
    const look = LOOKS.find((one) => one.id === "chr_ngozi")!;
    fireEvent.click(document.querySelector(`[role="radio"][data-look="${look.id}"]`)!);
    fireEvent.click(next(say("ui.door.next")));
    expect(stage()).toBe("path");
    fireEvent.click(screen.getByRole("button", { name: say("prologue.archetype.nurse.name") }));
    expect(stage()).toBe("name");
    // One question a screen: no tile and no look strip under the name box.
    expect(document.querySelector("[data-archetypes]")).toBeNull();
    expect(document.querySelector("[data-looks]")).toBeNull();
    fireEvent.change(nameBox(), { target: { value: "Ifeoma" } });
    fireEvent.click(next(say("prologue.door.print")));
    expect(stage()).toBe("page");
    const page = document.querySelector<HTMLElement>("[data-page]")!;
    expect(page.querySelector("[data-field='name']")?.textContent).toContain("Ifeoma");
    expect(page.querySelector("[data-field='path']")?.textContent).toContain(say("prologue.archetype.nurse.name"));
    expect(page.querySelector("[data-field='age']")?.textContent).toMatch(/\d+/);
    expect(page.querySelector<HTMLImageElement>("[data-photo] img")?.getAttribute("src")).toBe(look.picture);
    // Nothing is begun before Begin: the person is kept only then.
    expect(readPerson()).toBeNull();
    fireEvent.click(next(say("ui.door.begin")));
    expect(await screen.findByText(say("prologue.page.stamp.ready"))).toBeDefined();
    await waitFor(() => expect(store.getState().choosingLife).toBe(false), { timeout: 4000 });
    expect(store.getState().view?.scenario).toBe("scenario.prologue");
    expect(readPerson()).toEqual({ look: look.id, name: "Ifeoma", archetype: "nurse" });
  });

  test("[R-PROLOGUE-009] given the name box, then three names from the pool for the look sit under it with a reroll, a tap fills the box, and a name that fails the checks is refused in words", () => {
    door();
    fireEvent.click(next(say("ui.door.next")));
    fireEvent.click(screen.getByRole("button", { name: say("prologue.archetype.developer.name") }));
    const offered = within(screen.getByRole("group", { name: say("prologue.door.name.suggested") })).getAllByRole("button").map((button) => button.textContent);
    expect(offered).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.reroll") }));
    const rerolled = within(screen.getByRole("group", { name: say("prologue.door.name.suggested") })).getAllByRole("button").map((button) => button.textContent);
    expect(rerolled).not.toEqual(offered);
    fireEvent.click(within(screen.getByRole("group", { name: say("prologue.door.name.suggested") })).getAllByRole("button")[1]!);
    expect(nameBox().value).toBe(rerolled[1]);

    fireEvent.change(nameBox(), { target: { value: "Ada1" } });
    fireEvent.click(next(say("prologue.door.print")));
    expect(stage()).toBe("name");
    expect(screen.getByRole("alert").textContent).toBe(problemWords("letters"));
    fireEvent.change(nameBox(), { target: { value: "Japacity" } });
    expect(screen.getByRole("alert").textContent).toBe(problemWords("reserved"));
    fireEvent.change(nameBox(), { target: { value: "" } });
    fireEvent.click(next(say("prologue.door.print")));
    expect(screen.getByRole("alert").textContent).toBe(problemWords("short"));
    fireEvent.change(nameBox(), { target: { value: "Tobi" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(next(say("prologue.door.print")));
    expect(stage()).toBe("page");
  });

  test("[R-PROLOGUE-009] given a reload at any step, then the door comes back to that step with what was answered", () => {
    door();
    fireEvent.click(document.querySelector(`[role="radio"][data-look="chr_femi"]`)!);
    cleanup();
    door();
    expect(stage()).toBe("you");
    expect(document.querySelector("[data-gate]")?.getAttribute("data-look")).toBe("chr_femi");
    fireEvent.click(next(say("ui.door.next")));
    cleanup();
    door();
    expect(stage()).toBe("path");
    fireEvent.click(screen.getByRole("button", { name: say("prologue.archetype.trader.name") }));
    fireEvent.change(nameBox(), { target: { value: "Emeka" } });
    cleanup();
    door();
    expect(stage()).toBe("name");
    expect(nameBox().value).toBe("Emeka");
    fireEvent.click(next(say("prologue.door.print")));
    cleanup();
    door();
    expect(stage()).toBe("page");
    expect(document.querySelector("[data-page] [data-field='name']")?.textContent).toContain("Emeka");
    expect(document.querySelector("[data-page] [data-field='path']")?.textContent).toContain(say("prologue.archetype.trader.name"));
    expect(localStorage.getItem(DOOR_KEY)).not.toBeNull();
  });

  test("[R-PROLOGUE-009] given the ready lives' card, when a ready life is picked, then the run goes on to the name and the page, and Begin starts that life with its own age printed", async () => {
    const store = door();
    fireEvent.click(next(say("ui.door.next")));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("ui.door.ready")}`) }));
    expect(stage()).toBe("ready");
    fireEvent.click(screen.getByRole("button", { name: `${say("prologue.door.pick")}: ${say("scenario.tunde.kind")}` }));
    expect(stage()).toBe("name");
    fireEvent.change(nameBox(), { target: { value: "Bayo" } });
    fireEvent.click(next(say("prologue.door.print")));
    expect(document.querySelector("[data-page] [data-field='path']")?.textContent).toContain(say("scenario.tunde.kind"));
    expect(document.querySelector("[data-page] [data-field='age']")?.textContent).toContain(say("prologue.page.age.about", { years: 29 }));
    fireEvent.click(next(say("ui.door.begin")));
    await waitFor(() => expect(store.getState().view?.scenario).toBe("scenario.tunde"), { timeout: 4000 });
    expect(readPerson()?.name).toBe("Bayo");
    expect(readPerson()?.archetype).toBeNull();
  });

  test("[R-PROLOGUE-009] given a step past the first, then a back button returns to the step before with its answer kept", () => {
    door();
    fireEvent.click(next(say("ui.door.next")));
    fireEvent.click(screen.getByRole("button", { name: say("prologue.archetype.writer.name") }));
    fireEvent.change(nameBox(), { target: { value: "Kemi" } });
    fireEvent.click(next(say("prologue.door.print")));
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
    expect(stage()).toBe("name");
    expect(nameBox().value).toBe("Kemi");
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
    expect(stage()).toBe("path");
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
    expect(stage()).toBe("you");
    expect(screen.queryByRole("button", { name: say("ui.door.back") })).toBeNull();
  });
});
