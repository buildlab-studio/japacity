// The cut's moments kept as pictures beside a render (pnpm teaser:render --stills <folder>): the portrait teaser's opening,
// the street in the middle of its shot, the turn, the night in the hand, the end card, the busiest frame with a feed's bars
// drawn over it, and the landscape's end card. Plain numbers, so the render script reads them without the composition;
// the cut's test checks each one lands in its act.
import type { Act } from "./Lead";

export interface Still {
  readonly name: string;
  readonly id: "Lead" | "LeadPortrait";
  readonly frame: number;
  readonly act: Act;
  /** Draws a phone feed's own bars over the frame, to show what they cover. */
  readonly feed?: boolean;
}

export const STILLS: readonly Still[] = [
  { name: "portrait-open", id: "LeadPortrait", frame: 92, act: "open" },
  { name: "portrait-street", id: "LeadPortrait", frame: 400, act: "city" },
  { name: "portrait-turn", id: "LeadPortrait", frame: 558, act: "turn" },
  { name: "portrait-hand", id: "LeadPortrait", frame: 656, act: "hand" },
  { name: "portrait-end", id: "LeadPortrait", frame: 830, act: "end" },
  { name: "portrait-feed", id: "LeadPortrait", frame: 558, act: "turn", feed: true },
  { name: "landscape-end", id: "Lead", frame: 830, act: "end" },
];
