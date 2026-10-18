// Where the fan's buttons stand (docs/design/09-the-lively-layer.md section 3; world:things-are-tappable-models): the thing
// is the hinge, and its acts sit along a curve that bows out from it into the larger free side of the screen, each with
// its labels outside the curve. Pure: the thing's point, the screen and the count in; the side, the places and the fold out.
//
// The curve is half an ellipse about the thing, `rx` across and `ry` tall: a circle of the given radius for a few acts,
// drawn taller for more, since a true circle cannot hold six buttons with labels beside them on a
// phone. The buttons stand one pitch apart in height along it, so no label row covers the next, and a drag slides them
// along the same curve.

/** The fan's measures on one kind of screen, in CSS pixels. */
export interface FanSizes {
  /** The curve's reach across from the thing, and its least height. */
  radius: number;
  /** A round button's width. */
  button: number;
  /** The height from one button's centre to the next. */
  pitch: number;
  /** The widest label row beside a button: the name pill, or the price with the balance. */
  label: number;
  /** The space between a button and its labels. */
  gap: number;
}

export const PHONE: FanSizes = { radius: 170, button: 64, pitch: 88, label: 132, gap: 8 };
export const LAPTOP: FanSizes = { radius: 200, button: 72, pitch: 100, label: 200, gap: 10 };

/** From this width up the screen is a laptop's: larger buttons on a wider curve (section 2, "The laptop"). */
const LAPTOP_WIDTH = 768;

export function fanSizes(width: number): FanSizes {
  return width >= LAPTOP_WIDTH ? LAPTOP : PHONE;
}

/** Up to six acts stand before the fold; a seventh peeks below it (section 3). */
const MAX_SHOWN = 6;
/** The free side must hold this many buttons, or every act when there are fewer, or the sheet opens instead. */
const LEAST_SHOWN = 3;
/** The space kept between a label and the screen's edge. */
const EDGE = 12;
/** The height at which the last act before the fold stands on the curve, as an angle: the curve's ends bow back toward the thing. */
const END_ANGLE = (65 * Math.PI) / 180;

export interface FanInput extends FanSizes {
  /** The thing's point on the screen. */
  at: { x: number; y: number };
  screen: { width: number; height: number };
  count: number;
  /** What covers the top of the screen (the band) and its foot (the thumbs): no button before the fold stands under them. */
  inset?: { top: number; bottom: number };
}

/** A button's centre, from the thing's point, and whether it stands past the fold. */
export interface FanPlace {
  dx: number;
  dy: number;
  folded: boolean;
}

export interface FanLayout {
  side: "left" | "right";
  /** False when the free side cannot hold the fan: the caller opens the sheet of the same acts instead. */
  fits: boolean;
  /** How many acts stand before the fold. */
  shown: number;
  count: number;
  /** Every act's place with the fan at rest. */
  places: FanPlace[];
  /** The curve, from the thing's point: its reach across, its height, and the height of its middle. */
  rx: number;
  ry: number;
  cy: number;
  /** The first act's height at rest and the window of the fold, from the thing's point. */
  first: number;
  window: { top: number; bottom: number };
  sizes: FanSizes;
}

/** How far across the curve stands at a height: half an ellipse about its middle, meeting the thing's column at its ends. */
function across(layout: Pick<FanLayout, "rx" | "ry" | "cy" | "side">, dy: number): number {
  const share = Math.max(-1, Math.min(1, (dy - layout.cy) / layout.ry));
  const reach = layout.rx * Math.sqrt(1 - share * share);
  return layout.side === "right" ? reach : -reach;
}

export function fanLayout(input: FanInput): FanLayout {
  const { at, screen, count, inset = { top: 0, bottom: 0 } } = input;
  const sizes: FanSizes = { radius: input.radius, button: input.button, pitch: input.pitch, label: input.label, gap: input.gap };
  const side = screen.width - at.x >= at.x ? "right" : "left";
  const free = side === "right" ? screen.width - at.x : at.x;
  // The curve reaches as far as the free side leaves room for a button and its labels outside it.
  const rx = Math.min(sizes.radius, free - EDGE - sizes.label - sizes.gap - sizes.button / 2);
  // Button centres stand between the band and the thumbs.
  const top = inset.top + sizes.button / 2;
  const bottom = screen.height - inset.bottom - sizes.button / 2;
  const room = bottom - top;
  const capacity = room < 0 ? 0 : Math.floor(room / sizes.pitch) + 1;
  const shown = Math.min(count, MAX_SHOWN, capacity);
  const span = Math.max(0, shown - 1) * sizes.pitch;
  // With acts past the fold the shown ones end at the thumbs, so the next peeks under the fold; else they are centred on the thing.
  const firstAt = count > shown ? bottom - span : Math.min(Math.max(at.y - span / 2, top), bottom - span);
  const first = firstAt - at.y;
  const cy = first + span / 2;
  // Tall enough that the last before the fold, and one past it, stay on the bowed part of the curve.
  const ry = Math.max(sizes.radius, (span / 2 + sizes.pitch) / Math.sin(END_ANGLE));
  const onScreen = at.x >= 0 && at.x <= screen.width && at.y >= 0 && at.y <= screen.height;
  const fits = onScreen && count > 0 && rx >= sizes.button / 2 + 4 && shown >= Math.min(count, LEAST_SHOWN);
  const window = { top: first - sizes.pitch / 2, bottom: first + span + sizes.pitch / 2 };
  const base = { side, fits, shown, count, rx: Math.max(0, rx), ry, cy, first, window, sizes } as const;
  return { ...base, places: placesOn(base, 0) };
}

function placesOn(layout: Omit<FanLayout, "places">, shift: number): FanPlace[] {
  return Array.from({ length: layout.count }, (_, index) => {
    const dy = layout.first + index * layout.sizes.pitch + shift;
    return { dx: across(layout, dy), dy, folded: dy < layout.window.top || dy > layout.window.bottom };
  });
}

/** How far the acts may be dragged along the curve: up until the last has come above the fold, and back. */
export function shiftRange(layout: Pick<FanLayout, "count" | "shown" | "sizes">): { min: number; max: number } {
  return { min: -Math.max(0, layout.count - layout.shown) * layout.sizes.pitch, max: 0 };
}

/** Every act's place with the fan dragged `shift` pixels along its curve, held within its range. */
export function placesAt(layout: FanLayout, shift: number): FanPlace[] {
  const range = shiftRange(layout);
  return placesOn(layout, Math.min(range.max, Math.max(range.min, shift)));
}

/** The curve as an SVG path from the thing's point, through every act's place and a little past the first and the last. */
export function curvePath(layout: FanLayout, shift = 0): string {
  const range = shiftRange(layout);
  const held = Math.min(range.max, Math.max(range.min, shift));
  const from = layout.first + held - layout.sizes.pitch * 0.6;
  const to = layout.first + held + (layout.count - 1) * layout.sizes.pitch + layout.sizes.pitch * 0.6;
  const steps = 24;
  const points = Array.from({ length: steps + 1 }, (_, step) => {
    const dy = from + ((to - from) * step) / steps;
    return `${across(layout, dy).toFixed(1)} ${dy.toFixed(1)}`;
  });
  return `M${points.join(" L")}`;
}
