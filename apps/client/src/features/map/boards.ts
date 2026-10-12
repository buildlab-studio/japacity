// The stops' boards on the map never cover one another (docs/rules/world.md R-WORLD-015): where
// two would, the one that matters less is folded away until the view leaves room for it. Where the player stands and
// home always show, whatever they cover, then the stop picked, then the stops the player can go to, then those been to, then the rest; among equals,
// the board nearer the foot of the screen (nearer the camera) wins. A board folded away comes back only once it is
// clear by a margin, and one showing folds only once it truly covers, so the camera's easing never makes one flicker.
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

/**
 * A folded board is not gone: it shrinks to its icon alone on its pole. The icon is the left part of the painted board,
 * this share of its width, and the compact board is drawn square at the board's height.
 */
export const COMPACT_SHARE = 64 / 256;

/** The atlas rectangle of a board's icon alone: the left `share` of the board's rectangle. */
export function compactUv([u0, v0, u1, v1]: readonly [number, number, number, number], share = COMPACT_SHARE): [number, number, number, number] {
  return [u0, v0, u0 + (u1 - u0) * share, v1];
}
/** The extra room a folded board waits for before it comes back, in pixels, so the edge of covering does not flicker. */
export const BOARD_SETTLE = 12;

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

/**
 * Which boards show: where the player stands and home always; every other one when it covers no board that matters
 * more. `before` is the last answer: a board then folded needs `gap + settle` clear before it comes back.
 */
export function boardsShown(boxes: readonly BoardBox[], gap = BOARD_GAP, before: readonly boolean[] = [], settle = BOARD_SETTLE): boolean[] {
  const order = boxes.map((_, index) => index).sort((a, b) => rank(boxes[a]!) - rank(boxes[b]!) || boxes[b]!.bottom - boxes[a]!.bottom);
  const shown = boxes.map(() => false);
  const kept: BoardBox[] = [];
  for (const index of order) {
    const box = boxes[index]!;
    const always = box.state === "here" || box.home;
    const room = before[index] === false ? gap + settle : gap;
    if (!always && kept.some((other) => covers(box, other, room))) continue;
    shown[index] = true;
    kept.push(box);
  }
  return shown;
}
