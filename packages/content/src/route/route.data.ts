// From docs/rules/route.md, "Entry: route.uk-masters", route-gates.md for the
// sponsor, points, endorsement and contract routes, and road.md for the road.
import type { ActivityEntry, ChecklistItem, Cost, Id, Requirement, RouteEntry } from "@japacity/sim";


const UK: Id<"route"> = "route.uk-masters";
const CARE: Id<"route"> = "route.uk-care";
const SKILLED: Id<"route"> = "route.uk-skilled";
const CANADA: Id<"route"> = "route.canada-points";
const TALENT: Id<"route"> = "route.uk-talent";
const GULF: Id<"route"> = "route.gulf-contract";

const DEGREE: Requirement = { type: "quality/min", quality: "quality.education-level", value: 3 };
/** document:degree-english-statement: the degree's English statement, which always passes. */
const STATEMENT: Requirement = { type: "document/held", document: "document.degree-english" };

/** A checklist item that is met or not, with no part earned on the way. */
function item(id: string, weight: number, requirement: Requirement): ChecklistItem {
  return { id, weight, requirement, partial: false };
}

function held(document: Id<"document">, min?: number): Requirement {
  return min === undefined ? { type: "document/held", document } : { type: "document/held", document, min };
}

function applied(route: Id<"route">): Requirement {
  return { type: "route/state", route, in: ["applying", "granted", "departed"] };
}

// The gate steps a checklist reads are named `sponsor` (a sponsor or
// agent recorded), `salary` (its salary at or above the route's bar), `pool`
// (a live profile) and `invited`. The page names the items, not the steps.
function step(route: Id<"route">, name: string): Requirement {
  return { type: "route/gate-step", route, step: name };
}

