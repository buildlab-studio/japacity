// The child of the water's work at hand (docs/rules/activity.md R-ACTIVITY-017, world.md R-WORLD-003): while a
// life in Makoko's room holds no job, the nudge names the fish racks beside the room and its way goes there; the
// shop worker's tile, at the family house, keeps the board in town. Real content, real draws.
import { text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { answersInOrder, archetypeOf, presetAnswer } from "../../shared/frontdoor/archetypes";
import { newGame } from "../../shared/testing/fixtures";
import { nudgeOf, stepWayOf } from "./nudge";

const RACKS = "activity.job-fish-racks";
const HUNT = "activity.job-hunt";
const RACKS_NUDGE = "chapter.find-your-feet.item.job.nudge.racks";
const NUDGE_WORDS = 8;

/** Plays an archetype's tile on one seed: its preset answers while allowed, else the answer that suits it. */
function play(id: string, seed: string): ReturnType<typeof newGame> {
  const archetype = archetypeOf(id);
  if (archetype === null) throw new Error(`No ${id} tile.`);
  const game = newGame("scenario.prologue", seed);
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    const open = presetAnswer(archetype, prologue) ?? answersInOrder(archetype, prologue.step, prologue.answers).find((answer) => answer.allowed)?.id;
    if (open === undefined) throw new Error(`No open answer at ${prologue.step}.`);
    game.accept({ type: "prologue/choose", step: prologue.step, answer: open });
  }
  return game;
}

describe("the racks as the work at hand", () => {
  test("[R-ACTIVITY-017] [R-WORLD-003] given the child of the water with no job, when the nudge is read, then it names the racks in under eight words and its way is the racks beside the room; once the hunt is planned it says to end the month", () => {
    const view = play("water", "racks-nudge-0").view();
    expect(view.job.id).toBeNull();
    expect(view.activities.find((option) => option.id === HUNT)?.params).toContain(RACKS);
    expect(nudgeOf({ ...view, offers: [] })).toEqual({ key: RACKS_NUDGE, about: "step" });
    expect(stepWayOf(view)).toEqual({ go: "place.makoko", at: ["place.makoko:racks", "place.yaba:jobs", "place.ojuelegba:hub"] });
    const words = text[RACKS_NUDGE] ?? "";
    expect(words.split(/\s+/).filter(Boolean).length).toBeGreaterThan(0);
    expect(words.split(/\s+/).filter(Boolean).length).toBeLessThan(NUDGE_WORDS);
    expect(nudgeOf({ ...view, offers: [] }, undefined, [HUNT])).toEqual({ key: "chapter.find-your-feet.item.job.started", about: "step" });
  });

  test("[R-ACTIVITY-017] [R-WORLD-003] given the child of the water at the racks, when the nudge is read, then the racks are no longer named and the life's own way out leads again", () => {
    const game = play("water", "racks-nudge-0");
    for (let month = 0; month < 6 && game.state.activity.job !== RACKS; month += 1) {
      game.endTurn([{ activity: HUNT, param: RACKS }]);
      const offer = game.view().offers.find((open) => open.entry === "offer.job");
      if (offer !== undefined) game.accept({ type: "offer/choose", offer: offer.id, choice: "accept" });
    }
    expect(game.state.activity.job).toBe(RACKS);
    const view = game.view();
    expect(nudgeOf({ ...view, offers: [] }).key).not.toBe(RACKS_NUDGE);
    expect(stepWayOf(view)?.go).not.toBe("place.makoko");
  });

  test("[R-ACTIVITY-017] [R-WORLD-003] given the shop worker at the family house with no job, when the nudge is read, then it never names the racks", () => {
    const view = play("shop-worker", "racks-nudge-0").view();
    expect(view.job.id).toBeNull();
    expect(nudgeOf({ ...view, offers: [] }).key).not.toBe(RACKS_NUDGE);
    expect(stepWayOf(view)?.go).not.toBe("place.makoko");
  });
});
