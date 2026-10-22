// The door's answer is content's (prologue:archetype-presets-answers, server:server-plays-prologue-preset): the tile
// with the door's age and home answers every card as content's `presetAnswer` does, the function the server plays; what
// the door offers is what the server takes; and the longest preset fits in one request.
import { presetAges, presetAnswer, presetHomes, presetOffered } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { stepsOpen } from "../datapage/age";
import { newGame } from "../testing/fixtures";
import { ARCHETYPES, doorAnswer, homesFor, withAge, withHome } from "./archetypes";

const SEEDS = 6;
/** apps/server/src/config.ts `limits.presetSteps`: the most steps one preset request plays. */
const PRESET_STEPS = 20;

describe("the door's answer from content", () => {
  test("[prologue:front-door-builds-a-person] [prologue:front-door-three-screens] [server:server-plays-prologue-preset] given every tile, then the age steps and homes the door offers are the ones content's preset offers, and the server's check passes each of them", () => {
    for (const archetype of ARCHETYPES) {
      expect(stepsOpen(archetype)).toEqual(presetAges(archetype.preset));
      expect(homesFor(archetype)).toEqual(presetHomes(archetype.preset));
      for (const age of stepsOpen(archetype)) for (const home of homesFor(archetype)) expect(presetOffered(archetype.id, age, home), `${archetype.id} ${String(age)} ${home}`).toBe(true);
    }
  });

  test("[prologue:archetype-presets-answers] [server:server-plays-prologue-preset] given every tile, age step and home over many seeds, when its years are played, then content's presetAnswer gives the door's answer at every card, and the longest preset fits in one request", { timeout: 60_000 }, () => {
    let longest = 0;
    for (const base of ARCHETYPES) {
      for (const home of homesFor(base)) {
        for (const age of stepsOpen(base)) {
          const tile = withHome(withAge(base, age), home);
          for (let at = 0; at < SEEDS; at += 1) {
            const game = newGame("scenario.prologue", `${base.id}-${home}-${String(age)}-${String(at)}`);
            let steps = 0;
            for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
              const card = game.view().prologue;
              if (card === null) break;
              const answer = presetAnswer(base.id, age, home, card.step, card.answers);
              expect(answer, `${base.id} ${home} ${String(age)} ${card.step}`).toBe(doorAnswer(tile, card));
              if (answer === null) throw new Error(`No open answer at ${card.step}.`);
              game.accept({ type: "prologue/choose", step: card.step, answer });
              steps += 1;
            }
            longest = Math.max(longest, steps);
          }
        }
      }
    }
    expect(longest).toBeGreaterThanOrEqual(14);
    expect(longest).toBeLessThanOrEqual(PRESET_STEPS);
  });
});