const wholeLifeRoutes: Record<Id<"route">, RouteEntry> = {
  "route.uk-masters": {
    id: UK,
    // route-gates:route-runs-its-gate-steps and route-gates:departure-grants-status.
    gate: "study",
    dependants: null,
    country: "country.uk",
    status: "status.uk-student",
    refusalBaseBp: 900,
    flightPaidByEmployer: false,
    hearIf: [{ type: "quality/min", quality: "quality.education-level", value: 3 }],
    hearBy: 3,
    window: "var.uk-study-window",
    checklist: [
      {
        id: "degree",
        weight: 6,
        requirement: { type: "quality/min", quality: "quality.education-level", value: 3 },
        partial: false,
      },
      {
        id: "grade",
        weight: 4,
        requirement: { type: "quality/min", quality: "quality.education-grade", value: 3 },
        partial: false,
      },
      { id: "passport", weight: 4, requirement: { type: "document/held", document: "document.passport" }, partial: false },
      {
        id: "transcript",
        weight: 3,
        requirement: { type: "document/held", document: "document.transcript" },
        partial: false,
      },
      // route:degree-meets-masters-english: the degree is the master's English.
      { id: "english", weight: 12, requirement: DEGREE, partial: false },
      { id: "offer", weight: 12, requirement: { type: "route/offer", route: UK }, partial: false },
      { id: "deposit", weight: 12, requirement: { type: "route/deposit", route: UK }, partial: false },
      { id: "funds", weight: 28, requirement: { type: "route/funds", route: UK, heldMonths: 0 }, partial: true },
      { id: "held", weight: 8, requirement: { type: "route/funds", route: UK, heldMonths: 1 }, partial: false },
      { id: "tb", weight: 4, requirement: { type: "document/held", document: "document.tb-certificate" }, partial: false },
      {
        id: "applied",
        weight: 7,
        requirement: { type: "route/state", route: UK, in: ["applying", "granted", "departed"] },
        partial: false,
      },
    ],
    schools: ["school.northgate", "school.ashby", "school.kingsmere"],
    interview: "setpiece.credibility-interview",
  },

  // route-gates.md, "Entries: sponsor routes".

  "route.uk-care": {
    id: CARE,
    gate: "sponsor",
    dependants: null,
    country: "country.uk",
    status: "status.uk-sponsored",
    refusalBaseBp: 500,
    flightPaidByEmployer: false,
    hearIf: [{ type: "quality/min", quality: "quality.care", value: 30 }],
    hearBy: 4,
    // Starts at 0: closed to applicants abroad until the director opens it (route-gates:care-route-needs-verification).
    window: "var.uk-care-window",
    checklist: [
      item("licence", 10, held("document.nursing-licence")),
      item("verification", 14, held("document.nmcn-verification")),
      // The clinic's certification (route-gates:care-route-needs-verification): the checklist's smallest weight,
      // taken out of the application's, as the police certificate's is.
      item("certificate", 5, held("document.nurse-certificate")),
      item("passport", 6, held("document.passport")),
      // route-gates:sponsor-application-needs: the degree's statement, or band 5.5, B2, held as the band times ten.
      item("english", 10, { type: "any", of: [STATEMENT, held("document.english-test", 55)] }),
      item("sponsor", 25, step(CARE, "sponsor")),
      item("tb", 5, held("document.tb-certificate")),
      // document:police-certificate-for-routes: the police certificate; its weight comes out of the application's.
      item("police", 5, held("document.police-certificate")),
      item("salary", 10, step(CARE, "salary")),
      item("applied", 10, applied(CARE)),
    ],
    schools: [],
    interview: null,
    sponsor: {
      salaryVar: "var.uk-care-salary",
      maintenanceVar: null,
      // The page names `sponsorFindBp` but gives no figure. 10%, the care home offer's 8% a month and a little more for looking.
      findBp: 1000,
      bandMin: 55,
      documents: ["document.nursing-licence", "document.nmcn-verification"],
      strictnessVar: "var.uk-care-strictness",
      // The care route is exempt from the surcharge.
      surchargeYears: 0,
      job: "activity.job-uk-care",
      // route-gates:nurses-sponsored-while-care-shut: the closure of 22 Jul 2025 was to care workers; a trust still sponsors a registered nurse.
      openWhileShut: ["trust"],
    },
  },
  "route.uk-skilled": {
    id: SKILLED,
    gate: "sponsor",
    // person:routes-name-dependant-routes.
    dependants: "route.uk-dependant",
    country: "country.uk",
    status: "status.uk-sponsored",
    refusalBaseBp: 500,
    flightPaidByEmployer: false,
    // A bachelor's and 24 months across every job (route-gates:skilled-route-needs-degree).
    hearIf: [DEGREE, { type: "activity/tenure", activities: [], months: 24 }],
    hearBy: 6,
    window: "var.uk-skilled-window",
    checklist: [
      item("degree", 8, DEGREE),
      item("passport", 6, held("document.passport")),
      item("english", 10, { type: "any", of: [STATEMENT, held("document.english-test", 55)] }),
      item("sponsor", 30, step(SKILLED, "sponsor")),
      item("salary", 10, step(SKILLED, "salary")),
      { id: "funds", weight: 10, requirement: { type: "route/funds", route: SKILLED, heldMonths: 0 }, partial: true },
      item("tb", 6, held("document.tb-certificate")),
      // document:police-certificate-for-routes: the police certificate; its weight comes out of the application's.
      item("police", 5, held("document.police-certificate")),
      item("applied", 15, applied(SKILLED)),
    ],
    schools: [],
    interview: null,
    sponsor: {
      salaryVar: "var.uk-skilled-salary",
      maintenanceVar: "var.uk-skilled-maintenance",
      // The page gives no figure. 6%, between the tech firm's 4% and the agency's 6% a month, rounded up.
      findBp: 600,
      bandMin: 55,
      // The degree is a quality, so no document is named.
      documents: [],
      strictnessVar: "var.uk-skilled-strictness",
      // Three years of status (route-gates:sponsor-application-needs).
      surchargeYears: 3,
      job: "activity.job-uk-skilled",
      openWhileShut: [],
    },
  },

  // route-gates.md, "Entry: route.canada-points".

  "route.canada-points": {
    id: CANADA,
    gate: "points",
    dependants: "route.canada-accompany",
    country: "country.canada",
    status: "status.canada-resident",
    refusalBaseBp: 1000,
    flightPaidByEmployer: false,
    hearIf: [DEGREE],
    hearBy: 5,
    window: "var.canada-window",
    checklist: [
      item("degree", 8, DEGREE),
      item("eca", 10, held("document.eca")),
      // Band 6.0 is CLB 7.
      item("english", 12, held("document.english-test", 60)),
      { id: "funds", weight: 20, requirement: { type: "route/funds", route: CANADA, heldMonths: 0 }, partial: true },
      item("pool", 15, step(CANADA, "pool")),
      item("invited", 20, step(CANADA, "invited")),
      // document:police-certificate-for-routes: the police certificate; its weight comes out of the application's.
      item("police", 5, held("document.police-certificate")),
      item("applied", 10, applied(CANADA)),
    ],
    schools: [],
    interview: null,
    points: {
      table: "points.canada",
      spouseTable: "points.canada-spouse",
      fundsVar: "var.canada-funds",
      cutoffVar: "var.canada-cutoff",
      careCutoffVar: "var.canada-care-cutoff",
      // route-gates:pool-draws-invite: the education cut-off stands only while the director's education draw is in force.
      educationCutoffVar: "var.canada-education-cutoff",
      feeVar: "var.canada-apply-fee",
      decisionVar: "var.canada-decision-months",
      // A profile lasts 12 months (route-gates:entering-the-pool and route-gates:profile-lapses-and-score-ages).
      profileMonths: 12,
    },
  },

  // route-gates.md, "Entry: route.uk-talent".

  "route.uk-talent": {
    id: TALENT,
    gate: "endorsement",
    dependants: "route.uk-dependant",
    country: "country.uk",
    status: "status.uk-talent",
    refusalBaseBp: 300,
    flightPaidByEmployer: false,
    hearIf: [
      { type: "quality/min", quality: "quality.tech", value: 60 },
      { type: "quality/min", quality: "quality.portfolio", value: 2 },
    ],
    // Never by itself: through a meetup and the news of the reappointment.
    hearBy: null,
    window: "var.uk-talent-window",
    checklist: [
      // The figures route-gates:applying-for-endorsement asks for.
      item("tech", 15, { type: "quality/min", quality: "quality.tech", value: 75 }),
      item("portfolio", 20, { type: "quality/min", quality: "quality.portfolio", value: 3 }),
      item("network", 10, { type: "quality/min", quality: "quality.network", value: 50 }),
      item("passport", 5, held("document.passport")),
      item("endorsement", 30, held("document.endorsement")),
      item("tb", 5, held("document.tb-certificate")),
      item("applied", 15, applied(TALENT)),
    ],
    schools: [],
    interview: null,
    endorsement: {
      document: "document.endorsement",
      baseBp: 2500,
      perPortfolioBp: 700,
      perNetworkBp: 10,
      capBp: 8500,
      // Months apply-endorsement is not legal after a refused endorsement (route-gates:endorsement-decided-by-draw).
      cooldown: 6,
      feeVar: "var.uk-talent-endorse-fee",
      // Five years of status (route-gates:talent-visa-needs-endorsement).
      surchargeYears: 5,
    },
  },

  // route-gates.md, "The contract gate".

  "route.gulf-contract": {
    id: GULF,
    gate: "contract",
    dependants: null,
    country: "country.uae",
    status: "status.gulf-worker",
    refusalBaseBp: 1000,
    // The employer pays the flight (route-gates:employer-flies-and-holds-passport).
    flightPaidByEmployer: true,
    // Secondary school.
    hearIf: [{ type: "quality/min", quality: "quality.education-level", value: 1 }],
    // Never by itself: at the motor park and through the agent.
    hearBy: null,
    window: "var.uae-window",
    checklist: [
      item("passport", 20, held("document.passport")),
      item("medical", 15, held("document.medical")),
      item("agent", 35, step(GULF, "sponsor")),
      // document:police-certificate-for-routes: the police certificate; its weight comes out of the application's.
      item("police", 5, held("document.police-certificate")),
      item("applied", 25, applied(GULF)),
    ],
    schools: [],
    interview: null,
    // Under 45 years (route-gates:gulf-application-needs).
    contract: { medical: "document.medical", maxAgeMonths: 540 },
  },

  // road.md. No checklist, no window, no figure, never in the routes view (road:road-route-has-no-figure).

  "route.road": {
    id: "route.road",
    gate: "road",
    dependants: null,
    country: null,
    status: null,
    // The road has no decision draw, so no refusal base.
    refusalBaseBp: 0,
    flightPaidByEmployer: false,
    // Nothing on the profile locks the pitches (road:pitch-reaches-anyone-at-home).
    hearIf: [],
    hearBy: null,
    window: null,
    checklist: [],
    schools: [],
    interview: null,
    road: {
      // "Outcome tables (basis points)". A real-ish connection halves `held` in the road kind.
      steps: [
        // Tuned to road.md's reading: with `held` drawn again, about 23 in 100 arrive and about 2 in 100 are lost.
        { id: "desert", months: [2, 4], on: 6000, held: 1500, turned: 2450, lost: 50 },
        { id: "compound", months: [0, 6], on: 4500, held: 4000, turned: 1450, lost: 50 },
        { id: "coast", months: [1, 3], on: 5500, held: 2500, turned: 1950, lost: 50 },
        { id: "sea", months: [1, 1], on: 6000, held: 0, turned: 3850, lost: 150 },
      ],
    },
  },
};

