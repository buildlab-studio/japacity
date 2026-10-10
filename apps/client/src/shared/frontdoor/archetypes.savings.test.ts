// The money a tile's life starts with, as the door says it (prologue.md R-PROLOGUE-013): each tile's `savings` figure in
// content, a whole-naira amount beside its words, is kept honest here. The tile's presets run over many seeds the door
// would start it on (R-PROLOGUE-011), at its own home, and the figure is within a quarter of the median of the naira
// the lives hold when the prologue closes.
import { content } from "@japacity/content";
import { standInWorld } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame } from "../testing/fixtures";
import { say } from "../words/text";
import { ARCHETYPES, type Archetype, doorAnswer, homeOf, savingsOf, withHome } from "./archetypes";
import { FROM_SIXTEEN, tileSeed } from "./draw";

const SEEDS = 16;
const world = standInWorld("world-1", 0, content);

/** The naira in kobo a tile's life holds at its close, on the seed the door would start it on. */
function closingNaira(archetype: Archetype, base: string): number {
  const tile = withHome(archetype, homeOf(archetype));
  const game = newGame(FROM_SIXTEEN, tileSeed(tile, base, world, content));
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    const answer = doorAnswer(tile, prologue);
    if (answer === null) throw new Error(`No open answer at ${prologue.step}.`);
    game.accept({ type: "prologue/choose", step: prologue.step, answer });
  }
  const { bank, cash } = game.view().pockets.NGN;
  return bank + cash;
}

describe("the tiles' savings", () => {
  test("[R-PROLOGUE-013] given every tile's savings figure, when its presets run over sixteen seeds at its own home, then the figure is a whole naira amount within a quarter of the median of the naira its lives hold at the close", () => {
    const wrong: string[] = [];
    for (const archetype of ARCHETYPES) {
      const figure = say(`prologue.archetype.${archetype.id}.savings`);
      if (!/^\d+$/.test(figure)) wrong.push(`${archetype.id}: the figure ${figure} is not whole naira`);
      const held = Array.from({ length: SEEDS }, (_, at) => closingNaira(archetype, `savings-${archetype.id}-${String(at)}`)).sort((a, b) => a - b);
      const median = held[Math.floor(SEEDS / 2)] ?? 0;
      const said = savingsOf(archetype);
      if (Math.abs(said - median) * 4 > median) wrong.push(`${archetype.id}: says ${String(said / 100)}, median ${String(median / 100)}`);
    }
    expect(wrong).toEqual([]);
  });
});
