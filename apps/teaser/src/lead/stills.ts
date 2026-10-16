// The portrait cut's four moments kept as pictures beside a render (pnpm teaser:render --stills <folder>): the strip in
// the middle of the street, the window halfway through its turn, a shot in the hand, and the end card. Plain numbers, so
// the render script reads them without the composition; the cut's test checks each one lands in its act.
import type { Act } from "./Lead";

export const PORTRAIT_STILLS: readonly { readonly name: string; readonly frame: number; readonly act: Act }[] = [
  { name: "strip", frame: 412, act: "strip" },
  { name: "turn", frame: 530, act: "turn" },
  { name: "hand", frame: 650, act: "hand" },
  { name: "end", frame: 830, act: "end" },
];
