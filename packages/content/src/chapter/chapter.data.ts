// From docs/rules/chapter.md, "Entries".
import type { ChapterEntry, Id, Requirement } from "@japacity/sim";

import { naira } from "../units";

const UK: Id<"route"> = "route.uk-masters";
const CARE: Id<"route"> = "route.uk-care";
const TALENT: Id<"route"> = "route.uk-talent";
const POINTS: Id<"route"> = "route.canada-points";
const GULF: Id<"route"> = "route.gulf-contract";
const FILE: Id<"chapter"> = "chapter.build-the-file";
const DECISION: Id<"chapter"> = "chapter.decision-day";
/** The ways out a life takes by its own effort (not through a partner): the first chapter counts any of them. */
const OWN_ROUTES: Id<"route">[] = ["route.uk-masters", "route.uk-care", "route.uk-talent", "route.uk-skilled", "route.canada-points", "route.gulf-contract"];
/**
 * The routes a visa is granted and flown on: every route with a country, a partner's and a dependant's among them,
 * never the road. The send-off reads a flight on any of them (R-CHAPTER-002).
 */
const FLOWN_ROUTES: Id<"route">[] = [...OWN_ROUTES, "route.uk-partner", "route.ca-spouse", "route.uk-dependant", "route.ca-accompany"];

function held(document: Id<"document">, min?: number): Requirement {
  return min === undefined ? { type: "document/held", document } : { type: "document/held", document, min };
}

function gateStep(route: Id<"route">, step: string): Requirement {
  return { type: "route/gate-step", route, step };
}

function applied(route: Id<"route">): Requirement {
  return { type: "route/state", route, in: ["applying", "granted", "departed"] };
}

function granted(route: Id<"route">): Requirement {
  return { type: "route/state", route, in: ["granted", "departed"] };
}

/**
 * R-CHAPTER-009: a base chapter's variant for one way out. Its order sits after its base's and before the
 * next base's, so the orders stay one apiece; the engine follows the bases' order and only ever puts a
 * variant in its base's turn.
 */
function variant(base: Id<"chapter">, route: Id<"route">, order: number, items: ChapterEntry["items"], closesOn?: string): ChapterEntry {
  const slug = route === CARE ? "care" : route === TALENT ? "talent" : route === POINTS ? "points" : "gulf";
  const id: Id<"chapter"> = `${base}-${slug}`;
  return { id, order, items, variantOf: base, route, ...(closesOn === undefined ? {} : { closesOn }) };
}

/** The formal routes a second grant can come on. The road grants nothing. */
const SECOND_ROUTES: Id<"route">[] = ["route.uk-masters", "route.uk-care", "route.uk-skilled", "route.canada-points", "route.uk-talent", "route.gulf-contract"];

