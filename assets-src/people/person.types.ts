// The contract between the people builder and the export: a person is a skinned mesh as
// plain arrays, so the export writes it with gltf-transform and needs no browser (decision 0005).
import type { PaletteName } from "@japacity/assets";
import type { PatternSpec } from "@japacity/assets/pattern";

export interface PersonBone {
  name: string;
  /** The parent's index in `bones`, or -1 for the root. */
  parent: number;
  /** Relative to the parent, in metres, in the bind pose. */
  position: [number, number, number];
}

export interface PersonMesh {
  /** The shipped name without extension, for example `chr_amaka` or `chr_body_plus-set`. */
  name: string;
  /** Three numbers a vertex, metres, facing +z, feet on y = 0. */
  positions: number[];
  /** One palette name a vertex. Vertices of the pattern group carry `white`. */
  colours: PaletteName[];
  /** Two numbers a vertex; the pattern repeats, so values may run past 1. */
  uvs: number[];
  /** Four bone indices a vertex. */
  joints: number[];
  /** Four weights a vertex, summing to 1. */
  weights: number[];
  /** Triangle indices: [0] the flat palette colours, [1] the one fabric pattern (R-ASSET-005 allows two materials). */
  groups: [number[], number[]];
  pattern: PatternSpec | null;
  bones: PersonBone[];
}
