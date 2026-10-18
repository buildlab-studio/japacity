// Test support for setting what a life holds before a rule is tried. Nothing in
// the simulation imports this file.
import type { Currency, Effect } from "../engine/types";
import type { Game } from "./play";
import { applyEffects } from "./route.journey";

/** A currency's two pockets, as a test sets them. */
export interface Held {
  cash: number;
  bank: number;
}

export interface SetOptions {
  /** Carries the effects; route.journey's applyEffects unless the test steps through its own registry. */
  apply?: (effects: Effect[]) => void;
}

/**
 * Sets each named currency's pockets to exactly the amounts given; a number is all of it in the
 * bank with the cash emptied. What is over is taken as a mishap, what is short is given as a gift,
 * and a pocket already right is left alone.
 */
export function setPockets(game: Game, pockets: Partial<Record<Currency, number | Held>>, options: SetOptions = {}): void {
  const effects: Effect[] = [];
  for (const currency of Object.keys(pockets) as Currency[]) {
    const wanted = pockets[currency] ?? 0;
    const want: Held = typeof wanted === "number" ? { cash: 0, bank: wanted } : wanted;
    const held = game.state.wallet.pockets[currency];
    for (const pocket of ["cash", "bank"] as const) {
      if (held[pocket] > want[pocket]) effects.push({ type: "money/take", currency, pocket, amount: held[pocket] - want[pocket], reason: "mishap" });
      if (held[pocket] < want[pocket]) effects.push({ type: "money/add", currency, pocket, amount: want[pocket] - held[pocket], reason: "gift" });
    }
  }
  if (effects.length === 0) return;
  if (options.apply === undefined) applyEffects(game, effects);
  else options.apply(effects);
}
