// Every tile's run through the front door, on the real content (prologue.md R-PROLOGUE-010, 013, 014): the typed name,
// the tile and the page, Begin; then the life from sixteen plays the tile's preset with no card, and the page as the
// handover names the person, so every run ends in its own life.
import { savedCommands } from "@japacity/sim";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { App } from "../../App";
import { bootGame } from "../../authority/boot";
import { SAVE_KEY } from "../../authority/local";
import { readPerson } from "../../authority/person";
import { ARCHETYPES } from "../../shared/frontdoor/archetypes";
import { startArchetype, toTheArchetypes } from "../../shared/frontdoor/frontDoor.testing";
import type { GameStore } from "../../authority/store";
import { say } from "../../shared/words/text";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

afterEach(() => {
  localStorage.clear();
});

/** Waits out the prologue, keeping whether any card showed on the way; the page as the handover is then up. */
async function throughTheYears(store: GameStore): Promise<boolean> {
  let card = false;
  await waitFor(
    () => {
      card ||= document.querySelector("[data-prologue-card]") !== null;
      if (store.getState().choosingLife || store.getState().view?.prologue !== null) throw new Error("The years are still going by.");
      if (document.querySelector("[data-page-handover]") === null) throw new Error("No page yet.");
    },
    { timeout: 10_000, interval: 5 },
  );
  return card;
}

describe("every tile's run", () => {
  test.each(ARCHETYPES.map((archetype) => [archetype.id, archetype] as const))("[R-PROLOGUE-010] [R-PROLOGUE-013] given the %s's tile at the front door, when the run is played to Begin, then the life plays the tile's preset with no card and ends on its page under the typed name", async (_, archetype) => {
    // The browser's own storage, as in play: the person kept at Begin is beside the save, so the authority keeps the tile's path open (R-PROLOGUE-011).
    const storage = localStorage;
    const store = bootGame({ storage, fastClock: true, makeSeed: () => `run-${archetype.id}` });
    render(<App store={store} />);
    const name = "Temi";
    await startArchetype(archetype.id, name);
    expect(readPerson()).toEqual({ look: expect.stringMatching(/^chr_/) as string, name, archetype: archetype.id });
    expect(await throughTheYears(store)).toBe(false);
    const raw = JSON.parse(storage.getItem(SAVE_KEY)!) as { save: Parameters<typeof savedCommands>[0] };
    const chosen = savedCommands(raw.save).flatMap(({ command }) => (command.type === "prologue/choose" ? [command] : []));
    // Every step the tile names was answered with one of its answers.
    expect(chosen.filter(({ step, answer }) => archetype.preset[step] !== undefined && !(archetype.preset[step] ?? []).includes(answer))).toEqual([]);
    expect(await screen.findByRole("heading", { name })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.prologue.start", { month: 1 }) }));
    await waitFor(() => expect(document.querySelector("[data-gate]")).toBeNull());
    expect(store.getState().view?.chapter.current).toBe("chapter.find-your-feet");
  }, 30000);
});

describe("the age set at the door", () => {
  test("[R-PROLOGUE-009] [R-PROLOGUE-013] given the nurse's tile stepped two years older under the tiles, when her life is played, then the age card takes the step with no card: two years on and the passport held", async () => {
    const store = bootGame({ storage: localStorage, fastClock: true, makeSeed: () => "run-older" });
    render(<App store={store} />);
    await toTheArchetypes("Ifeoma");
    fireEvent.click(await screen.findByRole("radio", { name: say("prologue.archetype.nurse.name") }));
    for (let step = 0; step < 2; step += 1) fireEvent.click(screen.getByRole("button", { name: say("prologue.door.age.older") }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("ui.door.next")}`) }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("ui.door.begin")}`) }));
    expect(await throughTheYears(store)).toBe(false);
    const view = store.getState().view!;
    expect(view.prologue).toBeNull();
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY)!) as { save: Parameters<typeof savedCommands>[0] };
    const chosen = savedCommands(raw.save).flatMap(({ command }) => (command.type === "prologue/choose" ? [command] : []));
    expect(chosen.find((command) => command.step === "age")?.answer).toBe("older-2");
    expect(view.documents.some((paper) => paper.id === "document.passport" && paper.state === "held")).toBe(true);
    const age = view.qualities.find((quality) => quality.id === "quality.age-months")?.value ?? 0;
    // The nurse's card comes at 23 or a little after; two years on is 25 and some months.
    expect(Math.floor(age / 12)).toBeGreaterThanOrEqual(25);
    expect(Math.floor(age / 12)).toBeLessThanOrEqual(26);
  }, 30000);
});

describe("the home picked at the door", () => {
  test("[R-PROLOGUE-013] [R-PROLOGUE-010] given the accountant's tile with the room of her own picked under it, when the life is played, then the home step takes the room, its year and fees are paid and the life closes in the room owing the next year's rent in twelve months", async () => {
    // Makoko is the child of the water's alone; the room is every tile's.
    const store = bootGame({ storage: localStorage, fastClock: true, makeSeed: () => "run-makoko" });
    render(<App store={store} />);
    await toTheArchetypes();
    fireEvent.click(await screen.findByRole("radio", { name: say("prologue.archetype.accountant.name") }));
    expect(screen.queryByRole("radio", { name: say("ui.door.home.makoko") })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: say("ui.door.home.compound-room") }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("ui.door.next")}`) }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("ui.door.begin")}`) }));
    expect(await throughTheYears(store)).toBe(false);
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY)!) as { save: Parameters<typeof savedCommands>[0] };
    const chosen = savedCommands(raw.save).flatMap(({ command }) => (command.type === "prologue/choose" ? [command] : []));
    expect(chosen.find((command) => command.step === "home")?.answer).toBe("compound-room");
    const view = store.getState().view!;
    expect(view.home.place).toBe("place.compound-room");
    expect(view.obligations.map((owed) => owed.entry).sort()).toEqual(["obligation.rent-compound", "obligation.upkeep-compound"]);
  }, 30000);
});
