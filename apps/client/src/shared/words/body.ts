// The body in words (docs/rules/quality.md R-QUALITY-007; decision 0035): the band says a word only when the body
// complains, "Hungry" when the belly is low, "Tired" when the energy is, both when both; nothing otherwise, and never a
// number, a meter or a percentage.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";

import { say } from "./text";

const BELLY = "quality.belly";
const ENERGY = "quality.energy";

/** The body's word for the band, or null when it does not complain. A view without the body says nothing. */
export function bodyWords(view: Pick<PlayerView, "qualities">): string | null {
  const low = content.tuning.turn.body.lowBelow;
  const value = (id: string): number | null => view.qualities.find((quality) => quality.id === id)?.value ?? null;
  const belly = value(BELLY);
  const energy = value(ENERGY);
  const hungry = belly !== null && belly < low;
  const tired = energy !== null && energy < low;
  if (hungry && tired) return say("ui.body.both");
  if (hungry) return say("ui.body.hungry");
  if (tired) return say("ui.body.tired");
  return null;
}
