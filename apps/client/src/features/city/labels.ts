// The things' labels over the place (docs/rules/world.md R-WORLD-005): each stands over its
// thing, and where two would cover each other the higher one on the screen is lifted clear, so none hides another. A
// thing's dot never moves off its thing; only its name is lifted, and never far: a name that would stand more than
// NAME_LIFT_MAX over its dot waits unshown, so the family house's names never stack into the sky.

/** How high over a thing's spot its mark and a speaker's words stand, in metres. */
export const LABEL_Y = 2.6;
/** A person's head on the screen runs from about this far over their feet... */
export const HEAD_TOP = 1.95;
/** ...down to about here, the chin and the neck under it. */
export const HEAD_CHIN = 1.4;
/** The tap target a mark's dot sits in, its foot on the thing (mark.ts): a name stands on top of it. */
export const MARK_HIT = 32;

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
  const placed: LabelBox[] = [];
  for (const index of lowestFirst(boxes)) {
    const box = boxes[index];
    if (box === undefined) continue;
    const at = liftedClear(box, placed, gap);
    feet[index] = at.y;
    placed.push(at);
  }
  return feet;
}

/** The boxes' places, the lowest on the screen first. */
function lowestFirst(boxes: readonly LabelBox[]): number[] {
  return boxes.map((_, index) => index).sort((a, b) => (boxes[b]?.y ?? 0) - (boxes[a]?.y ?? 0));
}

/** A box lifted over whatever placed box it would cover, one at a time; each can be passed at most once. */
function liftedClear(box: LabelBox, placed: readonly LabelBox[], gap: number): LabelBox {
  let at = { ...box };
  for (let lift = 0; lift <= placed.length; lift += 1) {
    const under = placed.find((other) => covers(at, other, gap));
    if (under === undefined) break;
    at = { ...at, y: under.y - under.height - gap };
  }
  return at;
}

/** The most a thing's name is lifted over its dot to stand clear of the others: two rows of names. */
export const NAME_LIFT_MAX = 64;

/** A name laid out: where its foot stands, and whether it shows at all. */
export interface LaidName {
  foot: number;
  shown: boolean;
}

/**
 * The names over a place's dots laid out so none covers another nor a dot (`fixed`, which never move): the lowest on the
 * screen keeps its place, each above it is lifted over any it would cover, and a name that would rise more than `most`
 * over its own spot is not shown, so no name floats away from its thing; its dot stays.
 */
export function layNames(boxes: readonly LabelBox[], fixed: readonly LabelBox[] = [], most = NAME_LIFT_MAX, gap = LABEL_GAP): LaidName[] {
  const laid: LaidName[] = boxes.map((box) => ({ foot: box.y, shown: true }));
  const placed: LabelBox[] = [...fixed];
  for (const index of lowestFirst(boxes)) {
    const box = boxes[index];
    if (box === undefined) continue;
    const at = liftedClear(box, placed, gap);
    const clear = placed.every((other) => !covers(at, other, gap));
    if (!clear || box.y - at.y > most) {
      laid[index] = { foot: box.y, shown: false };
      continue;
    }
    laid[index] = { foot: at.y, shown: true };
    placed.push(at);
  }
  return laid;
}

/** A person's head on the screen, from the top of it and the chin under it as the camera projects them: the box a word bubble keeps clear of. */
export function headRect(top: { x: number; y: number }, chin: { x: number; y: number }): { left: number; top: number; right: number; bottom: number } {
  const half = Math.max(9, (chin.y - top.y) * 0.6);
  return { left: top.x - half, right: top.x + half, top: top.y - 4, bottom: chin.y };
}

/** A thing's dot on the screen, from its mark's anchor (the foot of its tap target): the 6 px dot, its ring and a little room round it. */
export function dotRect(at: { x: number; y: number }): { left: number; top: number; right: number; bottom: number } {
  const middle = at.y - MARK_HIT / 2;
  return { left: at.x - 6, right: at.x + 6, top: middle - 6, bottom: middle + 6 };
}
