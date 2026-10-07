// From docs/rules/rate.md "Variables", route-gates.md "Numbers" and the entry
// tables, and director.md "Variables introduced here".
import type { Id, VarEntry } from "@japacity/sim";

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
  // The health surcharge for a worker, a year.
  "var.uk-surcharge-year": { id: "var.uk-surcharge-year", start: 103500 },
  // Held 28 days, so one month end.
  "var.uk-skilled-maintenance": { id: "var.uk-skilled-maintenance", start: 127000 },

  // route-gates.md: the points route, in Canadian cents.

  "var.ca-funds": { id: "var.ca-funds", start: 1526300 },
  "var.ca-eca-fee": { id: "var.ca-eca-fee", start: 32900 },
  "var.ca-apply-fee": { id: "var.ca-apply-fee", start: 152500 },
  "var.ca-cutoff": { id: "var.ca-cutoff", start: 520 },
  "var.ca-care-cutoff": { id: "var.ca-care-cutoff", start: 475 },
  "var.ca-decision-months": { id: "var.ca-decision-months", start: 6 },

  // route-gates.md: the endorsement route, in pence.

  "var.uk-talent-endorse-fee": { id: "var.uk-talent-endorse-fee", start: 56100 },
  "var.uk-talent-visa-fee": { id: "var.uk-talent-visa-fee", start: 20500 },

  // director.md: surges, 0 to 100. They rise while a window is open (R-DIRECTOR-005).

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

  // Basis points added to every upkeep and support charge at home (R-DIRECTOR-006).
  "var.inflation": { id: "var.inflation", start: 0 },
  // 1 in the December tick, else 0.
  "var.season-december": { id: "var.season-december", start: 0 },
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
};
