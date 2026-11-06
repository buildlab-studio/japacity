import { content } from "@japacity/content";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { App } from "./App";
import { bootGame } from "../authority/boot";
import { startArchetype } from "../shared/front-door/frontDoor.testing";
import type { GameStore } from "../authority/store";
import { playerMonth } from "../shared/words/format";
import { say, words } from "../shared/words/text";
// Registers Testing Library's cleanup for this file.
import { found } from "../shared/testing/render";
import { pressFanAct } from "../features/city/fan/fan.testing";
import { FULL_PROLOGUE_KEY } from "../shared/storage/storage";
import { stubWebGL, unstubWebGL } from "../shared/testing/webgl";
import { memoryStorage } from "../shared/testing/storage";

const PROLOGUE = "scenario.prologue";
const HUNT = "activity.job-hunt";
const JOB_OFFER = "offer.job";

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


// The world's scene is a stand-in that hands the city the taps a player makes on the things of the place file the game ships.
// The scene is the stand-in that opens a tapped thing's fan beside it and walks at once (world:fan-of-sticker-buttons).
vi.mock("../features/city/scene/CityScene", async () => ({ default: (await import("../features/city/fan/fan.testing")).StandInScene }));

// The place files the game ships, read from the disk in place of the server.
vi.mock("../shared/three/manifest", async (original) => (await import("../shared/testing/manifest")).fromDisk(original));

/** From the handover on, the world draws its place (City.tsx canDraw); the scene is the stand-in above. */
function worldDraws(): void {
  stubWebGL();
}

afterEach(() => {
  vi.restoreAllMocks();
  unstubWebGL();
  localStorage.clear();
});

describe("a life from sixteen in the app", () => {
  test("[prologue:view-shows-step-card] given the start screen, when a life from sixteen is picked and played card by card, then the first month opens and looking for work finds the first job", async () => {
    const store = bootGame({ storage: memoryStorage(), fastClock: true, makeSeed: seeds() });
    render(<App store={store} />);
    expect(content.scenario[PROLOGUE]).toBeDefined();
    // Every card, one answer each: the setting prologue.full, through an archetype's tile (prologue:front-door-builds-a-person, prologue:archetype-presets-answers).
    localStorage.setItem(FULL_PROLOGUE_KEY, "on");
    await startArchetype("developer");
    expect(await screen.findByRole("heading", { name: words("prologue.draw.card") }, { timeout: 10_000 })).toBeDefined();

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

    // The world opens in the hub's room, where the job board stands.
    localStorage.setItem("japacity.city.last", JSON.stringify(["place.yaba"]));
    worldDraws();
    fireEvent.click(await screen.findByRole("button", { name: say("ui.prologue.start", { month: 1 }) }));
    // The world opens on month 1 (world:world-fills-the-screen): its band, with no month number on it (world:top-band-is-a-pill).
    await waitFor(() => expect(document.querySelector("[data-band] [data-band-month]")).not.toBeNull(), { timeout: 10_000 });
    expect(playerMonth(store.getState().view?.month ?? -1)).toBe(1);

    // A hunt that finds work brings a job offer; accepting it from the world's asks is the first job. The hunt is the board's
    // act in the hub's room; the month ends as the bed's sleep runs out (world:sleep-ends-the-month), the store's own End month here.
    for (let month = 1; month <= 12 && store.getState().view?.job.id === null; month += 1) {
      const offer = store.getState().view?.offers.find((open) => open.entry === JOB_OFFER);
      if (offer !== undefined) {
        const v = store.getState().view?.v ?? 0;
        fireEvent.click(await waitFor(() => found("[data-nudge] [data-nudge-open]")));
        fireEvent.click(await screen.findByRole("button", { name: new RegExp(`^${words(`${JOB_OFFER}.choice.accept`)}`) }));
        await moved(store, v);
        break;
      }
      const v = store.getState().view?.v ?? 0;
      await pressFanAct("jobs", "activity.job-hunt", 5000);
      fireEvent.click(await waitFor(() => found(`[data-act-main="${HUNT}"]`)));
      // The hunt is done at once (activity:now-acts-and-month-acts); its answer in, the month ends.
      await moved(store, v);
      const sent = store.getState().view?.v ?? 0;
      await act(() => store.getState().endMonth());
      await moved(store, sent);
      act(() => {
        store.getState().setReportOpen(false);
        while (store.getState().moments.length > 0) store.getState().nextMoment();
      });
    }
    expect(store.getState().rejection).toBeNull();
    expect(store.getState().view?.job.id).not.toBeNull();
  });
});
