// The smoke puff (assets:flat-and-smooth-shading, assets:organic-shapes-baked-at-build; city:motion-in-vertex-shader): five balls blended into one
// soft cloud, turned into triangles and thinned when the game is built, and shown smooth. The client
// draws only the finished triangles, instanced, and its shader shrinks each copy to nothing.
// `pnpm exec tsx models/props/smoke/write.ts` writes them to apps/client/src/shared/three/puff.data.ts.
import { type Blend, project, surface, type Surface } from "../../people/blend";
import { thin } from "../../people/thin";

/** About 0.3 m across the middle, as the faceted ball it replaces, lumpier on top than below. */
export const PUFF_BLEND: Blend = {
  shapes: [
    { kind: "ball", c: [0, 0, 0], r: 0.24 },
    { kind: "ball", c: [0.15, 0.05, 0.03], r: 0.17 },
    { kind: "ball", c: [-0.14, 0.04, -0.05], r: 0.16 },
    { kind: "ball", c: [0.02, 0.15, 0.08], r: 0.14 },
    { kind: "ball", c: [-0.03, 0.02, -0.15], r: 0.13 },
  ],
  k: 0.12,
};

/** The grid the raw surface is sampled on, in metres. */
export const PUFF_CELL = 0.025;
/** The faceted ball it replaces had 80 triangles: the puff costs no more. */
export const PUFF_TRIANGLES = 80;

/** The raw blended surface, before thinning. */
export function rawPuff(): Surface {
  return surface(PUFF_BLEND, PUFF_CELL);
}

/** The finished puff: thinned to PUFF_TRIANGLES and pulled back onto the blend. */
export function buildPuff(): Surface {
  return project(PUFF_BLEND, thin(rawPuff(), PUFF_TRIANGLES), PUFF_CELL);
}

const MM = 1000;

/** The puff as flat arrays for an indexed geometry, positions to the millimetre so the file is small and stable. */
export function puffArrays(puff: Surface = buildPuff()): { positions: number[]; index: number[] } {
  const used = [...new Set(puff.triangles.flat())].sort((one, two) => one - two);
  const renumber = new Map(used.map((old, next) => [old, next]));
  return {
    positions: used.flatMap((old) => (puff.positions[old] ?? [0, 0, 0]).map((value) => Math.round(value * MM) / MM)),
    index: puff.triangles.flatMap((triangle) => triangle.map((old) => renumber.get(old) ?? 0)),
  };
}
