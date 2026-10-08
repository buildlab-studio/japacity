// From docs/rules/status.md "Entries" and "Numbers".
//
// Conventions the page leaves open:
// - `detectBp` and `overstayBanMonths` are only read on an overstayer
//   (R-STATUS-005, R-STATUS-008). Every status of a country carries the country's
//   figures, as the student status first entered here does, so a status that
//   lapses keeps the same numbers it had.
// - a settled or citizen status is never removed, so the page leaves its
//   ban cells empty; they are 0 here, and its detection chance is 0.
// - `countsFromBefore` is true where a status follows another in the same
//   country (a new sponsor, settlement, citizenship), false where it starts a stay.
import type { Id, StatusEntry } from "@japacity/sim";

type Shared = Omit<StatusEntry, "id" | "country" | "months" | "work" | "banMonths" | "overstayBanMonths" | "detectBp">;
type ByCountry = Pick<StatusEntry, "country" | "banMonths" | "overstayBanMonths" | "detectBp">;

/** The fields every status starts from: nothing renews, nothing settles, nothing follows. */
const BASE: Shared = {
  clockMonths: null,
  dependants: "none",
  tiedTo: null,
  lapsesAtOnce: false,
  renewMonths: 0,
  renewFeeVar: null,
  surchargeYearVar: null,
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
  holdsPassport: false,
};

/** UK removal ban 10 years; 12 months for leaving by choice after an overstay; 3% a month detection. */
const UK: ByCountry = { country: "country.uk", banMonths: 120, overstayBanMonths: 12, detectBp: 300 };
/** Removal from Canada modelled as 20 years; 3% a month detection. The page gives no ban for leaving by choice. */
const CANADA: ByCountry = { country: "country.canada", banMonths: 240, overstayBanMonths: 0, detectBp: 300 };
/** The UAE: 5 years; 6% a month detection. */
const UAE: ByCountry = { country: "country.uae", banMonths: 60, overstayBanMonths: 0, detectBp: 600 };
/** Italy: 10 years; 4% a month detection. */
const ITALY: ByCountry = { country: "country.italy", banMonths: 120, overstayBanMonths: 0, detectBp: 400 };

/** Settled and citizen statuses: never removed, never detected. */
const KEPT: Omit<ByCountry, "country"> = { banMonths: 0, overstayBanMonths: 0, detectBp: 0 };

