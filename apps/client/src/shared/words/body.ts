// The body in words (quality:body-belly-and-energy; decision 0011): the band says a word only when the body
// complains, "Hungry" when the belly is low, "Tired" when the energy is, both when both; nothing otherwise, and never a
// number, a meter or a percentage.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";

import { say } from "./text";

const BELLY = "quality.belly";
const ENERGY = "quality.energy";

/** True when the energy is low: the night then sends the player to bed (clock:game-day-on-real-time). */
export function tired(view: Pick<PlayerView, "qualities">): boolean {
  const energy = view.qualities.find((quality) => quality.id === ENERGY)?.value ?? null;
  return energy !== null && energy < content.tuning.turn.body.lowBelow;
}

/** The body's word for the band, or null when it does not complain. A view without the body says nothing. */
export function bodyWords(view: Pick<PlayerView, "qualities">): string | null {
  const low = content.tuning.turn.body.lowBelow;
  const value = (id: string): number | null => view.qualities.find((quality) => quality.id === id)?.value ?? null;
  const belly = value(BELLY);
  const energy = value(ENERGY);
  const hungry = belly !== null && belly < low;
  const worn = energy !== null && energy < low;
  if (hungry && worn) return say("ui.body.both");
  if (hungry) return say("ui.body.hungry");
  if (worn) return say("ui.body.tired");
  return null;
}