// docs/rules/person.md "Entries: routes and statuses", person:routes-name-dependant-routes, person:dependant-gate-needs, person:dependant-application-decided, person:dependant-status-ends-with-lead, person:partner-routes-heard-via-bond, person:partner-gate-needs, person:partner-application-decided and person:partner-status-renews,
// and undertaking.md for the floor.

const UK_PARTNER: Id<"route"> = "route.uk-partner";
const CA_SPOUSE: Id<"route"> = "route.canada-spouse";
const UK_DEPENDANT: Id<"route"> = "route.uk-dependant";
const CA_ACCOMPANY: Id<"route"> = "route.canada-accompany";

/** person:partner-routes-heard-via-bond: a partner abroad in the country with a status that may sponsor. */
function partnerAbroad(country: Id<"country">, statuses: Id<"status">[]): Requirement {
  return { type: "people/bond", role: "partner", stages: ["partner", "married"], where: "abroad", country, statuses };
}

const UK_SPONSORS: Id<"status">[] = ["status.uk-settled", "status.uk-citizen"];
const CA_SPONSORS: Id<"status">[] = ["status.canada-resident", "status.canada-citizen"];

const peopleRoutes: Record<Id<"route">, RouteEntry> = {
  "route.uk-partner": {
    id: UK_PARTNER,
    gate: "partner",
    dependants: null,
    country: "country.uk",
    status: "status.uk-partner",
    refusalBaseBp: 500,
    flightPaidByEmployer: false,
    hearIf: [partnerAbroad("country.uk", UK_SPONSORS)],
    // Heard the month the partner's facts show it (person:partner-routes-heard-via-bond).
    hearBy: 0,
    window: "var.uk-family-window",
    checklist: [
      item("married", 20, step(UK_PARTNER, "married")),
      item("sponsor", 20, step(UK_PARTNER, "sponsor")),
      item("floor", 15, step(UK_PARTNER, "floor")),
      // person:partner-gate-needs: a bachelor's degree, the degree's statement, or A1, held as band 3.0.
      item("english", 10, { type: "any", of: [DEGREE, STATEMENT, held("document.english-test", 30)] }),
      item("passport", 5, held("document.passport")),
      item("tb", 5, held("document.tb-certificate")),
      item("applied", 25, applied(UK_PARTNER)),
    ],
    schools: [],
    interview: null,
    partner: {
      sponsorStatuses: UK_SPONSORS,
      bandMin: 30,
      feeVar: "var.uk-partner-fee",
      surchargeYears: 3,
      decisionMonths: 3,
      // Married, or two years together (person:partner-gate-needs).
      livingTogetherMonths: 24,
      floorVar: "var.uk-partner-income",
    },
  },
  "route.canada-spouse": {
    id: CA_SPOUSE,
    gate: "partner",
    dependants: null,
    country: "country.canada",
    status: "status.canada-resident",
    refusalBaseBp: 600,
    flightPaidByEmployer: false,
    hearIf: [partnerAbroad("country.canada", CA_SPONSORS)],
    hearBy: 0,
    window: "var.canada-family-window",
    checklist: [
      item("married", 25, step(CA_SPOUSE, "married")),
      item("sponsor", 25, step(CA_SPOUSE, "sponsor")),
      item("passport", 10, held("document.passport")),
      item("applied", 40, applied(CA_SPOUSE)),
    ],
    schools: [],
    interview: null,
    partner: {
      sponsorStatuses: CA_SPONSORS,
      bandMin: null,
      feeVar: "var.canada-sponsor-fee",
      surchargeYears: 0,
      decisionMonths: 12,
      livingTogetherMonths: null,
      // No floor for a spouse with no dependent children (IRPR s. 133(4)).
      floorVar: null,
    },
  },
  "route.uk-dependant": {
    id: UK_DEPENDANT,
    gate: "dependant",
    dependants: null,
    country: "country.uk",
    status: "status.uk-dependant",
    refusalBaseBp: 300,
    flightPaidByEmployer: false,
    // Known at once when the joint is agreed (person:joint-application-proposed), never heard of alone.
    hearIf: [],
    hearBy: null,
    window: null,
    checklist: [
      item("joint", 30, step(UK_DEPENDANT, "joint")),
      item("lead", 30, step(UK_DEPENDANT, "lead")),
      item("passport", 10, held("document.passport")),
      item("tb", 10, held("document.tb-certificate")),
      { id: "funds", weight: 10, requirement: { type: "route/funds", route: UK_DEPENDANT, heldMonths: 0 }, partial: true },
      item("applied", 10, applied(UK_DEPENDANT)),
    ],
    schools: [],
    interview: null,
    dependant: {
      maintenanceVar: "var.uk-dependant-maintenance",
      // Not asked once the lead has 12 months in the UK.
      leadMonthsExempt: 12,
      feeVar: null,
      // The lead route's visa fee and the surcharge for the lead's years.
      feeFromLead: true,
      decisionMonths: 1,
    },
  },
  "route.canada-accompany": {
    id: CA_ACCOMPANY,
    gate: "dependant",
    dependants: null,
    country: "country.canada",
    status: "status.canada-resident",
    refusalBaseBp: 300,
    flightPaidByEmployer: false,
    hearIf: [],
    hearBy: null,
    window: null,
    checklist: [
      item("joint", 40, step(CA_ACCOMPANY, "joint")),
      item("lead", 40, step(CA_ACCOMPANY, "lead")),
      item("applied", 20, applied(CA_ACCOMPANY)),
    ],
    schools: [],
    interview: null,
    dependant: { maintenanceVar: null, leadMonthsExempt: null, feeVar: "var.canada-accompany-fee", feeFromLead: false, decisionMonths: 1 },
  },
};