const wholeLifeStatuses: Record<Id<"status">, StatusEntry> = {
  // The United Kingdom

  "status.uk-student": {
    ...BASE,
    ...UK,
    id: "status.uk-student",
    // A one-year course plus four months.
    months: 16,
    work: "part",
    next: "status.uk-graduate",
    // R-STATUS-011: the course is passed after 12 months held with the tuition never in
    // default. A default lapses the status at once (obligation.tuition), and the status
    // runs 16 months, so a student still holding it at expiry has passed. What is left
    // to check is that the graduate route is open.
    nextIf: [{ type: "var/min", var: "var.uk-graduate-months", value: 1 }],
  },
  "status.uk-graduate": {
    ...BASE,
    ...UK,
    id: "status.uk-graduate",
    // 24 months until the shortening story comes into force, then 18.
    months: "var.uk-graduate-months",
    work: "any",
  },
  "status.uk-sponsored": {
    ...BASE,
    ...UK,
    id: "status.uk-sponsored",
    months: 36,
    work: "one-employer",
    // 60 days.
    clockMonths: 2,
    // docs/rules/people.md R-PEOPLE-020: a partner may join a holder of one of these jobs.
    dependants: ["activity.job-uk-skilled", "activity.job-uk-senior-dev", "activity.job-uk-graduate", "activity.job-uk-nurse"],
    tiedTo: null,
    renewMonths: 24,
    renewFeeVar: "var.uk-skilled-renew-fee",
    surchargeYearVar: "var.uk-surcharge-year",
    countsToSettlement: true,
    countsFromBefore: true,
    settleMonthsVar: "var.uk-settle-months",
    settleFeeVar: "var.uk-settle-fee",
    settled: "status.uk-settled",
  },
  "status.uk-talent": {
    ...BASE,
    ...UK,
    id: "status.uk-talent",
    months: 60,
    work: "any",
    // R-PEOPLE-020.
    dependants: "any",
    countsToSettlement: true,
    settleMonthsVar: "var.uk-talent-settle-months",
    settleFeeVar: "var.uk-settle-fee",
    settled: "status.uk-settled",
  },
  "status.uk-settled": {
    ...BASE,
    ...KEPT,
    id: "status.uk-settled",
    country: "country.uk",
    months: null,
    work: "any",
    countsFromBefore: true,
    citizenAfter: 12,
    citizenFeeVar: "var.uk-citizen-fee",
    citizen: "status.uk-citizen",
  },
  "status.uk-citizen": {
    ...BASE,
    ...KEPT,
    id: "status.uk-citizen",
    country: "country.uk",
    months: null,
    work: "any",
    countsFromBefore: true,
  },
  "status.uk-overstayer": {
    ...BASE,
    ...UK,
    id: "status.uk-overstayer",
    months: null,
    work: "cash",
  },

  // Canada

  "status.ca-resident": {
    ...BASE,
    ...CANADA,
    id: "status.ca-resident",
    // Permanent residence.
    months: null,
    work: "any",
    countsToSettlement: true,
    // R-STATUS-007 names var.ca-settle-months as Canada's settlement months, and
    // the page's next step from residence is citizenship, so the settlement step of the
    // contract carries Canadian citizenship and its fee. The citizen step stays empty.
    settleMonthsVar: "var.ca-settle-months",
    settleFeeVar: "var.ca-citizen-fee",
    settled: "status.ca-citizen",
  },
  "status.ca-citizen": {
    ...BASE,
    ...KEPT,
    id: "status.ca-citizen",
    country: "country.canada",
    months: null,
    work: "any",
    countsFromBefore: true,
  },
  "status.ca-overstayer": {
    ...BASE,
    ...CANADA,
    id: "status.ca-overstayer",
    months: null,
    work: "cash",
  },

  // The United Arab Emirates

  "status.gulf-worker": {
    ...BASE,
    ...UAE,
    id: "status.gulf-worker",
    months: 24,
    work: "one-employer",
    // Leaving the employer lapses it at once, to uae-irregular (R-STATUS-009).
    lapsesAtOnce: true,
    // renewal is the employer's choice and the employer pays, so there is no
    // fee var; the draw the page names has no field (reported).
    renewMonths: 24,
    holdsPassport: true,
  },
  "status.uae-irregular": {
    ...BASE,
    ...UAE,
    id: "status.uae-irregular",
    months: null,
    work: "cash",
  },

  // Italy, where the road ends

  "status.eu-irregular": {
    ...BASE,
    ...ITALY,
    id: "status.eu-irregular",
    months: null,
    work: "cash",
  },
};

// docs/rules/people.md "Entries: routes and statuses", R-PEOPLE-024, 028, 029.
const peopleStatuses: Record<Id<"status">, StatusEntry> = {
  "status.uk-partner": {
    ...BASE,
    ...UK,
    id: "status.uk-partner",
    months: 33,
    work: "any",
    // The 60 days permission is cut to after a relationship breaks down.
    tiedTo: "partner",
    clockMonths: 2,
    renewMonths: 30,
    renewFeeVar: "var.uk-partner-renew-fee",
    surchargeYearVar: "var.uk-surcharge-year",
    countsToSettlement: true,
    settleMonthsVar: "var.uk-partner-settle-months",
    settleFeeVar: "var.uk-settle-fee",
    settled: "status.uk-settled",
  },
  "status.uk-dependant": {
    ...BASE,
    ...UK,
    id: "status.uk-dependant",
    // The lead's months left at the grant (R-PEOPLE-024).
    months: "lead",
    work: "any",
    tiedTo: "partner",
    clockMonths: 2,
    // "renews with the lead" has no command of its own, so it does not renew by asking.
    countsToSettlement: true,
    settleMonthsVar: "var.uk-settle-months",
    settleFeeVar: "var.uk-settle-fee",
    settled: "status.uk-settled",
  },
};

export const statusTable: Record<Id<"status">, StatusEntry> = { ...wholeLifeStatuses, ...peopleStatuses };
