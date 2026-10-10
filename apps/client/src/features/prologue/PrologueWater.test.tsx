// The child of the water's first minute (prologue.md R-PROLOGUE-010, R-PROLOGUE-012): its begin
// card speaks of the lagoon, not of a small town, and its handover's first step is the band's nudge at the same
// moment, the racks beside the room, with the motor park after. Real content, real draws.
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { App } from "../../App";
import { keepPerson } from "../../authority/person";
import { createGameStore } from "../../authority/store";
import { answersInOrder, archetypeOf, presetAnswer } from "../../shared/frontdoor/archetypes";
import { gameAuthority, newGame } from "../../shared/testing/fixtures";
import { RACKS, RACKS_STEP } from "../../shared/words/sixteen";
import { say, words } from "../../shared/words/text";
import { nudgeOf } from "../city/nudge";
import { drawSentences, firstStep, PrologueHandover } from "./PrologueView";
// Registers Testing Library's cleanup for this file.
import { renderWithView } from "../../shared/testing/render";

const PROLOGUE = "scenario.prologue";
const HUNT = "activity.job-hunt";

afterEach(() => {
  localStorage.clear();
});

/** Plays a tile on one seed on the engine alone: its preset answers while allowed, else the answer that suits it. */
function play(id: string, seed: string): ReturnType<typeof newGame> {
  const archetype = archetypeOf(id);
  if (archetype === null) throw new Error(`No ${id} tile.`);
  const game = newGame(PROLOGUE, seed);
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    const open = presetAnswer(archetype, prologue) ?? answersInOrder(archetype, prologue.step, prologue.answers).find((answer) => answer.allowed)?.id;
    if (open === undefined) throw new Error(`No open answer at ${prologue.step}.`);
    game.accept({ type: "prologue/choose", step: prologue.step, answer: open });
  }
  return game;
}

describe("the child of the water's begin card", () => {
  const draw = { familyMeans: 20, town: "town" as const, siblings: 3, parentsEducated: false };

  test("[R-PROLOGUE-012] [R-PROLOGUE-010] given the child of the water's tile, when the draw is told, then it opens on the lagoon, the canoe to school and the racks, never a small town; another tile keeps the draw's own town", () => {
    const water = drawSentences(draw, archetypeOf("water"));
    expect(water.slice(0, 2)).toEqual([say("prologue.archetype.water.begin.where"), say("prologue.archetype.water.begin.home")]);
    expect(water.join(" ")).toMatch(/lagoon/);
    expect(water.join(" ")).toMatch(/canoe/);
    expect(water.join(" ")).toMatch(/racks/);
    expect(water.join(" ")).not.toContain(say("ui.prologue.town.town"));
    expect(water.join(" ")).not.toContain(say("ui.prologue.town.city"));
    // The siblings and the parents are still the draw's.
    expect(water.slice(2)).toEqual(drawSentences(draw).slice(2));
    expect(drawSentences(draw, archetypeOf("shop-worker")).slice(0, 2)).toEqual([say("ui.prologue.town.town"), say("ui.prologue.means.low")]);
  });

  test("[R-PROLOGUE-012] [R-PROLOGUE-010] given the child of the water played through the screen, when its one open card shows, then the beat over it is the lagoon's, never a small town", async () => {
    keepPerson({ look: "chr_ada", name: "Ebi", archetype: "water" });
    const game = newGame(PROLOGUE, "water-begin");
    const store = createGameStore(gameAuthority(game));
    await store.getState().refresh();
    render(<App store={store} />);
    await screen.findByRole("heading", { name: words("prologue.friend.card") });
    const beat = document.querySelector("[data-beat]")?.textContent ?? "";
    expect(beat).toContain(say("prologue.archetype.water.begin.where"));
    expect(beat).toContain(say("prologue.archetype.water.begin.home"));
    expect(document.body.textContent).not.toContain(say("ui.prologue.town.town"));
    expect(document.body.textContent).not.toContain(say("ui.prologue.town.city"));
    const card = document.querySelector<HTMLElement>("[data-prologue-card]")!;
    fireEvent.click(within(card).getAllByRole("button")[0]!);
    await waitFor(() => expect(store.getState().view?.prologue).toBeNull());
  });
});

describe("the child of the water's first step", () => {
  test("[R-PROLOGUE-012] [R-ACTIVITY-017] [R-WORLD-003] given the child of the water handed over in Makoko's room with no job, when the handover and the band's nudge are read at the same moment, then both say the racks beside the room", async () => {
    for (const seed of ["water-step-0", "water-step-1", "water-step-2"]) {
      const view = play("water", seed).view();
      expect(view.job.id).toBeNull();
      expect(view.activities.find((option) => option.id === HUNT)?.params).toContain(RACKS);
      expect(nudgeOf({ ...view, offers: [] }).key).toBe(RACKS_STEP);
      expect(firstStep(view)).toBe(say(RACKS_STEP));
    }
    await renderWithView(<PrologueHandover onDone={() => undefined} />, play("water", "water-step-0").view());
    expect(document.querySelector("[data-first-step]")?.textContent).toBe(say("prologue.handover.first", { step: say(RACKS_STEP) }));
  });

  test("[R-PROLOGUE-012] [R-ACTIVITY-017] [R-WORLD-003] given the child of the water at the racks, when its next step is read, then the motor park comes after, on the handover's words and the band's", () => {
    const game = play("water", "water-step-0");
    for (let month = 0; month < 6 && game.state.activity.job !== RACKS; month += 1) {
      game.endTurn([{ activity: HUNT, param: RACKS }]);
      const offer = game.view().offers.find((open) => open.entry === "offer.job");
      if (offer !== undefined) game.accept({ type: "offer/choose", offer: offer.id, choice: "accept" });
    }
    expect(game.state.activity.job).toBe(RACKS);
    const view = game.view();
    expect(firstStep(view)).toBe(say("prologue.handover.step.heard.motor-park"));
    expect(nudgeOf({ ...view, offers: [] }).key).toBe("chapter.find-your-feet.item.heard.nudge.motor-park");
  });

  test("[R-PROLOGUE-012] given the shop worker at the family house with no job, when the handover is read, then it never names the racks", () => {
    const view = play("shop-worker", "water-step-0").view();
    expect(view.job.id).toBeNull();
    expect(firstStep(view)).not.toBe(say(RACKS_STEP));
  });
});
