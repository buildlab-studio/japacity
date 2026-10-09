import { content } from "@japacity/content";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { App } from "./App";
import { bootGame } from "./authority/boot";
import { FULL_PROLOGUE_KEY } from "./shared/frontdoor/archetypes";
import { startArchetype } from "./shared/frontdoor/frontDoor.testing";
import type { GameStore } from "./authority/store";
import { nameOf, say, words } from "./shared/words/text";
// Registers Testing Library's cleanup for this file.
import "./shared/testing/render";
import { onTheClassicPage } from "./shared/testing/classic";

const PROLOGUE = "scenario.prologue";
const HUNT = "activity.job-hunt";
const JOB_OFFER = "offer.job";

function memoryStorage() {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

/** Seeds handed out in turn, so the life and its world are the same on every run. */
function seeds(): () => string {
  let next = 0;
  return () => {
    next += 1;
    return `prologue-app-${String(next)}`;
  };
}

/** Waits until the authority has answered: the view's version has moved past `v`. */
async function moved(store: GameStore, v: number): Promise<void> {
  await waitFor(() => {
    if ((store.getState().view?.v ?? 0) <= v) throw new Error("The view has not moved yet.");
  });
}

// The old month page these tests drive opens only with ?classic (R-WORLD-024).
onTheClassicPage();
afterEach(() => {
  localStorage.clear();
});

describe("a life from sixteen in the app", () => {
  test("[R-PROLOGUE-008] given the start screen, when a life from sixteen is picked and played card by card, then the first month opens and looking for work finds the first job", async () => {
    const store = bootGame({ storage: memoryStorage(), fastClock: true, makeSeed: seeds() });
    render(<App store={store} />);
    expect(content.scenario[PROLOGUE]).toBeDefined();
    // Every card, one answer each: the setting prologue.full, through an archetype's tile (R-PROLOGUE-009, 010).
    localStorage.setItem(FULL_PROLOGUE_KEY, "on");
    await startArchetype("developer");
    expect(await screen.findByRole("heading", { name: words("prologue.draw.card") })).toBeDefined();

    for (let guard = 0; guard < 40; guard += 1) {
      const prologue = store.getState().view?.prologue ?? null;
      if (prologue === null) break;
      const open = prologue.answers.find((answer) => answer.allowed);
      if (open === undefined) throw new Error(`No open answer at ${prologue.step}.`);
      const v = store.getState().view?.v ?? 0;
      fireEvent.click(await screen.findByRole("button", { name: words(`prologue.${prologue.step}.answer.${open.id}`) }));
      await moved(store, v);
    }
    expect(store.getState().view?.prologue).toBeNull();

    fireEvent.click(await screen.findByRole("button", { name: say("ui.prologue.start", { month: 1 }) }));
    expect(await screen.findByRole("heading", { name: say("ui.month.planning", { month: 1 }) })).toBeDefined();

    // A hunt that finds work brings a job offer; accepting it is the first job.
    for (let month = 1; month <= 12 && store.getState().view?.job.id === null; month += 1) {
      const offer = store.getState().view?.offers.find((open) => open.entry === JOB_OFFER);
      if (offer !== undefined) {
        const v = store.getState().view?.v ?? 0;
        fireEvent.click(screen.getByRole("button", { name: words(`${JOB_OFFER}.choice.accept`) }));
        await moved(store, v);
        break;
      }
      const v = store.getState().view?.v ?? 0;
      fireEvent.click(screen.getByRole("button", { name: `${say("ui.activity.add")}: ${nameOf(HUNT)}` }));
      fireEvent.click(screen.getByRole("button", { name: say("ui.month.end") }));
      await moved(store, v);
      act(() => {
        store.getState().setReportOpen(false);
        while (store.getState().moments.length > 0) store.getState().nextMoment();
      });
    }
    expect(store.getState().rejection).toBeNull();
    expect(store.getState().view?.job.id).not.toBeNull();
  });
});
