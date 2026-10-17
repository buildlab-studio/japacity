// Faces at one height (docs/rules/world.md R-WORLD-012). Two horizontal faces that overlap within a
// centimetre of the same height fight for the same pixels and show as flickering stripes (a slab laid
// on the ground shows them). A place's floor is its ground at 0, its strips of road
// and pavement laid over it, and the floors of its models: every face of a model that looks up and
// lies lower than FLOOR_MAX, a slab, a step, a rug. The client lays the strips with `stripTops` and
// the check reads the same heights, so what is checked is what is drawn. Pure: no file, no browser.
import type { Document as GltfDocument } from "@gltf-transform/core";

/** Two overlapping faces closer in height than this fight (R-WORLD-012). */
export const FACE_GAP = 0.01;
/** How far each layer of strips stands over the one under it: clear of FACE_GAP with room to spare. */
export const STRIP_STEP = 0.012;
/** A model's face that looks up and lies lower than this is laid on the ground: a floor, a slab, a rug. */
export const FLOOR_MAX = 0.1;
/** Heights closer than this are one surface cut into triangles, not two faces. */
const SAME = 1e-4;
/** Overlaps thinner than this are faces that only touch at an edge. */
const TOUCH = 1e-3;

export type Corner = [number, number];

/** A strip of the stage as the place file writes it (placeFile.ts Strip). */
export interface StripShape {
  at: [number, number, number];
  size: [number, number];
  raise?: number;
}

/** A face of a model in its own frame: its height and its corners in x and z. */
export interface ModelFace {
  y: number;
  corners: Corner[];
}

/** A face of a place: its height, its corners in the place's frame, and what it belongs to. */
export interface PlaceFace {
  y: number;
  corners: Corner[];
  source: string;
}

/** The parts of a stage the check reads. */
export interface FacedStage {
  ground: { size: [number, number] };
  roads: StripShape[];
  models: { file: string; at: [number, number, number][] }[];
  dressings?: { offer?: string; person?: string; models: { file: string; at: [number, number, number][] }[]; hide?: string[] }[];
}

/** A point of a turned frame placed at x and z, as the client places strips and model copies. */
function placed(x: number, z: number, turn: number, along: number, across: number): Corner {
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  return [x + along * cos + across * sin, z - along * sin + across * cos];
}

/** The four corners of a strip on the ground. */
export function stripCorners(strip: StripShape): Corner[] {
  const [x, z, turn] = strip.at;
  const half = [strip.size[0] / 2, strip.size[1] / 2] as const;
  return [placed(x, z, turn, -half[0], -half[1]), placed(x, z, turn, half[0], -half[1]), placed(x, z, turn, half[0], half[1]), placed(x, z, turn, -half[0], half[1])];
}

function axes(polygon: readonly Corner[]): Corner[] {
  return polygon.map((corner, index) => {
    const next = polygon[(index + 1) % polygon.length] ?? corner;
    const edge: Corner = [next[0] - corner[0], next[1] - corner[1]];
    const length = Math.hypot(edge[0], edge[1]);
    return length === 0 ? [0, 0] : [-edge[1] / length, edge[0] / length];
  });
}

function spread(polygon: readonly Corner[], axis: Corner): [number, number] {
  let low = Infinity;
  let high = -Infinity;
  for (const [x, z] of polygon) {
    const along = x * axis[0] + z * axis[1];
    low = Math.min(low, along);
    high = Math.max(high, along);
  }
  return [low, high];
}

/** True when two convex polygons share more than an edge (separating axes). */
export function overlaps(a: readonly Corner[], b: readonly Corner[]): boolean {
  for (const axis of [...axes(a), ...axes(b)]) {
    if (axis[0] === 0 && axis[1] === 0) continue;
    const [aLow, aHigh] = spread(a, axis);
    const [bLow, bHigh] = spread(b, axis);
    if (Math.min(aHigh, bHigh) - Math.max(aLow, bLow) <= TOUCH) return false;
  }
  return true;
}

/**
 * The height of each strip's top, in list order. A strip lies one STRIP_STEP over the highest strip
 * before it that it overlaps, or over the ground; a raised strip (a kerb) adds its raise. Strips
 * that do not overlap share a height, so a street of forty strips stays a few centimetres high.
 */
export function stripTops(roads: readonly StripShape[]): number[] {
  const corners = roads.map(stripCorners);
  const levels: number[] = [];
  roads.forEach((_, index) => {
    let level = 1;
    for (let under = 0; under < index; under += 1) {
      if (overlaps(corners[index] ?? [], corners[under] ?? [])) level = Math.max(level, (levels[under] ?? 0) + 1);
    }
    levels.push(level);
  });
  return roads.map((strip, index) => (levels[index] ?? 1) * STRIP_STEP + (strip.raise ?? 0));
}

