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
import { startArchetype } from "../../shared/frontdoor/frontDoor.testing";
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