/** The health surcharge for one year of a worker's visa, in pounds, as the other gates' activities charge it. */
const SURCHARGE_YEAR: Cost = { currency: "GBP", amount: { var: "var.uk-surcharge-year" }, reason: "fee-surcharge" };

/**
 * person:partner-route-in-country, status:grace-allows-in-country-applications: a family route applied for from home, or from inside its
 * country on the country's overstayer status (a partner at any time, a dependant only in the grace). The act is `where: "any"`
 * so it may stand abroad, and this keeps it to those.
 */
function fromHomeOr(overstayer: Id<"status">, grace: boolean): Requirement {
  const there: Requirement = grace ? { type: "status/is", statuses: [overstayer], grace: true } : { type: "status/is", statuses: [overstayer] };
  return { type: "any", of: [{ type: "place/is", where: "home" }, there] };
}

/** The TB certificate, not asked of an application made in the UK (person:partner-route-in-country). */
const TB_UNLESS_IN_UK: Requirement = { type: "any", of: [held("document.tb-certificate"), { type: "place/is", where: "abroad", country: "country.uk" }] };

function applying(route: Id<"route">, requires: Requirement[], cost: Cost[]): ActivityEntry {
  return {
    id: `activity.apply-${route.slice("route.".length)}` as Id<"activity">,
    slot: "free",
    where: "any",
    requires: [{ type: "route/state", route, in: ["known"] }, ...requires],
    param: null,
    cost,
    pay: null,
    hireBp: null,
    effects: [{ type: "route/apply", route }],
    counts: [route],
  };
}

