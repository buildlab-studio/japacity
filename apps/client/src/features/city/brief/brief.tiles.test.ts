// Each life tile's first brief names the place where that life takes each step (world:nudge-says-one-thing): the
// same stop the nudge sends it to. Real content, each tile played from the front door with its preset answers.
import { describe, expect, test } from "vitest";

import { answersInOrder, ARCHETYPES, archetypeOf, presetAnswer } from "../../../shared/front-door/archetypes";
import { newGame } from "../../../shared/testing/fixtures";
import { say } from "../../../shared/words/text";
import { stepWayOf } from "../nudge/nudge";
import { briefOf, ownItemWay } from "./brief";

/** Plays a tile on one seed: its preset answers while allowed, else the answer that suits it. */
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

/** Where each tile's first thing is done, as its brief names it. */
const FIRST_PLACE: Readonly<Record<string, string>> = {
  developer: "chapter.brief.at.yaba",
  nurse: "chapter.brief.at.own.clinic",
  accountant: "chapter.brief.at.yaba",
  writer: "chapter.brief.at.yaba",
  trader: "chapter.brief.at.yaba",
  "shop-worker": "chapter.brief.at.yaba",
  water: "chapter.brief.at.own.racks",
};

describe("the brief's places, life by life", () => {
  test("[world:nudge-says-one-thing] given the tiles, when the table of first places is read, then it holds every tile", () => {
    expect(Object.keys(FIRST_PLACE).sort()).toEqual(ARCHETYPES.map((tile) => tile.id).sort());
  });

  test.each(ARCHETYPES.map((tile) => tile.id))("[world:nudge-says-one-thing] given the %s tile at its first brief, when the thing to do now is read, then it is the thing the nudge names, at the place the nudge sends that life to", (id) => {
    const view = play(id, "brief-places-0").view();
    const brief = briefOf(view, "");
    if (brief === null) throw new Error("No brief");
    const now = brief.items.find((item) => item.now);
    if (now === undefined) throw new Error("Nothing to do now");
    const own = ownItemWay(view, now.id);
    const way = stepWayOf(view);
    if (own !== null) {
      // The life's own way: the first plan names it, and the nudge goes to the same stop.
      expect(way?.go).toBe(own.stop);
      expect(now.place).toBe(say(`chapter.brief.at.own.${own.key}`));
      expect(now.place).not.toBe(say("chapter.brief.at.yaba"));
    }
    expect(now.place).toBe(say(FIRST_PLACE[id] ?? ""));
    // A step the table places is at the stop the nudge goes to.
    if (own === null && way !== null && way.go !== null) expect(say(`chapter.brief.at.${way.go.replace(/^place\./, "")}`)).toBe(now.place);
  });
});
