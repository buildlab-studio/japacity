// The shapes the asset tools, the builders and the city share: docs/rules/assets.md, Contract.
import type { PaletteName } from "./palette";

/** A person as data (assets:variants-are-numbers-not-code, city:players-fill-the-crowd). */
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

/** An ordinary building as data for the kit (assets:buildings-assembled-from-kit, assets:buildings-carry-wear-and-clutter and assets:neighbours-never-identical); `signs` are text keys. */
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

/**
 * One row of the register (assets:register-matches-every-file). `file` is a path under public/assets for a shipped model or
 * pattern; media made elsewhere (a share card's drawn scene, a link preview) is a
 * path from the repository root, with `#<name>` after it for one piece inside a file of code.
 */
export interface RegisterRow {
  file: string;
  place: string;
  source: "code" | "pack" | "ai-tool" | "artist";
  author: string;
  licence: string;
  attribution: string | null;
  /** Made with a generation tool (assets:ai-media-recorded-and-credited, guide:register-records-generated-assets); a model or picture written as code is the makers' own work and is not. */
  generated: boolean;
  /** The tool and plan it was made with, or null for work made by hand. */
  tool: string | null;
  /** Who approved it to ship; an AI-made row is accepted only once this names someone. */
  approvedBy: string | null;
  date: string;
  modified: boolean;
  triangles: number;
  drawCalls: number;
  materials: number;
  bytes: number;
  paletteCheck: { passed: boolean; date: string } | null;
  reference: { url: string; date: string }[];
  outline: { file: string; scores: Record<string, number> } | null;
  review: Pick<Review, "reviewer" | "date" | "scores" | "mean" | "notes"> | null;
  nameCheck: { searches: string[]; date: string; result: string } | null;
  status: "draft" | "accepted" | "rejected";
}

/** The criteria of the review sheet (assets:blind-reviewer-scores-views). */
export type Criterion = "phone" | "silhouette" | "proportion" | "palette" | "wear" | "variety" | "budget";

/** The earlier review a rework was scored against (assets:rework-never-scores-lower): its file, and its date where the reviewer gave one. */
export interface ReviewAgainst {
  file: string;
  date?: string;
}

/**
 * A reviewer's sheet for one asset (assets:blind-reviewer-scores-views, assets:acceptance-score-thresholds). A sheet scored in rounds is an array of these,
 * the last round the one that counts. `scores` leaves out a criterion that does not apply to a piece
 * (flat art has no proportion), and the sheet says why.
 */
export interface Review {
  reviewer: string;
  date: string;
  scores: Partial<Record<Criterion, number>>;
  mean: number;
  outline?: Record<string, number>;
  notes: string;
  against?: ReviewAgainst | null;
  accepted: boolean;
  failing: string[];
  reasons: Partial<Record<Criterion, string>>;
}

/** One graphics mode's scores on a place's sheet. */
export type ModeReview = Pick<Review, "scores" | "mean" | "accepted" | "failing" | "reasons">;

/** A reviewer's sheet for a whole place, scored in each graphics mode (city:places-meet-party-room-bar). */
export interface PlaceReview {
  piece: string;
  reviewer: string;
  date: string;
  against?: ReviewAgainst | null;
  low: ModeReview;
  high: ModeReview;
  notes: string;
}

/** What a review file under assets-src holds: one asset's sheet, its rounds, or a place's sheet. */
export type ReviewSheet = Review | Review[] | PlaceReview;

/** A reference outline traced as data, in metres (assets:no-reference-photos-kept, assets:landmarks-match-reference-outlines, assets:plan-outline-from-map-data). */
export interface Outline {
  view: "front" | "side" | "plan";
  polygon: [number, number][];
  source: string;
  read: string;
  scaleFrom: string;
}
