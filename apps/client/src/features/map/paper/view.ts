// The open map's view (docs/rules/world.md R-WORLD-015, R-WORLD-036): which paper point stands in the middle of the
// screen and at what zoom, where it first opens from a card, and the frame it gives the drawing. Plain numbers, so
// where the open map lands from every card is tested without a screen. Each painted city opens on its own paper
// (R-WORLD-038); Lagos's unless another is given.
import type { PaperCity } from "./city";
import { PAPER, type Point } from "./fit";
import { LAGOS } from "./lagos";
import type { Frame } from "./World";

/** The open map's zoom on a phone, and how far a pinch may take it. */
const OPEN_ZOOM = 0.92;
const WIDE_ZOOM = 1.3;
const ZOOM_MIN = 0.55;
const ZOOM_MAX = 2.6;

/** The open map's view: the paper point in the middle and the zoom. */
export interface OpenView {
  cx: number;
  cy: number;
  z: number;
}

/** A screen's size in pixels. */
export interface Size {
  width: number;
  height: number;
}

export function clampView(view: OpenView, paper: { width: number; height: number } = PAPER): OpenView {
  const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, view.z));
  return { cx: Math.min(paper.width, Math.max(0, view.cx)), cy: Math.min(paper.height, Math.max(0, view.cy)), z };
}

export function openFrame(view: OpenView, width: number, height: number): Frame {
  return { x: width / 2 - view.z * view.cx, y: height / 2 - view.z * view.cy, sx: view.z, sy: view.z };
}

/** Where a paper point lands on the screen in a view. */
export function onScreen(view: OpenView, size: Size, [x, y]: Point): Point {
  return [size.width / 2 + view.z * (x - view.cx), size.height / 2 + view.z * (y - view.cy)];
}

/** Half the canoe's hit area, in screen pixels (LanternCanoe.tsx `CANOE_HIT`), and the room kept round it. */
const CANOE_HALF = 22;
const CANOE_ROOM = 8;
/** The open map's head row (the country pill and the close button): the canoe opens below it. */
const OPEN_HEAD = 64;

/**
 * Where the canoe may stand on the screen as the open map opens: whole, clear of the screen's edges by a little, and
 * below the head row, so it is never half off the screen nor under the close button (R-WORLD-036).
 */
export function canoeRoom(size: Size): readonly [number, number, number, number] {
  const keep = CANOE_HALF + CANOE_ROOM;
  return [keep, OPEN_HEAD + keep, size.width - keep, size.height - keep];
}

/**
 * The open map's first look from a card: the district a little up and to the left of the middle, so the lagoon, its
 * bridge and the island come into the same look as where the player was. Where that look would show only part of the
 * lantern canoe, or put it under the head row, it moves by the least that brings the canoe whole into view (R-WORLD-036);
 * a look that leaves the canoe wholly off the screen stays as it is.
 */
export function openingView(card: string, wide: boolean, size: Size, city: Pick<PaperCity, "cards" | "paper" | "opening" | "canoe"> = LAGOS): OpenView {
  const framed = city.cards.find((candidate) => candidate.id === card) ?? city.cards[0];
  if (framed === undefined) return clampView({ cx: city.paper.width / 2, cy: city.paper.height / 2, z: wide ? WIDE_ZOOM : OPEN_ZOOM }, city.paper);
  // A laptop's screen is wide: it takes the district closer, the lagoon and the island beside it.
  const [ox, oy] = wide ? city.opening.wide : city.opening.phone;
  const view = clampView({ cx: framed.centre[0] + ox, cy: framed.centre[1] + oy, z: wide ? WIDE_ZOOM : OPEN_ZOOM }, city.paper);
  if (city.canoe === null) return view;
  const [x, y] = onScreen(view, size, city.canoe);
  const off = x < -CANOE_HALF || x > size.width + CANOE_HALF || y < -CANOE_HALF || y > size.height + CANOE_HALF;
  if (off) return view;
  const [left, top, right, bottom] = canoeRoom(size);
  // A pixel past the room's edge, so the canoe lands inside it whatever the rounding.
  const dx = x < left ? x - left - 1 : x > right ? x - right + 1 : 0;
  const dy = y < top ? y - top - 1 : y > bottom ? y - bottom + 1 : 0;
  return dx === 0 && dy === 0 ? view : clampView({ ...view, cx: view.cx + dx / view.z, cy: view.cy + dy / view.z }, city.paper);
}