/**
 * One apply activity for each route, as every gate route has its own. The
 * partner routes' fee and surcharge are the activity's cost; a dependant's fee
 * depends on the lead's route, so the gate takes it as the application goes in.
 */
export const peopleApplyActivities: Record<Id<"activity">, ActivityEntry> = {
  "activity.apply-uk-partner": applying(
    UK_PARTNER,
    [
      { type: "var/min", var: "var.uk-family-window", value: 1 },
      step(UK_PARTNER, "married"),
      step(UK_PARTNER, "sponsor"),
      step(UK_PARTNER, "floor"),
      // person:partner-gate-needs, place:removal-bans-the-country: no removal's ban on the country, judged before the fee and the surcharge are taken.
      { type: "not", of: { type: "place/banned", country: "country.uk" } },
      { type: "any", of: [DEGREE, STATEMENT, held("document.english-test", 30)] },
      TB_UNLESS_IN_UK,
      held("document.passport"),
      fromHomeOr("status.uk-overstayer", false),
    ],
    [{ currency: "GBP", amount: { var: "var.uk-partner-fee" }, reason: "fee-visa" }, SURCHARGE_YEAR, SURCHARGE_YEAR, SURCHARGE_YEAR],
  ),
  "activity.apply-canada-spouse": applying(
    CA_SPOUSE,
    [
      { type: "var/min", var: "var.canada-family-window", value: 1 },
      step(CA_SPOUSE, "married"),
      step(CA_SPOUSE, "sponsor"),
      { type: "not", of: { type: "place/banned", country: "country.canada" } },
      held("document.passport"),
      fromHomeOr("status.canada-overstayer", false),
    ],
    [{ currency: "CAD", amount: { var: "var.canada-sponsor-fee" }, reason: "fee-visa" }],
  ),
  "activity.apply-uk-dependant": applying(
    UK_DEPENDANT,
    [
      step(UK_DEPENDANT, "joint"),
      step(UK_DEPENDANT, "lead"),
      held("document.passport"),
      TB_UNLESS_IN_UK,
      fromHomeOr("status.uk-overstayer", true),
      // The maintenance at one month end, or nothing required once the lead has a year in the UK (person:dependant-gate-needs).
      { type: "route/funds", route: UK_DEPENDANT, heldMonths: 1 },
    ],
    [],
  ),
  "activity.apply-canada-accompany": applying(
    CA_ACCOMPANY,
    [step(CA_ACCOMPANY, "joint"), step(CA_ACCOMPANY, "lead"), held("document.passport"), fromHomeOr("status.canada-overstayer", true)],
    [],
  ),
};

export const routeTable: Record<Id<"route">, RouteEntry> = { ...wholeLifeRoutes, ...peopleRoutes };
