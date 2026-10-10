// The stops' boards on the map never cover one another (docs/rules/world.md R-WORLD-015): where
// two would, the one that matters less is folded away until the view leaves room for it. Where the player stands and
// home always show, then the stop picked, then the stops the player can go to, then those been to, then the rest; among
// equals, the board nearer the foot of the screen (nearer the camera) wins.
import type { PinState } from "../../shared/world/contract";

/** A board on the screen: its box in pixels, and what its stop is. */
export interface BoardBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  state: PinState;
  home: boolean;
  picked: boolean;
}

/** The space two boards keep between them, in pixels. */
export const BOARD_GAP = 2;

const STATE_RANK: Readonly<Record<PinState, number>> = { here: 0, home: 1, can: 3, been: 4, not: 5 };

function rank(box: BoardBox): number {
  if (box.state === "here") return 0;
  if (box.home) return 1;
  if (box.picked) return 2;
  return STATE_RANK[box.state];
}

function covers(a: BoardBox, b: BoardBox, gap: number): boolean {
  return a.left < b.right + gap && b.left < a.right + gap && a.top < b.bottom + gap && b.top < a.bottom + gap;
}

/** Which boards show: true for each that covers no board that matters more. */
export function boardsShown(boxes: readonly BoardBox[], gap = BOARD_GAP): boolean[] {
  const order = boxes.map((_, index) => index).sort((a, b) => rank(boxes[a]!) - rank(boxes[b]!) || boxes[b]!.bottom - boxes[a]!.bottom);
  const shown = boxes.map(() => false);
  const kept: BoardBox[] = [];
  for (const index of order) {
    const box = boxes[index]!;
    if (kept.some((other) => covers(box, other, gap))) continue;
    shown[index] = true;
    kept.push(box);
  }
  return shown;
}
