// The painted map's lines as SVG path data (world:map-is-painted-lagos), built once from the drawing and the
// seeded layout and shared by every view of the map: the strip, the cards and the open map draw the same strings at
// their own zoom. A few long paths rather than thousands of elements, so a card swipes and the map unfolds smoothly.
import { content } from "@japacity/content";

import { type Point, toPaper, PAPER } from "./fit";
import { BEACH, BRIDGE_NAME_PATH, DECOR, FERRY_LINE, LABELS, LAND, LANDMARKS, LANTERN_CANOE, LANTERN_CANOE_CLEAR, PALMS, type Road, ROADS } from "./geometry";
import { type Clear, type Ground, type House, ROOFS, scatter, type Scattered } from "./scatter";
import { curve, loop } from "./smooth";

/** What the scatter keeps clear of: every place of Lagos with a position, the names, the landmarks, the decor and the lantern canoe. */
export function groundOf(): Ground {
  const places: Clear[] = Object.values(content.place)
    .filter((place) => place.where === "home" && place.position !== null)
    .map((place) => {
      const [x, y] = toPaper(place.position ?? { latE3: 0, lonE3: 0 });
      return [x, y, 9];
    });
  const names: Clear[] = LABELS.map((label) => [label.at[0], label.at[1] - 3, Math.round((label.size * label.key.length) / 9) + 4]);
  const landmarks: Clear[] = Object.values(LANDMARKS).map(([x, y]) => [x, y, 16]);
  const decor: Clear[] = DECOR.map((item) => [item.at[0], item.at[1], Math.round(item.size / 2) + 2]);
  // world:lantern-canoe-on-map: no wave is drawn over the lantern canoe.
  const canoe: Clear = [LANTERN_CANOE.at[0], LANTERN_CANOE.at[1], LANTERN_CANOE_CLEAR];
  return {
    land: Object.values(LAND),
    roads: ROADS.map((road) => ({ points: road.points, reach: road.bridge === undefined ? (road.main ? 8 : 6) : 9 })),
    clear: [...places, ...names, ...landmarks, ...decor, canoe],
    box: [-140, 0, PAPER.width + 140, PAPER.height],
  };
}

const n = String;

/** A house from above and a little to the side: a white box, a coloured roof, a lit window. */
function houseWalls({ x, y }: House): string {
  return `M${n(x - 4)},${n(y - 2)}h8v6h-8z`;
}
function houseRoof({ x, y }: House): string {
  return `M${n(x - 5)},${n(y - 2)}L${n(x)},${n(y - 7)}L${n(x + 5)},${n(y - 2)}z`;
}
function houseWindow({ x, y }: House): string {
  return `M${n(x - 1)},${n(y)}h2v2h-2z`;
}
/** A tree: three round crowns. */
function tree([x, y]: Point): string {
  const circle = (cx: number, cy: number, r: number): string => `M${n(cx - r)},${n(cy)}a${n(r)},${n(r)} 0 1,0 ${n(r * 2)},0a${n(r)},${n(r)} 0 1,0 ${n(-r * 2)},0`;
  return circle(x - 3, y, 3) + circle(x + 3, y, 3) + circle(x, y - 3, 3);
}
function treeLight([x, y]: Point): string {
  return `M${n(x - 2)},${n(y - 4)}a1,1 0 1,0 2,0a1,1 0 1,0 -2,0`;
}
function wave([x, y]: Point): string {
  return `M${n(x - 6)},${n(y)}q3,-3 6,0t6,0`;
}

interface Grain {
  walls: string;
  windows: string;
  roofs: string[];
  trees: string;
  treeLights: string;
}

function grainOf(houses: readonly House[], trees: readonly Point[]): Grain {
  const roofs = Array.from({ length: ROOFS }, (_, roof) =>
    houses
      .filter((house) => house.roof === roof)
      .map(houseRoof)
      .join(""),
  );
  return { walls: houses.map(houseWalls).join(""), windows: houses.map(houseWindow).join(""), roofs, trees: trees.map(tree).join(""), treeLights: trees.map(treeLight).join("") };
}

/** A palm: a curved trunk and five fronds, as [trunk, fronds]. */
function palm(x: number, y: number, size: number, facing: 1 | -1): [string, string] {
  const p = (dx: number, dy: number): string => `${n(x + Math.round((dx * size * facing) / 100))},${n(y + Math.round((dy * size) / 100))}`;
  const trunk = `M${p(0, 0)}C${p(1, -6)} ${p(3, -11)} ${p(2, -16)}`;
  const fronds = [
    `M${p(2, -16)}C${p(-4, -20)} ${p(-9, -18)} ${p(-11, -13)}C${p(-6, -16)} ${p(-2, -16)} ${p(2, -16)}z`,
    `M${p(2, -16)}C${p(8, -21)} ${p(13, -19)} ${p(15, -14)}C${p(10, -17)} ${p(6, -17)} ${p(2, -16)}z`,
    `M${p(2, -16)}C${p(-1, -23)} ${p(-6, -24)} ${p(-9, -22)}C${p(-4, -21)} ${p(0, -19)} ${p(2, -16)}z`,
    `M${p(2, -16)}C${p(6, -24)} ${p(11, -25)} ${p(13, -22)}C${p(9, -21)} ${p(5, -19)} ${p(2, -16)}z`,
  ].join("");
  return [trunk, fronds];
}

