// From docs/rules/chapter.md, "Entries".
import type { ChapterEntry, Id, Requirement } from "@japacity/sim";

import { naira } from "../units";

const UK: Id<"route"> = "route.uk-masters";
/** The ways out a life takes by its own effort (not through a partner): the first chapter counts any of them. */
const OWN_ROUTES: Id<"route">[] = ["route.uk-masters", "route.uk-care", "route.uk-talent", "route.uk-skilled", "route.canada-points", "route.gulf-contract"];

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
      // A route of your own effort (chapter.md: "have heard of a route").
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
    order: 3,
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
  "chapter.send-off": {
    id: "chapter.send-off",
    order: 4,
    items: [{ id: "departed", requirement: { type: "route/state", route: UK, in: ["departed"] } }],
  },
  "chapter.landing": {
    id: "chapter.landing",
    order: 5,
    items: [
      // A roof: an open rent obligation. the Gulf worker is housed by the employer
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
      // no requirement reads an offer taken or lapsed. A request from home comes up
      // only when the naira pockets hold ₦150,000 (offer.md, "not when broke"), which abroad
      // means money has been sent home; every request is then answered or lapses in a month.
      { id: "request", requirement: { type: "money/min", currency: "NGN", amount: naira(150000) } },
      // A first mark on the credit file: one payment on time.
      { id: "file", requirement: { type: "credit/min", value: 3 } },
    ],
  },
  "chapter.secure": {
    id: "chapter.secure",
    order: 6,
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
