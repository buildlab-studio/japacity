// The front door's draw (prologue.md R-PROLOGUE-011): a tile's path is open from the first card. Where a life
// may be started over (the local authority), it starts on the first of a few named seeds whose draws keep every
// step the tile chooses open, played as the tile plays it. Online the server draws once, and the life is read
// as it was lived.
import type { Content, PlayerView, State, World } from "@japacity/sim";
import { newState, step, viewFor } from "@japacity/sim";

import { type Archetype, doorAnswer, FROM_SIXTEEN, ownSteps, presetAnswer } from "./archetypes";

export { FROM_SIXTEEN };

/** How many named seeds the front door tries before it takes the first (R-PROLOGUE-011). */
export const SEED_TRIES = 8;

/** The prologue has eleven cards and a few beats between; a life that runs past this is broken, not long. */
const MOST_STEPS = 40;

/** The `n`th seed tried for a life whose seed is named `base`. */
export function seedNamed(base: string, n: number): string {
  return `${base}-${String(n)}`;
}

/**
 * The steps a life on this seed answered with the tile's preset, played as the front door plays it: each preset
 * answer while it is allowed, and where a draw has shut them, the open answer the tile leans to, else the first
 * open one (`doorAnswer`). Null when the life stops on a card with no open answer.
 */
export function presetSent(archetype: Archetype, seed: string, world: World, content: Content): Set<string> | null {
  let state: State = newState(FROM_SIXTEEN, seed, content);
  const sent = new Set<string>();
  for (let guard = 0; guard < MOST_STEPS && state.prologue.open; guard += 1) {
    const prologue: PlayerView["prologue"] = viewFor({ state, world, content }).prologue;
    if (prologue === null) break;
    const preset = presetAnswer(archetype, prologue);
    const answer = doorAnswer(archetype, prologue);
    if (answer === null) return null;
    const result = step(state, { type: "prologue/choose", step: prologue.step, answer, basedOn: state.v }, world, content, "player");
    if (!result.ok) return null;
    state = result.state;
    if (preset !== null) sent.add(prologue.step);
  }
  return sent;
}

/** True when a life on this seed keeps the tile's path: every step the tile chooses is answered as it chooses. */
export function keepsTile(archetype: Archetype, seed: string, world: World, content: Content): boolean {
  const sent = presetSent(archetype, seed, world, content);
  return sent !== null && ownSteps(archetype).every((one) => sent.has(one));
}

/**
 * The seed a tile's life starts on where a life may be started over: the first of `base-0` to `base-7` that keeps
 * the tile's path, or `base-0` when none does, whose life is then read as lived (R-PROLOGUE-011).
 */
export function tileSeed(archetype: Archetype, base: string, world: World, content: Content): string {
  for (let n = 0; n < SEED_TRIES; n += 1) {
    const seed = seedNamed(base, n);
    if (keepsTile(archetype, seed, world, content)) return seed;
  }
  return seedNamed(base, 0);
}
