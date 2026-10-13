// The painted map's lines as SVG path data (docs/rules/world.md R-WORLD-015), built once from the drawing and the
// seeded layout and shared by every view of the map: the strip, the cards and the open map draw the same strings at
// their own zoom. A few long paths rather than thousands of elements, so a card swipes and the map unfolds smoothly.
import { content } from "@japacity/content";

import { type Point, toPaper, PAPER } from "./fit";
import { BEACH, BRIDGE_NAME_PATH, DECOR, FERRY_LINE, LABELS, LAND, LANDMARKS, PALMS, ROADS } from "./geometry";
import { type Clear, type Ground, type House, ROOFS, scatter, type Scattered } from "./scatter";
import { curve, loop } from "./smooth";

/** What the scatter keeps clear of: every place of Lagos with a position, the names, the landmarks and the decor. */
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
  return {
    land: Object.values(LAND),
    roads: ROADS.map((road) => ({ points: road.points, reach: road.bridge === undefined ? (road.main ? 8 : 6) : 9 })),
    clear: [...places, ...names, ...landmarks, ...decor],
    box: [0, 0, PAPER.width, PAPER.height],
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

export interface Grain {
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

export interface Drawing {
  land: string;
  coast: string;
  beach: string;
  roadsMain: string;
  roadsMinor: string;
  bridges: { id: string; d: string }[];
  ferry: string;
  bridgeName: string;
  waves: string;
  wide: Grain;
  close: Grain;
  palmTrunks: string;
  palmFronds: string;
  scattered: Scattered;
}

let drawn: Drawing | null = null;

/** The drawing, built the first time it is asked for and kept: the same strings for every view. */
export function drawing(): Drawing {
  if (drawn !== null) return drawn;
  const scattered = scatter(groundOf());
  const palms = PALMS.map(([x, y, size, facing]) => palm(x, y, size, facing));
  drawn = {
    land: Object.values(LAND).map(loop).join(""),
    coast: Object.values(LAND).map(loop).join(""),
    beach: curve(BEACH),
    roadsMain: ROADS.filter((road) => road.main && road.bridge === undefined)
      .map((road) => curve(road.points))
      .join(""),
    roadsMinor: ROADS.filter((road) => !road.main && road.bridge === undefined)
      .map((road) => curve(road.points))
      .join(""),
    bridges: ROADS.filter((road) => road.bridge !== undefined).map((road) => ({ id: road.bridge ?? "", d: curve(road.points) })),
    ferry: curve(FERRY_LINE),
    bridgeName: curve(BRIDGE_NAME_PATH),
    waves: scattered.waves.map(wave).join(""),
    wide: grainOf(scattered.houses, scattered.trees),
    close: grainOf(scattered.closeHouses, scattered.closeTrees),
    palmTrunks: palms.map(([trunk]) => trunk).join(""),
    palmFronds: palms.map(([, fronds]) => fronds).join(""),
    scattered,
  };
  return drawn;
}
