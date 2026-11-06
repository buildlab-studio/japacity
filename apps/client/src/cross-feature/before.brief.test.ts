// What the years before meet of the first brief is shown happening (chapter:first-chapter-mission-card, prologue:tile-path-open-from-start,
// prologue:printed-page-hands-over): each life tile played from the front door with its preset answers, its handover's page read for the
// way out the send-off heard of, and its first brief read for the things met before it is handed over. Crosses the prologue's page and
// the city's brief, so it stands here.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { afterEach, describe, expect, test } from "vitest";

import { briefOf, metBefore } from "../features/city/brief/brief";
import { heardWords, type TrailStep } from "../features/prologue/years";
import { answersInOrder, ARCHETYPES, archetypeOf, presetAnswer } from "../shared/front-door/archetypes";
import { newGame } from "../shared/testing/fixtures";
import { handBrief } from "../shared/world/briefHanded";
import { say } from "../shared/words/text";

const FIRST_CHAPTER = "chapter.find-your-feet";

/** Plays a tile on one seed with its preset answers, keeping each step's answer as the page's trail keeps it. */
function play(id: string, seed: string): { view: PlayerView; trail: TrailStep[] } {
  const archetype = archetypeOf(id);
  if (archetype === null) throw new Error(`No ${id} tile.`);
  const game = newGame("scenario.prologue", seed);
  const trail: TrailStep[] = [];
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    const answer = presetAnswer(archetype, prologue) ?? answersInOrder(archetype, prologue.step, prologue.answers).find((one) => one.allowed)?.id;
    if (answer === undefined) throw new Error(`No open answer at ${prologue.step}.`);
    trail.push({ step: prologue.step, answer, outcome: null });
    game.accept({ type: "prologue/choose", step: prologue.step, answer });
  }
  return { view: game.view(), trail };
}

/** Each tile's first brief: the things met before it is handed over, and the way out its page says the send-off heard of. */
const BEFORE: Readonly<Record<string, { met: string[]; heard: string | null }>> = {
  developer: { met: [], heard: "route.uk-talent" },
  nurse: { met: ["heard"], heard: "route.uk-care" },
  accountant: { met: ["heard"], heard: "route.canada-points" },
  writer: { met: ["heard"], heard: "route.uk-masters" },
  trader: { met: ["heard"], heard: "route.gulf-contract" },
  "shop-worker": { met: ["heard"], heard: "route.gulf-contract" },
  water: { met: ["heard"], heard: "route.gulf-contract" },
};

afterEach(() => window.localStorage.clear());

describe("the years before, seen and then ticked", () => {
  test("[chapter:first-chapter-mission-card] given the tiles, when the table of things met before the first brief is read, then it holds every tile", () => {
    expect(Object.keys(BEFORE).sort()).toEqual(ARCHETYPES.map((tile) => tile.id).sort());
  });

  test.each(ARCHETYPES.map((tile) => tile.id))(
    "[chapter:first-chapter-mission-card] [prologue:tile-path-open-from-start] [prologue:printed-page-hands-over] given the %s tile at its handover, when its page and its first brief are read, then each thing the brief has met was said on the page, and stands first, done, saying where it happened",
    (id) => {
      const expected = BEFORE[id]!;
      for (const seed of ["before-0", "before-1", "before-2"]) {
        const { view, trail } = play(id, seed);
        expect(view.chapter.current).toBe(FIRST_CHAPTER);
        expect(view.month).toBe(0);
        const met = view.chapter.items.filter((item) => item.met).map((item) => item.id);
        expect(met).toEqual(expected.met);
        // The page says under So far the way out heard at the send-off (prologue:printed-page-hands-over).
        const heard = heardWords({ draw: null, steps: trail });
        expect(heard).toBe(expected.heard === null ? null : say("ui.page.heard", { way: say(`prologue.page.way.${expected.heard}`) }));
        // Nothing met that the page did not say: a way out heard is the send-off's, and the page's line stands.
        expect(met.includes("heard") && heard === null).toBe(false);
        const brief = briefOf(view, "", metBefore(view, FIRST_CHAPTER))!;
        const before = brief.items.filter((item) => item.before);
        expect(before.map((item) => item.id)).toEqual(expected.met);
        expect(brief.items.slice(0, before.length)).toEqual(before);
        for (const item of before) {
          expect(item.met).toBe(true);
          expect(item.place).toBe(say(`${FIRST_CHAPTER}.brief.before.${item.id}`));
        }
        // The things still to do keep the chapter's order after the ones met before.
        const order = content.chapter[FIRST_CHAPTER]!.items.map((item) => item.id).filter((item) => !expected.met.includes(item));
        expect(brief.items.slice(before.length).map((item) => item.id)).toEqual(order);
        expect(brief.items.filter((item) => item.now)).toHaveLength(1);
        expect(brief.items.find((item) => item.now)?.before).toBe(false);
      }
    },
    60_000,
  );

  test("[chapter:first-chapter-mission-card] given a life that has played a month, when no mark kept what was met at the handover, then nothing reads as met before the brief", () => {
    const { view } = play("nurse", "before-month");
    const later: PlayerView = { ...view, month: 1 };
    expect(metBefore(later, FIRST_CHAPTER)).toEqual([]);
    expect(briefOf(later, "", metBefore(later, FIRST_CHAPTER))!.items.map((item) => item.id)).toEqual(content.chapter[FIRST_CHAPTER]!.items.map((item) => item.id));
  });

  test("[chapter:first-chapter-mission-card] given the nurse's brief handed with the way out already heard, when a month has been played, then the mark keeps that it was met before and it still stands first, where it happened", () => {
    const { view } = play("nurse", "before-kept");
    handBrief(view.scenario, FIRST_CHAPTER, metBefore(view, FIRST_CHAPTER));
    const later: PlayerView = { ...view, month: 2 };
    expect(metBefore(later, FIRST_CHAPTER)).toEqual(["heard"]);
    const first = briefOf(later, "", metBefore(later, FIRST_CHAPTER))!.items[0]!;
    expect(first).toMatchObject({ id: "heard", before: true, place: say(`${FIRST_CHAPTER}.brief.before.heard`) });
  });
});
