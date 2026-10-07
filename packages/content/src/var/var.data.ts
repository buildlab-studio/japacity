// From docs/rules/rate.md, "Variables", and for life abroad from place.md,
// status.md and ladders.md.
import type { Id, VarEntry } from "@japacity/sim";

import { cad, pounds } from "../units";

export const varTable: Record<Id<"var">, VarEntry> = {
  "var.fx-supply": { id: "var.fx-supply", start: 97 },
  "var.fx-bank-queue": { id: "var.fx-bank-queue", start: 0 },
  // US cents.
  "var.fx-bank-allowance": { id: "var.fx-bank-allowance", start: 50000 },
  // 2 open, 1 narrowing, 0 closed.
  "var.uk-study-window": { id: "var.uk-study-window", start: 2 },
  // Pence a month.
  "var.uk-living-line": { id: "var.uk-living-line", start: 117100 },
  "var.uk-living-months": { id: "var.uk-living-months", start: 9 },
  // Pence.
  "var.uk-visa-fee": { id: "var.uk-visa-fee", start: 55800 },
  "var.uk-surcharge": { id: "var.uk-surcharge", start: 116400 },
  "var.uk-study-strictness": { id: "var.uk-study-strictness", start: 50 },

  // Life abroad.

  // 1 in the one tick a game year the director makes December (place.md), else 0.
  "var.season-december": { id: "var.season-december", start: 0 },
  // status.md "Numbers". Months; the shortening story sets 18.
  "var.uk-graduate-months": { id: "var.uk-graduate-months", start: 24 },
  "var.uk-settle-months": { id: "var.uk-settle-months", start: 60 },
  "var.uk-talent-settle-months": { id: "var.uk-talent-settle-months", start: 36 },
  // Fees in force from 8 Apr 2026, in pence.
  "var.uk-settle-fee": { id: "var.uk-settle-fee", start: pounds(3226) },
  "var.uk-citizen-fee": { id: "var.uk-citizen-fee", start: pounds(1709) },
  "var.uk-skilled-renew-fee": { id: "var.uk-skilled-renew-fee", start: pounds(1865) },
  // The health surcharge for workers, a year.
  "var.uk-surcharge-year": { id: "var.uk-surcharge-year", start: pounds(1035) },
  // 1,095 days in five years, read as 36 lawful months.
  "var.ca-settle-months": { id: "var.ca-settle-months", start: 36 },
  // Canadian cents.
  "var.ca-citizen-fee": { id: "var.ca-citizen-fee", start: cad(630) },
};
