// The one fit from a place's position to the painted map (docs/rules/world.md R-WORLD-015): content keeps positions as
// whole thousandths of a degree (city.md R-CITY-008), and the paper is drawn in the same thousandths through this one
// affine map, so the land, the roads, the landmarks and every place with a position agree by construction, and a new
// place with a position lands in its district by itself. Whole numbers throughout, as the simulation keeps them.

/** Thousandths of a degree, as content keeps positions. */
export interface Position {
  latE3: number;
  lonE3: number;
}

/** A point on the paper: x to the east, y to the south, in paper units. */
export type Point = readonly [number, number];

/**
 * The affine map, as whole numbers: x = xLon * lon + xLat * lat + x0, y = yLon * lon + yLat * lat + y0. North is up, with
 * the city where it is (the lagoon to the east, the island to the south east, Ikeja up the mainland), drawn taller than
 * it is wide as a tourist map of a phone's shape is: a thousandth of a degree is four paper units east and seven south,
 * so the close streets of Surulere and Yaba have room for their places and the open map takes in the mainland, the
 * lagoon and the island at one look.
 */
export const FIT = { xLon: 4, xLat: 0, x0: -13160, yLon: 0, yLat: -7, y0: 46375 } as const;

/** The paper's own extent: from 3.290 to 3.480 east and from 6.625 down to 6.395 north. */
export const PAPER = { width: 760, height: 1610 } as const;

/** A position on the paper. */
export function toPaper(position: Position): Point {
  return [FIT.xLon * position.lonE3 + FIT.xLat * position.latE3 + FIT.x0, FIT.yLon * position.lonE3 + FIT.yLat * position.latE3 + FIT.y0];
}

/** A position written as [lat, lon] in thousandths, as the drawing is authored, on the paper. */
export function at([latE3, lonE3]: readonly [number, number]): Point {
  return toPaper({ latE3, lonE3 });
}

/** The position under a paper point, the fit undone and rounded to whole thousandths. */
export function fromPaper([x, y]: Point): Position {
  return { latE3: Math.round((y - FIT.y0) / FIT.yLat), lonE3: Math.round((x - FIT.x0) / FIT.xLon) };
}

/** An affine fit as whole numbers, of the shape of `FIT`: each city's painted map has its own (world.md R-WORLD-038). */
export interface Fit {
  xLon: number;
  xLat: number;
  x0: number;
  yLon: number;
  yLat: number;
  y0: number;
}

/** A fit's two ways: a position onto its paper, and a paper point back to the position under it (north up, no turn). */
export function fitOf(fit: Fit): { toPaper: (position: Position) => Point; fromPaper: (point: Point) => Position } {
  return {
    toPaper: (position) => [fit.xLon * position.lonE3 + fit.xLat * position.latE3 + fit.x0, fit.yLon * position.lonE3 + fit.yLat * position.latE3 + fit.y0],
    fromPaper: ([x, y]) => ({ latE3: Math.round((y - fit.y0) / fit.yLat), lonE3: Math.round((x - fit.x0) / fit.xLon) }),
  };
}