export const chapterTable: Record<Id<"chapter">, ChapterEntry> = {
  "chapter.find-your-feet": {
    id: "chapter.find-your-feet",
    order: 1,
    items: [
      { id: "job", requirement: { type: "job/any" } },
      // One month in any job: an empty list counts every job.
      { id: "pay", requirement: { type: "activity/tenure", activities: [], months: 1 } },
      // A route of your own effort (chapter.md: "have heard of a route"; a trade hears of the Gulf, never the master's).
      { id: "heard", requirement: { type: "any", of: OWN_ROUTES.map((route) => ({ type: "route/state" as const, route, in: ["heard", "known", "applying", "granted", "departed"] })) } },
      { id: "known", requirement: { type: "any", of: OWN_ROUTES.map((route) => ({ type: "route/state" as const, route, in: ["known", "applying", "granted", "departed"] })) } },
    ],
  },
  "chapter.build-the-file": {
    id: "chapter.build-the-file",
    order: 2,
    items: [
      { id: "passport", requirement: { type: "document/held", document: "document.passport" } },
      { id: "transcript", requirement: { type: "document/held", document: "document.transcript" } },
      // Band 6.0, held as the band times ten.
      { id: "english", requirement: { type: "document/held", document: "document.english-test", min: 60 } },
      { id: "offer", requirement: { type: "route/offer", route: UK } },
    ],
  },
  "chapter.decision-day": {
    id: "chapter.decision-day",
    order: 7,
    items: [
      { id: "deposit", requirement: { type: "route/deposit", route: UK } },
      { id: "held", requirement: { type: "route/funds", route: UK, heldMonths: 1 } },
      { id: "tb", requirement: { type: "document/held", document: "document.tb-certificate" } },
      { id: "applied", requirement: { type: "route/state", route: UK, in: ["applying", "granted", "departed"] } },
      { id: "granted", requirement: { type: "route/state", route: UK, in: ["granted", "departed"] } },
    ],
    // A grant is decision day whether or not the held funds lasted (R-CHAPTER-002).
    closesOn: "granted",
  },

  // R-CHAPTER-009: the file and decision day for each way out of the player's own effort. The orders
  // between the bases keep one order to a chapter; the engine reads the base's.
  "chapter.build-the-file-care": variant(FILE, CARE, 3, [
    // Twenty-four months as a nurse: the home council's rule before it verifies (R-SPONSOR-005).
    { id: "tenure", requirement: { type: "activity/tenure", activities: ["activity.job-nurse"], months: 24 } },
    { id: "verification", requirement: held("document.nmcn-verification") },
    { id: "sponsor", requirement: gateStep(CARE, "sponsor") },
    { id: "applied", requirement: applied(CARE) },
  ]),
  "chapter.build-the-file-talent": variant(FILE, TALENT, 4, [
    // The endorsement's bar for the portfolio (R-ENDORSE-001).
    { id: "portfolio", requirement: { type: "quality/min", quality: "quality.portfolio", value: 3 } },
    // The endorsement gate's only step is its cooldown, so the item reads the endorsement held, as the route's checklist does.
    { id: "endorsement", requirement: held("document.endorsement") },
    { id: "applied", requirement: applied(TALENT) },
  ]),
  "chapter.build-the-file-points": variant(FILE, POINTS, 5, [
    { id: "eca", requirement: held("document.eca") },
    // Band 6.0, CLB 7 (R-POINTS-002), held as the band times ten.
    { id: "english", requirement: held("document.english-test", 60) },
    { id: "pool", requirement: gateStep(POINTS, "pool") },
    { id: "invited", requirement: gateStep(POINTS, "invited") },
  ]),
  "chapter.build-the-file-gulf": variant(FILE, GULF, 6, [
    // No honest way to the Gulf goes without a passport: it comes before the medical.
    { id: "passport", requirement: held("document.passport") },
    { id: "medical", requirement: held("document.medical") },
    // The contract gate's one step: an agent recorded with the contract's terms (route-gates.md, the code's reading).
    { id: "agent", requirement: gateStep(GULF, "sponsor") },
    // The page calls the contract a gate step, and the gate has one. The contract is made when the
    // agent takes your papers to the employer (`activity.apply-gulf-contract`), so the item is the route applied.
    { id: "contract", requirement: applied(GULF) },
  ]),
  "chapter.decision-day-care": variant(
    DECISION,
    CARE,
    8,
    [
      { id: "tb", requirement: held("document.tb-certificate") },
      { id: "police", requirement: held("document.police-certificate") },
      { id: "applied", requirement: applied(CARE) },
      { id: "granted", requirement: granted(CARE) },
    ],
    "granted",
  ),
  "chapter.decision-day-talent": variant(
    DECISION,
    TALENT,
    9,
    [
      { id: "tb", requirement: held("document.tb-certificate") },
      { id: "applied", requirement: applied(TALENT) },
      { id: "granted", requirement: granted(TALENT) },
    ],
    "granted",
  ),
  "chapter.decision-day-points": variant(
    DECISION,
    POINTS,
    10,
    [
      { id: "police", requirement: held("document.police-certificate") },
      { id: "applied", requirement: applied(POINTS) },
      { id: "granted", requirement: granted(POINTS) },
    ],
    "granted",
  ),
  "chapter.decision-day-gulf": variant(
    DECISION,
    GULF,
    11,
    [
      { id: "police", requirement: held("document.police-certificate") },
      { id: "applied", requirement: applied(GULF) },
      { id: "granted", requirement: granted(GULF) },
    ],
    "granted",
  ),
  "chapter.send-off": {
    id: "chapter.send-off",
    order: 12,
    // The flight on any route with a country closes the send-off, a partner's or a dependant's too (R-CHAPTER-002).
    items: [{ id: "departed", requirement: { type: "any", of: FLOWN_ROUTES.map((route) => ({ type: "route/state" as const, route, in: ["departed"] })) } }],
  },
  "chapter.landing": {
    id: "chapter.landing",
    order: 13,
    items: [
      // A roof: an open rent obligation. The Gulf worker is housed by the employer
      // and pays no rent (abroad-money.md), so holding that status meets it too.
      {
        id: "room",
        requirement: {
          type: "any",
          of: [
            { type: "obligation/has", obligationType: "rent" },
            { type: "status/is", statuses: ["status.gulf-worker"] },
          ],
        },
      },
      // A job abroad held one month.
      { id: "job", requirement: { type: "activity/local-tenure", months: 1 } },
      // The first rule of your status read: any status held.
      {
        id: "status",
        requirement: {
          type: "status/is",
          statuses: [
            "status.uk-student",
            "status.uk-graduate",
            "status.uk-sponsored",
            "status.uk-talent",
            "status.uk-settled",
            "status.uk-citizen",
            "status.uk-overstayer",
            "status.ca-resident",
            "status.ca-citizen",
            "status.ca-overstayer",
            "status.gulf-worker",
            "status.uae-irregular",
            "status.eu-irregular",
          ],
        },
      },
      // No requirement reads an offer taken or lapsed. A request from home comes up
      // only when the naira pockets hold ₦150,000 (offer.md, "not when broke"), which abroad
      // means money has been sent home; every request is then answered or lapses in a month.
      { id: "request", requirement: { type: "money/min", currency: "NGN", amount: naira(150000) } },
      // A first mark on the credit file: one payment on time.
      { id: "file", requirement: { type: "credit/min", value: 3 } },
    ],
  },
  "chapter.secure": {
    id: "chapter.secure",
    order: 14,
    // One item that is an `any`, so one path closes the chapter (R-CHAPTER-007).
    items: [
      {
        id: "secure",
        requirement: {
          type: "any",
          of: [
            // `settled`: a settled or citizen status held.
            { type: "status/is", statuses: ["status.uk-settled", "status.uk-citizen", "status.ca-resident", "status.ca-citizen"] },
            // `home`: a return with papers or by choice on the record. The chapter is current only
            // after Landing, which is met abroad, so the return is one made from there.
            { type: "place/returned", shapes: ["with-papers", "by-choice"] },
            // `second`: a second route granted. A route flown is `departed`, and no route is applied
            // for abroad (R-PLACE-003), so a route `granted` now was granted after a return.
            ...SECOND_ROUTES.map((route): Requirement => ({ type: "route/state", route, in: ["granted"] })),
          ],
        },
      },
    ],
  },
};
