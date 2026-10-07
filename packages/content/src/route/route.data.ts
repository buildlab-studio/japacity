// From docs/rules/route.md, "Entry: route.uk-masters", route-gates.md for the
// sponsor, points, endorsement and contract routes, and road.md for the road.
import type { ChecklistItem, Id, Requirement, RouteEntry } from "@japacity/sim";

const UK: Id<"route"> = "route.uk-masters";
const CARE: Id<"route"> = "route.uk-care";
const SKILLED: Id<"route"> = "route.uk-skilled";
const CANADA: Id<"route"> = "route.canada-points";
const TALENT: Id<"route"> = "route.uk-talent";
const GULF: Id<"route"> = "route.gulf-contract";

const DEGREE: Requirement = { type: "quality/min", quality: "quality.edu-level", value: 3 };

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

// the gate steps a checklist reads are named `sponsor` (a sponsor or
// agent recorded), `salary` (its salary at or above the route's bar), `pool`
// (a live profile) and `invited`. The page names the items, not the steps.
function step(route: Id<"route">, name: string): Requirement {
  return { type: "route/gate-step", route, step: name };
}

export const routeTable: Record<Id<"route">, RouteEntry> = {
  "route.uk-masters": {
    id: UK,
    // docs/rules/route-gates.md R-GATE-001 and 003.
    gate: "study",
    country: "country.uk",
    status: "status.uk-student",
    refusalBaseBp: 900,
    flightPaidByEmployer: false,
    hearIf: [{ type: "quality/min", quality: "quality.edu-level", value: 3 }],
    hearBy: 3,
    window: "var.uk-study-window",
    checklist: [
      {
        id: "degree",
        weight: 6,
        requirement: { type: "quality/min", quality: "quality.edu-level", value: 3 },
        partial: false,
      },
      {
        id: "grade",
        weight: 4,
        requirement: { type: "quality/min", quality: "quality.edu-grade", value: 3 },
        partial: false,
      },
      { id: "passport", weight: 4, requirement: { type: "document/held", document: "document.passport" }, partial: false },
      {
        id: "transcript",
        weight: 3,
        requirement: { type: "document/held", document: "document.transcript" },
        partial: false,
      },
      {
        id: "english",
        weight: 12,
        requirement: { type: "document/held", document: "document.english-test", min: 60 },
        partial: false,
      },
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
    country: "country.uk",
    status: "status.uk-sponsored",
    refusalBaseBp: 500,
    flightPaidByEmployer: false,
    hearIf: [{ type: "quality/min", quality: "quality.care", value: 30 }],
    hearBy: 4,
    // Starts at 0: closed to applicants abroad until the director opens it (R-SPONSOR-005).
    window: "var.uk-care-window",
    checklist: [
      item("licence", 10, held("document.nursing-licence")),
      item("verification", 14, held("document.nmcn-verification")),
      item("passport", 6, held("document.passport")),
      // Band 4.0, B1, held as the band times ten.
      item("english", 10, held("document.english-test", 40)),
      item("sponsor", 25, step(CARE, "sponsor")),
      item("tb", 5, held("document.tb-certificate")),
      item("salary", 10, step(CARE, "salary")),
      item("applied", 20, applied(CARE)),
    ],
    schools: [],
    interview: null,
    sponsor: {
      salaryVar: "var.uk-care-salary",
      maintenanceVar: null,
      // the page names `sponsorFindBp` but gives no figure. 10%, the care home offer's 8% a month and a little more for looking.
      findBp: 1000,
      bandMin: 40,
      documents: ["document.nursing-licence", "document.nmcn-verification"],
    },
  },
  "route.uk-skilled": {
    id: SKILLED,
    gate: "sponsor",
    country: "country.uk",
    status: "status.uk-sponsored",
    refusalBaseBp: 500,
    flightPaidByEmployer: false,
    // A bachelor's and 24 months across every job (R-SPONSOR-006).
    hearIf: [DEGREE, { type: "activity/tenure", activities: [], months: 24 }],
    hearBy: 6,
    window: "var.uk-skilled-window",
    checklist: [
      item("degree", 8, DEGREE),
      item("passport", 6, held("document.passport")),
      item("english", 10, held("document.english-test", 40)),
      item("sponsor", 30, step(SKILLED, "sponsor")),
      item("salary", 10, step(SKILLED, "salary")),
      { id: "funds", weight: 10, requirement: { type: "route/funds", route: SKILLED, heldMonths: 0 }, partial: true },
      item("tb", 6, held("document.tb-certificate")),
      item("applied", 20, applied(SKILLED)),
    ],
    schools: [],
    interview: null,
    sponsor: {
      salaryVar: "var.uk-skilled-salary",
      maintenanceVar: "var.uk-skilled-maintenance",
      // no figure on the page. 6%, between the tech firm's 4% and the agency's 6% a month, rounded up.
      findBp: 600,
      bandMin: 40,
      // The degree is a quality, so no document is named.
      documents: [],
    },
  },

  // route-gates.md, "Entry: route.canada-points".

  "route.canada-points": {
    id: CANADA,
    gate: "points",
    country: "country.canada",
    status: "status.ca-resident",
    refusalBaseBp: 1000,
    flightPaidByEmployer: false,
    hearIf: [DEGREE],
    hearBy: 5,
    window: "var.ca-window",
    checklist: [
      item("degree", 8, DEGREE),
      item("eca", 10, held("document.eca")),
      // Band 6.0 is CLB 7.
      item("english", 12, held("document.english-test", 60)),
      { id: "funds", weight: 20, requirement: { type: "route/funds", route: CANADA, heldMonths: 0 }, partial: true },
      item("pool", 15, step(CANADA, "pool")),
      item("invited", 20, step(CANADA, "invited")),
      item("applied", 15, applied(CANADA)),
    ],
    schools: [],
    interview: null,
    points: {
      table: "points.canada",
      fundsVar: "var.ca-funds",
      cutoffVar: "var.ca-cutoff",
      careCutoffVar: "var.ca-care-cutoff",
      feeVar: "var.ca-apply-fee",
      decisionVar: "var.ca-decision-months",
      // A profile lasts 12 months (R-POINTS-002 and 005).
      profileMonths: 12,
    },
  },

  // route-gates.md, "Entry: route.uk-talent".

  "route.uk-talent": {
    id: TALENT,
    gate: "endorsement",
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
      // The figures R-ENDORSE-001 asks for.
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
      // Months apply-endorsement is not legal after a refused endorsement (R-ENDORSE-002).
      cooldown: 6,
      feeVar: "var.uk-talent-endorse-fee",
    },
  },

  // route-gates.md, "The contract gate".

  "route.gulf-contract": {
    id: GULF,
    gate: "contract",
    country: "country.uae",
    status: "status.gulf-worker",
    refusalBaseBp: 1000,
    // The employer pays the flight (R-CONTRACT-004).
    flightPaidByEmployer: true,
    // Secondary school.
    hearIf: [{ type: "quality/min", quality: "quality.edu-level", value: 1 }],
    // Never by itself: at the motor park and through the agent.
    hearBy: null,
    window: "var.uae-window",
    checklist: [
      item("passport", 20, held("document.passport")),
      item("medical", 15, held("document.medical")),
      item("agent", 35, step(GULF, "sponsor")),
      item("applied", 30, applied(GULF)),
    ],
    schools: [],
    interview: null,
    // Under 45 years (R-CONTRACT-003).
    contract: { medical: "document.medical", maxAgeMonths: 540 },
  },

  // road.md. No checklist, no window, no figure, never in the routes view (R-ROAD-001).

  "route.road": {
    id: "route.road",
    gate: "road",
    country: null,
    status: null,
    // the road has no decision draw, so no refusal base.
    refusalBaseBp: 0,
    flightPaidByEmployer: false,
    // Nothing on the profile locks the pitches (R-ROAD-012).
    hearIf: [],
    hearBy: null,
    window: null,
    checklist: [],
    schools: [],
    interview: null,
    road: {
      // "Outcome tables (basis points)". A real-ish connection halves `held` in the road kind.
      steps: [
        { id: "desert", months: [2, 4], on: 6500, held: 1500, turned: 1500, lost: 500 },
        { id: "compound", months: [0, 6], on: 4500, held: 4000, turned: 1000, lost: 500 },
        { id: "coast", months: [1, 3], on: 6000, held: 2500, turned: 1000, lost: 500 },
        { id: "sea", months: [1, 1], on: 7000, held: 0, turned: 2500, lost: 500 },
      ],
    },
  },
};
