// A share card's name, so closing one does not close the next. Apart from the stage's hooks, so the store can read it.
import type { PlayerView } from "@japacity/sim";

/** A name for a card, so closing one does not close the next. */
export function cardKey(card: PlayerView["card"]): string | null {
  return card === null ? null : `${card.kind}-${String(card.months)}`;
}
