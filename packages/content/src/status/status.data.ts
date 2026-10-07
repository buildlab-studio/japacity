// From docs/rules/status.md "Entries". Only the student status the UK master's route
// grants is here; the whole-life content work adds the rest.
import type { Id, StatusEntry } from "@japacity/sim";

export const statusTable: Record<Id<"status">, StatusEntry> = {
  "status.uk-student": {
    id: "status.uk-student",
    country: "country.uk",
    // A one-year course plus four months.
    months: 16,
    work: "part",
    clockMonths: null,
    lapsesAtOnce: false,
    renewMonths: 0,
    renewFeeVar: null,
    surchargeYearVar: null,
    // The graduate status arrives with the whole-life content.
    next: null,
    nextIf: [],
    countsToSettlement: false,
    countsFromBefore: false,
    settleMonthsVar: null,
    settleFeeVar: null,
    settled: null,
    citizenAfter: null,
    citizenFeeVar: null,
    citizen: null,
    banMonths: 120,
    overstayBanMonths: 12,
    detectBp: 300,
    holdsPassport: false,
  },
};
