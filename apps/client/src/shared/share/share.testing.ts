// What the share tests read: a measure of words, Ada's card and her send-off, and a card's words.
import type { PlayerView } from "@japacity/sim";

import { recordedGame } from "../testing/fixtures";
import type { ShareCard } from "./face";
import type { Measure, Step, TextStep } from "./layout";

/** About the width of a system font, which jsdom cannot measure: wide enough that long words wrap as they would on a phone. */
export const measure: Measure = (words, size) => Math.round(words.length * size * 0.55);

/** Ada's send-off card, as the engine makes it. */
export function graduateCard(): ShareCard {
  const card = recordedGame("graduate-careful").view().card;
  if (card === null) throw new Error("Ada's recorded life has no card.");
  return card;
}

/** Ada's careful recorded life, which ends at the send-off's card. */
export function graduateSendOff(): PlayerView {
  const view = recordedGame("graduate-careful").view();
  if (view.card?.kind !== "send-off") throw new Error("Ada's recorded life does not end at the send-off.");
  return view;
}

/** The steps that draw words. */
export function texts(steps: readonly Step[]): TextStep[] {
  return steps.filter((step): step is TextStep => step.op === "text");
}
