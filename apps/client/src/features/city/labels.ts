// The things' labels over the place (docs/rules/world.md R-WORLD-005): each stands over its
// thing, and where two would cover each other the higher one on the screen is lifted clear, so none hides another.

/** A label as the scene lays it out: centred on `x`, its foot at `y`, in pixels. */
export interface LabelBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The space kept between two labels that would touch. */
export const LABEL_GAP = 4;

function covers(a: LabelBox, b: LabelBox, gap: number): boolean {
  return Math.abs(a.x - b.x) < (a.width + b.width) / 2 + gap && a.y - a.height < b.y + gap && b.y - b.height < a.y + gap;
}

/**
 * Where each label's foot stands so that none covers another: the lowest on the screen keeps its place, and each above
 * it is lifted over any it would cover. Labels keep their order and their `x`; only `y` moves, and only up.
 */
export function spreadLabels(boxes: readonly LabelBox[], gap = LABEL_GAP): number[] {
  const feet = boxes.map((box) => box.y);
  const order = boxes.map((_, index) => index).sort((a, b) => (boxes[b]?.y ?? 0) - (boxes[a]?.y ?? 0));
  const placed: LabelBox[] = [];
  for (const index of order) {
    const box = boxes[index];
    if (box === undefined) continue;
    let at = { ...box };
    // Each lift clears one label; a label can be lifted past every other at most once.
    for (let lift = 0; lift <= placed.length; lift += 1) {
      const under = placed.find((other) => covers(at, other, gap));
      if (under === undefined) break;
      at = { ...at, y: under.y - under.height - gap };
    }
    feet[index] = at.y;
    placed.push(at);
  }
  return feet;
}
