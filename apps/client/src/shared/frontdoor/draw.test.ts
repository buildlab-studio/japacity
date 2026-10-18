// The front door's draw on the real content (prologue:tile-path-open-from-start): the family's
// draw shut "Learn a trade" for the trader three times in five. Where a life may be started over, the front door
// tries named seeds in turn until the tile's path is open, so every trader reaches the master's shop and every
// nurse nursing school.
import { content } from "@japacity/content";
import { standInWorld } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame } from "../testing/fixtures";
import { sixteenNurse, sixteenPath } from "../words/sixteen";
import { answersInOrder, type Archetype, archetypeOf, presetAnswer } from "./archetypes";
import { FROM_SIXTEEN, keepsTile, SEED_TRIES, seedNamed, tileSeed } from "./draw";

const BASES = 40;
/** The world the front door's trials and the test's lives both use: the prologue draws on the life's seed alone. */
const WORLD_SEED = "world-1";
const world = standInWorld(WORLD_SEED, 0, content);

/** A life from sixteen on this seed, played as the prologue screen plays a tile: every answer given, by step. */
function played(archetype: Archetype, seed: string) {
  const game = newGame(FROM_SIXTEEN, seed);
  const answered: Record<string, string> = {};
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    const answer = presetAnswer(archetype, prologue) ?? answersInOrder(archetype, prologue.step, prologue.answers).find((one) => one.allowed)?.id;
    if (answer === undefined) throw new Error(`No open answer at ${prologue.step}.`);
    answered[prologue.step] = answer;
    game.accept({ type: "prologue/choose", step: prologue.step, answer });
  }
  return { answered, view: game.view() };
}

describe("the front door's draw", () => {
  test("[prologue:tile-path-open-from-start] given the trader's tile over 40 lives started where a life may be started over, when each is played, then every one reaches the master's shop (spare parts) and hands over as a trade, never a degree", () => {
    const trader = archetypeOf("trader")!;
    const wrong: string[] = [];
    let shutFirst = 0;
    for (let at = 0; at < BASES; at += 1) {
      const base = `trader-door-${String(at)}`;
      if (!keepsTile(trader, seedNamed(base, 0), world, content)) shutFirst += 1;
      const { answered, view } = played(trader, tileSeed(trader, base, world, content));
      if (answered["after-school"] !== "apprentice" || answered["master"] !== "spare-parts") wrong.push(`${base}: ${JSON.stringify(answered)}`);
      if (sixteenPath(view) === "degree") wrong.push(`${base}: a degree`);
    }
    expect(wrong).toEqual([]);
    // The first seed alone shuts the trade often: the tries are what keep the tile's word.
    expect(shutFirst).toBeGreaterThan(BASES / 4);
  });

  test("[prologue:tile-path-open-from-start] given the nurse's tile over 40 lives started where a life may be started over, when each is played, then every one reaches nursing school and hands over a nurse with her licence", () => {
    const nurse = archetypeOf("nurse")!;
    const wrong: string[] = [];
    for (let at = 0; at < BASES; at += 1) {
      const base = `nurse-door-${String(at)}`;
      const { answered, view } = played(nurse, tileSeed(nurse, base, world, content));
      if (answered["course"] !== "nursing") wrong.push(`${base}: ${JSON.stringify(answered)}`);
      if (!sixteenNurse(view)) wrong.push(`${base}: no nurse at the handover`);
    }
    expect(wrong).toEqual([]);
  });

  test("[prologue:tile-path-open-from-start] [prologue:makoko-start-never-a-trap] given the child of the water's tile over 40 lives, when each is played, then the family's draw never shuts its path: the first seed keeps it, and every life closes in Makoko's room", () => {
    const water = archetypeOf("water")!;
    const wrong: string[] = [];
    for (let at = 0; at < BASES; at += 1) {
      const base = `water-door-${String(at)}`;
      const seed = tileSeed(water, base, world, content);
      if (seed !== seedNamed(base, 0)) wrong.push(`${base}: ${seed}`);
      const { answered, view } = played(water, seed);
      if (answered["home"] !== "makoko" || view.home.place !== "place.makoko") wrong.push(`${base}: ${JSON.stringify(answered)}`);
    }
    expect(wrong).toEqual([]);
  });

  test("[prologue:tile-path-open-from-start] given a base whose first seed shuts the trader's trade, when the front door picks the seed, then it tries the next named seeds in turn and takes the first that keeps the trade open", () => {
    const trader = archetypeOf("trader")!;
    const base = Array.from({ length: BASES }, (_, at) => `trader-door-${String(at)}`).find((one) => !keepsTile(trader, seedNamed(one, 0), world, content));
    if (base === undefined) throw new Error("No base shuts the trade at its first seed.");
    const seed = tileSeed(trader, base, world, content);
    const n = Number(seed.slice(base.length + 1));
    expect(seed).toBe(seedNamed(base, n));
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(SEED_TRIES);
    for (let before = 0; before < n; before += 1) expect(keepsTile(trader, seedNamed(base, before), world, content)).toBe(false);
    expect(keepsTile(trader, seed, world, content)).toBe(true);
  });

  test("[prologue:tile-path-open-from-start] given a tile no seed of the eight can keep, when the front door picks the seed, then it takes the first named seed, after eight tries", () => {
    const trader = archetypeOf("trader")!;
    // An answer no card has: the step always shows, so no seed keeps this tile's path.
    const never: Archetype = { ...trader, preset: { ...trader.preset, master: ["no-such-trade"] } };
    expect(SEED_TRIES).toBe(8);
    expect(tileSeed(never, "nowhere", world, content)).toBe(seedNamed("nowhere", 0));
  });
});
