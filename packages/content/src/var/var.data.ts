// From docs/rules/rate.md, "Variables", and for life abroad from place.md,
// status.md and ladders.md.
// From docs/rules/rate.md "Variables", route-gates.md "Numbers" and the entry
// tables, and director.md "Variables introduced here".
import type { Id, VarEntry } from "@japacity/sim";

import { cad, pounds } from "../units";

export const varTable: Record<Id<"var">, VarEntry> = {
  // rate.md

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
  // route-gates.md: windows. The care route is closed to applicants abroad (22 Jul 2025).

  "var.uk-care-window": { id: "var.uk-care-window", start: 0 },
  "var.uk-skilled-window": { id: "var.uk-skilled-window", start: 2 },
  "var.uk-talent-window": { id: "var.uk-talent-window", start: 2 },
  "var.ca-window": { id: "var.ca-window", start: 2 },
  "var.uae-window": { id: "var.uae-window", start: 2 },

  // route-gates.md: the sponsor routes, in pence. Salaries are a year.

  "var.uk-care-salary": { id: "var.uk-care-salary", start: 2500000 },
  "var.uk-skilled-salary": { id: "var.uk-skilled-salary", start: 4170000 },
  "var.uk-care-visa-fee": { id: "var.uk-care-visa-fee", start: 32400 },
  "var.uk-skilled-visa-fee": { id: "var.uk-skilled-visa-fee", start: 81900 },
  // Held 28 days, so one month end.
  "var.uk-skilled-maintenance": { id: "var.uk-skilled-maintenance", start: 127000 },

  // route-gates.md: the points route, in Canadian cents.

  "var.ca-funds": { id: "var.ca-funds", start: 1526300 },
  "var.ca-eca-fee": { id: "var.ca-eca-fee", start: 32900 },
  "var.ca-apply-fee": { id: "var.ca-apply-fee", start: 152500 },
  // Working values, not the real draws: a bachelor's, band 7.0, a year of work and under thirty (404) is one short, and
  // three years of work (429) clears it after the general pause too (+20, news.ca-general-stops); a diploma, band 6.0
  // and no work (289) never reaches either. The care cut-off sits below by the share of the real ones, 475 of 520.
  "var.ca-cutoff": { id: "var.ca-cutoff", start: 405 },
  "var.ca-care-cutoff": { id: "var.ca-care-cutoff", start: 370 },
  "var.ca-decision-months": { id: "var.ca-decision-months", start: 6 },

  // route-gates.md: the endorsement route, in pence.

  "var.uk-talent-endorse-fee": { id: "var.uk-talent-endorse-fee", start: 56100 },
  "var.uk-talent-visa-fee": { id: "var.uk-talent-visa-fee", start: 20500 },

  // director.md: surges, 0 to 100. They rise while a window is open (director:policy-cycle-surge-backlash).

  "var.uk-study-surge": { id: "var.uk-study-surge", start: 20 },
  "var.uk-care-surge": { id: "var.uk-care-surge", start: 0 },
  "var.uk-skilled-surge": { id: "var.uk-skilled-surge", start: 10 },
  "var.uk-talent-surge": { id: "var.uk-talent-surge", start: 0 },
  "var.ca-surge": { id: "var.ca-surge", start: 30 },
  "var.uae-surge": { id: "var.uae-surge", start: 0 },

  // director.md: strictness, 0 to 100.

  "var.uk-care-strictness": { id: "var.uk-care-strictness", start: 50 },
  "var.uk-skilled-strictness": { id: "var.uk-skilled-strictness", start: 40 },
  "var.ca-strictness": { id: "var.ca-strictness", start: 50 },

  // director.md: home and the world.

  // Basis points added to every upkeep and support charge at home (director:december-and-inflation).
  "var.inflation": { id: "var.inflation", start: 0 },
  // A chance a month, in basis points, that a care job tied to its sponsor ends.
  "var.uk-care-sponsor-risk": { id: "var.uk-care-sponsor-risk", start: 300 },
  // Kobo: ₦100,000.
  "var.passport-fee": { id: "var.passport-fee", start: 10000000 },
  // Months added to the transcript's wait.
  "var.transcript-wait-extra": { id: "var.transcript-wait-extra", start: 0 },
  // Basis points: the fare is multiplied by this over 10000.
  "var.flight-factor": { id: "var.flight-factor", start: 10000 },
  // Basis points added to the remote job's hire chance.
  "var.remote-hire-bonus": { id: "var.remote-hire-bonus", start: 0 },
  // person.md and undertaking.md: the partner and dependant routes' figures
  "var.uk-dependant-maintenance": { id: "var.uk-dependant-maintenance", start: 28500 },
  "var.uk-partner-fee": { id: "var.uk-partner-fee", start: 206400 },
  "var.uk-partner-renew-fee": { id: "var.uk-partner-renew-fee", start: 140700 },
  "var.uk-partner-settle-months": { id: "var.uk-partner-settle-months", start: 60 },
  "var.uk-family-window": { id: "var.uk-family-window", start: 2 },
  "var.uk-partner-income": { id: "var.uk-partner-income", start: 2900000 },
  "var.ca-sponsor-fee": { id: "var.ca-sponsor-fee", start: 134500 },
  "var.ca-accompany-fee": { id: "var.ca-accompany-fee", start: 160000 },
  "var.ca-family-window": { id: "var.ca-family-window", start: 2 },
  "var.ca-assistance": { id: "var.ca-assistance", start: 73300 },
  // director:world-variables-per-route and director:policy-cycle-surge-backlash: every window has its surge; the family routes' start at 0.
  "var.uk-family-surge": { id: "var.uk-family-surge", start: 0 },
  "var.ca-family-surge": { id: "var.ca-family-surge", start: 0 },
};
