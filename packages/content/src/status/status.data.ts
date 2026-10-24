// From docs/rules/status.md "Entries" and "Numbers".
//
// Conventions the page leaves open:
// - `detectBp` is only read on an overstayer
//   (status:overstayer-risks-detection). Every status of a country carries the country's
//   figures, as the student status does, so a status that lapses keeps the same
//   numbers it had.
// - A settled or citizen status is never removed, so the page leaves its
//   ban cells empty; they are 0 here, and its detection chance is 0.
// - `countsFromBefore` is true where a status follows another in the same
//   country (a new sponsor, settlement, citizenship), false where it starts a stay.
import type { Id, StatusEntry } from "@japacity/sim";

import { aed, pounds } from "../units";

type Shared = Omit<StatusEntry, "id" | "country" | "months" | "work" | "banMonths" | "detectBp">;
type ByCountry = Pick<StatusEntry, "country" | "banMonths" | "detectBp">;

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

/** UK removal ban 10 years; 1% a month detection. */
const UK: ByCountry = { country: "country.uk", banMonths: 120, detectBp: 100 };
/** Removal from Canada 10 years, then the authorisation to return (route-gates:canada-return-asks-authorisation); 1% a month detection. */
const CANADA: ByCountry = { country: "country.canada", banMonths: 120, detectBp: 100 };
/** The UAE: 5 years; 2% a month detection. */
const UAE: ByCountry = { country: "country.uae", banMonths: 60, detectBp: 200 };
/** Italy: 3 years, the real minimum; 1% a month detection. */
const ITALY: ByCountry = { country: "country.italy", banMonths: 36, detectBp: 100 };

/** Settled and citizen statuses: never removed, never detected. */
const KEPT: Omit<ByCountry, "country"> = { banMonths: 0, detectBp: 0 };

const wholeLifeStatuses: Record<Id<"status">, StatusEntry> = {
  // The United Kingdom

  "status.uk-student": {
    ...BASE,
    ...UK,
    id: "status.uk-student",
    // A one-year course plus four months.
    months: 16,
    work: "part",
    // status:expiry-lapses-or-moves-on: the student becomes a graduate only by applying and paying (status:graduate-visa-applied-for), so no
    // status follows by the clock. status:status-sets-work-rule: full-time pay in the Christmas and Easter vacations of a September start, course
    // months 4 and 8, and any job from course month 13, once the course has ended (Student Sponsor Guidance Doc 2, paras 4.46 and 6.3).
    // status:graduate-visa-applied-for: the view carries the application's cost from course month 9.
    course: { vacations: [4, 8], anyFrom: 13, graduate: "status.uk-graduate", feeVar: "var.uk-graduate-fee", surchargeYearVar: "var.uk-surcharge-year", costFrom: 9 },
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
    // person:statuses-name-dependants: a partner may join a holder of one of these jobs.
    dependants: ["activity.job-uk-skilled", "activity.job-uk-senior-developer", "activity.job-uk-graduate", "activity.job-uk-nurse"],
    tiedTo: null,
    renewMonths: 24,
    renewFeeVar: "var.uk-skilled-renew-fee",
    surchargeYearVar: "var.uk-surcharge-year",
    // status:renewing-a-status: a care, senior care or nurse job renews at the Health and Care fee, £324 up to three years, with no surcharge.
    renewByJob: { jobs: ["activity.job-uk-care", "activity.job-uk-senior-care", "activity.job-uk-nurse"], feeVar: "var.uk-care-visa-fee" },
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
    // person:statuses-name-dependants.
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
    // status.md, "Entries: overstaying, country by country".
    graceMonths: 1,
    noticeMonths: 3,
    ownFareBanMonths: 12,
    assistedBanMonths: 24,
    rentCheckBp: 1500,
    returnGrant: pounds(1500),
  },

  // Canada

  "status.canada-resident": {
    ...BASE,
    ...CANADA,
    id: "status.canada-resident",
    // Permanent residence.
    months: null,
    work: "any",
    countsToSettlement: true,
    // status:lawful-months-reach-settlement names var.canada-settle-months as Canada's settlement months, and
    // the page's next step from residence is citizenship, so the settlement step of the
    // contract carries Canadian citizenship and its fee. The citizen step stays empty.
    settleMonthsVar: "var.canada-settle-months",
    settleFeeVar: "var.canada-citizen-fee",
    settled: "status.canada-citizen",
  },
  "status.canada-citizen": {
    ...BASE,
    ...KEPT,
    id: "status.canada-citizen",
    country: "country.canada",
    months: null,
    work: "any",
    countsFromBefore: true,
  },
  "status.canada-overstayer": {
    ...BASE,
    ...CANADA,
    id: "status.canada-overstayer",
    months: null,
    work: "cash",
    // The 90-day restoration window; the notice is the departure order; leaving at one's own fare is never banned.
    graceMonths: 3,
    noticeMonths: 1,
    ownFareBanMonths: 0,
    assistedBanMonths: 12,
  },

  // The United Arab Emirates

  "status.gulf-worker": {
    ...BASE,
    ...UAE,
    id: "status.gulf-worker",
    months: 24,
    work: "one-employer",
    // Leaving the employer lapses it at once, to uae-irregular (status:gulf-status-holds-passport).
    lapsesAtOnce: true,
    // status:renewing-a-status: the employer renews, and pays, at this chance in the contract's last month.
    renewMonths: 24,
    renewBp: 6000,
    holdsPassport: true,
  },
  "status.uae-irregular": {
    ...BASE,
    ...UAE,
    id: "status.uae-irregular",
    months: null,
    work: "cash",
    // Any return from the overstay brings the one-year labour ban; the fine is AED 50 a day.
    graceMonths: 1,
    noticeMonths: 1,
    ownFareBanMonths: 12,
    assistedBanMonths: 12,
    finePerMonth: aed(1500),
  },

  // Italy, where the road ends

  "status.eu-irregular": {
    ...BASE,
    ...ITALY,
    id: "status.eu-irregular",
    months: null,
    work: "cash",
    // The road arrives with no papers, so there is no grace; the expulsion order gives a month to leave.
    graceMonths: 0,
    noticeMonths: 1,
    ownFareBanMonths: 0,
    assistedBanMonths: 0,
  },
};

// docs/rules/person.md "Entries: routes and statuses", person:dependant-status-ends-with-lead, person:partner-status-renews, person:tied-status-clock-on-breakup.
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
    // The lead's months left at the grant (person:dependant-status-ends-with-lead).
    months: "lead",
    work: "any",
    tiedTo: "partner",
    clockMonths: 2,
    // "Renews with the lead" has no command of its own, so it does not renew by asking.
    countsToSettlement: true,
    settleMonthsVar: "var.uk-settle-months",
    settleFeeVar: "var.uk-settle-fee",
    settled: "status.uk-settled",
  },
};

export const statusTable: Record<Id<"status">, StatusEntry> = { ...wholeLifeStatuses, ...peopleStatuses };
