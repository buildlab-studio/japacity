// The shapes the asset tools, the builders and the city share: docs/rules/assets.md, Contract.
import type { PaletteName } from "./palette";

/** A person as data, the design's shape made a type (R-ASSET-014, city.md R-CITY-015). */
export interface CharacterLook {
  body: "f" | "m";
  shape: number;
  bust: number;
  size: number;
  mass: number;
  muscle: number;
  heightCm: number;
  skin: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  hair: string;
  headwear: string | null;
  top: string;
  bottom: string;
  robe: string | null;
  patternSeeds: number[];
  faceSeed: string;
}

/** An ordinary building as data for the kit (R-ASSET-016 to 018); `signs` are text keys. */
export interface BuildingSpec {
  footprint: [number, number];
  storeys: 1 | 2 | 3 | 4;
  roof: "hip" | "gable" | "flat";
  wall: PaletteName;
  wear: 0 | 1 | 2 | 3;
  balconies: number;
  stairs: "none" | "front" | "side";
  gate: boolean;
  clutterSeed: number;
  signs: string[];
}

/** One row of the register (R-ASSET-009). */
export interface RegisterRow {
  file: string;
  place: string;
  source: "code" | "pack" | "ai-tool" | "artist";
  author: string;
  licence: string;
  attribution: string | null;
  aiTool: string | null;
  date: string;
  modified: boolean;
  triangles: number;
  drawCalls: number;
  materials: number;
  bytes: number;
  paletteCheck: { passed: boolean; date: string } | null;
  reference: { url: string; date: string }[];
  outline: { file: string; scores: Record<string, number> } | null;
  review: Review | null;
  nameCheck: { searches: string[]; date: string; result: string } | null;
  status: "draft" | "accepted" | "rejected";
}

/** A reviewer's sheet for one asset (R-ASSET-021, 022). */
export interface Review {
  reviewer: string;
  date: string;
  scores: Record<"phone" | "silhouette" | "proportion" | "palette" | "wear" | "variety" | "budget", number>;
  mean: number;
  outline?: Record<string, number>;
  notes: string;
}

/** A reference outline traced as data, in metres (R-ASSET-011, 023, 024). */
export interface Outline {
  view: "front" | "side" | "plan";
  polygon: [number, number][];
  source: string;
  read: string;
  scaleFrom: string;
}
