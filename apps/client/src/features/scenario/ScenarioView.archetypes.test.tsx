// Every tile's run through the front door, on the real content (prologue.md R-PROLOGUE-009, 010): the look, the tile,
// the typed name and the page, Begin; then the life from sixteen plays the tile's preset, only its open cards show,
// and the handover names the person, so every run ends in its own life.
import { savedCommands } from "@japacity/sim";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { App } from "../../App";
import { bootGame } from "../../authority/boot";
import { SAVE_KEY } from "../../authority/local";
import { readPerson } from "../../authority/person";
import { answersInOrder, ARCHETYPES } from "../../shared/frontdoor/archetypes";
import { startArchetype, toTheArchetypes } from "../../shared/frontdoor/frontDoor.testing";
import { say, words } from "../../shared/words/text";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

afterEach(() => {
  localStorage.clear();
});

describe("every tile's run", () => {
  test.each(ARCHETYPES.map((archetype) => [archetype.id, archetype] as const))("[R-PROLOGUE-009] [R-PROLOGUE-010] given the %s's tile at the front door, when the run is played to Begin, then the life plays the tile's preset and ends handed over under the typed name", async (_, archetype) => {
    // The browser's own storage, as in play: the person kept at Begin is beside the save, so the authority keeps the tile's path open (R-PROLOGUE-011).
    const storage = localStorage;
    const store = bootGame({ storage, fastClock: true, makeSeed: () => `run-${archetype.id}` });
    render(<App store={store} />);
    const name = "Temi";
    await startArchetype(archetype.id, name);
    expect(readPerson()).toEqual({ look: expect.stringMatching(/^chr_/) as string, name, archetype: archetype.id });
    for (let guard = 0; guard < 40; guard += 1) {
      await waitFor(() => {
        if (store.getState().view?.prologue === null) return;
        if (document.querySelector("[data-prologue-card]") === null) throw new Error("No card yet.");
      });
      const view = store.getState().view!;
      if (view.prologue === null) break;
      const answer = answersInOrder(archetype, view.prologue.step, view.prologue.answers).find((one) => one.allowed)!;
      const card = document.querySelector<HTMLElement>("[data-prologue-card]")!;
      fireEvent.click(within(card).getByRole("button", { name: words(`prologue.${view.prologue.step}.answer.${answer.id}`) }));
      await waitFor(() => expect(store.getState().view?.v).toBeGreaterThan(view.v));
    }
    expect(store.getState().view?.prologue).toBeNull();
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
  test("[R-PROLOGUE-009] given the nurse's tile stepped two years older at the door, when her life is played, then the age card takes the step: two years on and the passport held", async () => {
    const store = bootGame({ storage: localStorage, fastClock: true, makeSeed: () => "run-older" });
    render(<App store={store} />);
    await toTheArchetypes();
    fireEvent.click(await screen.findByRole("button", { name: say("prologue.archetype.nurse.name") }));
    fireEvent.change(await screen.findByRole("textbox", { name: say("prologue.door.name.title") }), { target: { value: "Ifeoma" } });
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("ui.door.next")}`) }));
    for (let step = 0; step < 2; step += 1) fireEvent.click(screen.getByRole("button", { name: say("prologue.door.age.older") }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("prologue.door.print")}`) }));
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("ui.door.begin")}`) }));
    const nurse = ARCHETYPES.find((one) => one.id === "nurse")!;
    for (let guard = 0; guard < 60; guard += 1) {
      await waitFor(
        () => {
          const view = store.getState().view;
          if (store.getState().choosingLife || view === null) throw new Error("Not begun yet.");
          if (view.prologue === null || document.querySelector("[data-prologue-card]") !== null) return;
          throw new Error("No card yet.");
        },
        { timeout: 4000 },
      );
      const view = store.getState().view!;
      if (view.prologue === null) break;
      if (view.prologue.step === "age") throw new Error("The age card showed; the preset should send it.");
      const answer = answersInOrder(nurse, view.prologue.step, view.prologue.answers).find((one) => one.allowed)!;
      fireEvent.click(within(document.querySelector<HTMLElement>("[data-prologue-card]")!).getByRole("button", { name: words(`prologue.${view.prologue.step}.answer.${answer.id}`) }));
      await waitFor(() => expect(store.getState().view?.v).toBeGreaterThan(view.v));
    }
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