/** Every face of a model that looks up and lies under FLOOR_MAX, in the model's own frame. */
export function floorFaces(doc: GltfDocument): ModelFace[] {
  const faces: ModelFace[] = [];
  const at: number[] = [];
  doc.getRoot().getDefaultScene()?.traverse((node) => {
    const mesh = node.getMesh();
    if (mesh === null || node.getSkin() !== null) return;
    const m = node.getWorldMatrix();
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute("POSITION");
      if (position === null) continue;
      const points: [number, number, number][] = [];
      for (let index = 0; index < position.getCount(); index += 1) {
        position.getElement(index, at);
        const [x = 0, y = 0, z = 0] = at;
        points.push([m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]]);
      }
      const indices = primitive.getIndices();
      const count = indices === null ? points.length : indices.getCount();
      const corner = (index: number): [number, number, number] => points[indices === null ? index : indices.getScalar(index)] ?? [0, 0, 0];
      for (let index = 0; index + 2 < count; index += 3) {
        const [a, b, c] = [corner(index), corner(index + 1), corner(index + 2)];
        if (Math.abs(a[1] - b[1]) > SAME || Math.abs(a[1] - c[1]) > SAME || a[1] >= FLOOR_MAX) continue;
        // Looking up: the corners turn counter-clockwise seen from above.
        const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
        if (up <= 1e-9) continue;
        faces.push({ y: a[1], corners: [[a[0], a[2]], [b[0], b[2]], [c[0], c[2]]] });
      }
    }
  });
  return faces;
}

/** Every floor face of a stage: the ground, each strip at its top, and each copy of each model's floors. */
export function stageFaces(stage: Pick<FacedStage, "ground" | "roads">, models: FacedStage["models"], facesOf: (file: string) => readonly ModelFace[]): PlaceFace[] {
  const [width, depth] = stage.ground.size;
  const faces: PlaceFace[] = [{ y: 0, corners: [[-width / 2, -depth / 2], [width / 2, -depth / 2], [width / 2, depth / 2], [-width / 2, depth / 2]], source: "the ground" }];
  const tops = stripTops(stage.roads);
  stage.roads.forEach((strip, index) => faces.push({ y: tops[index] ?? 0, corners: stripCorners(strip), source: `strip ${String(index)}` }));
  for (const model of models) {
    const own = facesOf(model.file);
    model.at.forEach(([x, z, turn], copy) => {
      for (const face of own) faces.push({ y: face.y, corners: face.corners.map(([cx, cz]) => placed(x, z, turn, cx, cz)), source: `${model.file} copy ${String(copy)}` });
    });
  }
  return faces;
}

/** Every pair of faces that overlap within FACE_GAP of the same height, one line per pair of sources. */
export function fightingFaces(faces: readonly PlaceFace[]): string[] {
  const found = new Map<string, string>();
  for (let one = 0; one < faces.length; one += 1) {
    const a = faces[one];
    if (a === undefined) continue;
    for (let two = one + 1; two < faces.length; two += 1) {
      const b = faces[two];
      if (b === undefined) continue;
      const gap = Math.abs(a.y - b.y);
      if (gap >= FACE_GAP - 1e-9 || (gap < SAME && a.source === b.source)) continue;
      const key = [a.source, b.source].sort().join("|");
      if (found.has(key) || !overlaps(a.corners, b.corners)) continue;
      found.set(key, `${a.source} at ${a.y.toFixed(3)} m and ${b.source} at ${b.y.toFixed(3)} m overlap ${(gap * 1000).toFixed(1)} mm apart`);
    }
  }
  return [...found.values()];
}

/** R-WORLD-012: a place whose floor faces fight, in its plain stage or in any dressing, fails. */
export function checkFaces(place: string, stage: FacedStage | undefined, facesOf: (file: string) => readonly ModelFace[]): string[] {
  if (stage === undefined) return [];
  const problems = fightingFaces(stageFaces(stage, stage.models, facesOf)).map((line) => `R-WORLD-012: ${place}: ${line}`);
  for (const dressing of stage.dressings ?? []) {
    const hidden = new Set(dressing.hide ?? []);
    const models = [...stage.models.filter((model) => !hidden.has(model.file)), ...dressing.models];
    for (const line of fightingFaces(stageFaces(stage, models, facesOf))) {
      const said = `R-WORLD-012: ${place} dressed for ${dressing.offer ?? dressing.person ?? ""}: ${line}`;
      if (!problems.some((problem) => problem.endsWith(line))) problems.push(said);
    }
  }
  return problems;
}
