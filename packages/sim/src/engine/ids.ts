// The content ids the simulation's logic reads in more than one file, by kind.
// An id one file alone reads stays beside its rule there.
import type { Id } from "./types";

export const QUALITY = {
  age: "quality.age-months",
  standing: "quality.standing",
  wellbeing: "quality.wellbeing",
  network: "quality.network",
  eduGrade: "quality.edu-grade",
  eduLevel: "quality.edu-level",
  familyMeans: "quality.family-means",
  portfolio: "quality.portfolio",
} as const satisfies Record<string, Id<"quality">>;

export const VAR = {
  seasonDecember: "var.season-december",
  ukSurchargeYear: "var.uk-surcharge-year",
} as const satisfies Record<string, Id<"var">>;

export const SETPIECE = {
  december: "setpiece.december",
} as const satisfies Record<string, Id<"setpiece">>;

export const STATUS = {
  /** R-ROAD-009: the status the road's far shore gives. */
  euIrregular: "status.eu-irregular",
} as const satisfies Record<string, Id<"status">>;

export const DOCUMENT = {
  homeLicence: "document.home-licence",
  ukLicence: "document.uk-licence",
} as const satisfies Record<string, Id<"document">>;
