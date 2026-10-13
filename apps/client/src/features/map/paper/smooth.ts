// The painted line (docs/rules/world.md R-WORLD-015): a coast, a road or the route is drawn as a soft curve through
// its points rather than a ruled line, the way a hand-drawn map is, with every control point a whole number.
import type { Point } from "./fit";

const SIXTH = 6;

/** A control point a sixth of the way along the neighbours' line from `from`, rounded to whole units. */
function pull(from: Point, before: Point, after: Point, sign: 1 | -1): string {
  return `${String(from[0] + sign * Math.round((after[0] - before[0]) / SIXTH))},${String(from[1] + sign * Math.round((after[1] - before[1]) / SIXTH))}`;
}

const xy = (point: Point): string => `${String(point[0])},${String(point[1])}`;

/** An open curve through every point, ending at both ends (a road, the route). */
export function curve(points: readonly Point[]): string {
  const first = points[0];
  if (first === undefined) return "";
  if (points.length < 3) return `M${points.map(xy).join("L")}`;
  let d = `M${xy(first)}`;
  for (let index = 0; index + 1 < points.length; index += 1) {
    const a = points[index] ?? first;
    const b = points[index + 1] ?? a;
    const before = points[index - 1] ?? a;
    const after = points[index + 2] ?? b;
    d += `C${pull(a, before, b, 1)} ${pull(b, a, after, -1)} ${xy(b)}`;
  }
  return d;
}

/** A closed curve through every point of a ring (a coast). */
export function loop(points: readonly Point[]): string {
  const count = points.length;
  const first = points[0];
  if (first === undefined) return "";
  let d = `M${xy(first)}`;
  for (let index = 0; index < count; index += 1) {
    const a = points[index] ?? first;
    const b = points[(index + 1) % count] ?? first;
    const before = points[(index - 1 + count) % count] ?? a;
    const after = points[(index + 2) % count] ?? b;
    d += `C${pull(a, before, b, 1)} ${pull(b, a, after, -1)} ${xy(b)}`;
  }
  return `${d}Z`;
}
