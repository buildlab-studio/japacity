// The content ids the simulation's logic reads in more than one file, by kind.
// An id one file alone reads stays beside its rule there.
import type { Id } from "./types";

export const QUALITY = {
  age: "quality.age-months",
  standing: "quality.standing",
  wellbeing: "quality.wellbeing",
  network: "quality.network",
  eduGrade: "quality.education-grade",
  eduLevel: "quality.education-level",
  familyMeans: "quality.family-means",
  portfolio: "quality.portfolio",
} as const satisfies Record<string, Id<"quality">>;

export const VAR = {
  seasonDecember: "var.season-december",
  /** status:uae-amnesty: 1 while the amnesty holds. */
  uaeAmnesty: "var.uae-amnesty",
  ukSurchargeYear: "var.uk-surcharge-year",
} as const satisfies Record<string, Id<"var">>;

export const SETPIECE = {
  december: "setpiece.december",
} as const satisfies Record<string, Id<"setpiece">>;

export const STATUS = {
  /** road:sea-arrival-in-italy: the status the road's far shore gives. */
  euIrregular: "status.eu-irregular",
  /** status:uae-fine-accrues, status:uae-amnesty: the UAE's overstayer status. */
  uaeIrregular: "status.uae-irregular",
} as const satisfies Record<string, Id<"status">>;

export const COUNTRY = {
  /** status:overstayer-hospital-charged: the hospital's charge is the UK's. */
  uk: "country.uk",
} as const satisfies Record<string, Id<"country">>;

export const DOCUMENT = {
  homeLicence: "document.home-licence",
  ukLicence: "document.uk-licence",
} as const satisfies Record<string, Id<"document">>;