/** The grain of one square of the paper: drawn as paths of their own, so a view draws only the squares it shows. */
interface Cell {
  box: readonly [number, number, number, number];
  wide: Grain;
  close: Grain;
  waves: string;
}

/** The squares the grain is cut into, in paper units. */
export const CELL = 120;

export interface Drawing {
  land: string;
  coast: string;
  beach: string;
  roadsMain: string;
  roadsMinor: string;
  bridges: { id: string; d: string }[];
  /** The railways' path data, empty where none is drawn. */
  rails: string;
  ferry: string;
  bridgeName: string;
  cells: Cell[];
  palmTrunks: string;
  palmFronds: string;
  scattered: Scattered;
}

/** The grain cut into squares, each with its own paths. */
function cellsOf(scattered: Scattered): Cell[] {
  const keyOf = (x: number, y: number): string => `${String(Math.floor(x / CELL))},${String(Math.floor(y / CELL))}`;
  const keys = new Set<string>();
  const add = (x: number, y: number): string => {
    const key = keyOf(x, y);
    keys.add(key);
    return key;
  };
  const houses = scattered.houses.map((house) => ({ house, key: add(house.x, house.y) }));
  const trees = scattered.trees.map((tree) => ({ tree, key: add(tree[0], tree[1]) }));
  const closeHouses = scattered.closeHouses.map((house) => ({ house, key: add(house.x, house.y) }));
  const closeTrees = scattered.closeTrees.map((tree) => ({ tree, key: add(tree[0], tree[1]) }));
  const waves = scattered.waves.map((point) => ({ point, key: add(point[0], point[1]) }));
  return [...keys].sort().map((key) => {
    const [cx, cy] = key.split(",").map(Number) as [number, number];
    // A house or a tree reaches a few units past its own point, so the box takes a margin.
    const box = [cx * CELL - 10, cy * CELL - 10, (cx + 1) * CELL + 10, (cy + 1) * CELL + 10] as const;
    return {
      box,
      wide: grainOf(houses.filter((item) => item.key === key).map((item) => item.house), trees.filter((item) => item.key === key).map((item) => item.tree)),
      close: grainOf(closeHouses.filter((item) => item.key === key).map((item) => item.house), closeTrees.filter((item) => item.key === key).map((item) => item.tree)),
      waves: waves.filter((item) => item.key === key).map((item) => wave(item.point)).join(""),
    };
  });
}

/**
 * What a painted city's drawing is made from (world:map-is-painted-lagos, world:painted-maps-abroad): its land, its beach, its roads and
 * bridges, its railways, the ferry's line and the bridge's name where it has them, its palms, and the ground its grain
 * is scattered over. An empty line draws nothing.
 */
export interface DrawSource {
  land: Readonly<Record<string, readonly Point[]>>;
  beach: readonly Point[];
  roads: readonly Road[];
  rails: readonly (readonly Point[])[];
  ferry: readonly Point[];
  bridgeName: readonly Point[];
  palms: readonly (readonly [number, number, number, 1 | -1])[];
  ground: () => Ground;
}

/** Lagos's drawing, from the drawing of Lagos (geometry.ts); it has no railway drawn. */
export const LAGOS_DRAW: DrawSource = { land: LAND, beach: BEACH, roads: ROADS, rails: [], ferry: FERRY_LINE, bridgeName: BRIDGE_NAME_PATH, palms: PALMS, ground: groundOf };

const drawn = new WeakMap<DrawSource, Drawing>();

/** A line as path data, or nothing for a line with no points. */
const line = (points: readonly Point[]): string => (points.length === 0 ? "" : curve(points));

/** A city's drawing, built the first time it is asked for and kept: the same strings for every view. */
export function drawingOf(source: DrawSource): Drawing {
  const kept = drawn.get(source);
  if (kept !== undefined) return kept;
  const scattered = scatter(source.ground());
  const palms = source.palms.map(([x, y, size, facing]) => palm(x, y, size, facing));
  const made: Drawing = {
    land: Object.values(source.land).map(loop).join(""),
    coast: Object.values(source.land).map(loop).join(""),
    beach: line(source.beach),
    roadsMain: source.roads
      .filter((road) => road.main && road.bridge === undefined)
      .map((road) => curve(road.points))
      .join(""),
    roadsMinor: source.roads
      .filter((road) => !road.main && road.bridge === undefined)
      .map((road) => curve(road.points))
      .join(""),
    bridges: source.roads.filter((road) => road.bridge !== undefined).map((road) => ({ id: road.bridge ?? "", d: curve(road.points) })),
    rails: source.rails.map(line).join(""),
    ferry: line(source.ferry),
    bridgeName: line(source.bridgeName),
    cells: cellsOf(scattered),
    palmTrunks: palms.map(([trunk]) => trunk).join(""),
    palmFronds: palms.map(([, fronds]) => fronds).join(""),
    scattered,
  };
  drawn.set(source, made);
  return made;
}

/** Lagos's drawing. */
export function drawing(): Drawing {
  return drawingOf(LAGOS_DRAW);
}
