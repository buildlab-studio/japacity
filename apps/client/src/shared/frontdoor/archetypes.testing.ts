// Test support for a tile's life: its prologue played as the screen plays it.
import type { Game } from "@japacity/sim/testing";

import { type Archetype, answersInOrder, presetAnswer } from "./archetypes";

/** Plays the prologue to its close as a tile's life: its preset answer while allowed, else the open answer that suits it. */
export function playTile(game: Game, archetype: Archetype): void {
  for (let guard = 0; guard < 40 && game.state.prologue.open; guard += 1) {
    const prologue = game.view().prologue!;
    const answer = presetAnswer(archetype, prologue) ?? answersInOrder(archetype, prologue.step, prologue.answers).find((one) => one.allowed)?.id;
    if (answer === undefined) throw new Error(`No open answer at ${prologue.step}.`);
    game.accept({ type: "prologue/choose", step: prologue.step, answer });
  }
}
