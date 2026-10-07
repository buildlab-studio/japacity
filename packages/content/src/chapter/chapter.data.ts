// From docs/rules/chapter.md, "Entries".
import type { ChapterEntry, Id } from "@japacity/sim";

import { naira } from "../units";

const UK: Id<"route"> = "route.uk-masters";

export const chapterTable: Record<Id<"chapter">, ChapterEntry> = {
  "chapter.find-your-feet": {
    id: "chapter.find-your-feet",
    order: 1,
    items: [
      { id: "job", requirement: { type: "job/any" } },
      // One month in any job: an empty list counts every job.
      { id: "pay", requirement: { type: "activity/tenure", activities: [], months: 1 } },
      { id: "heard", requirement: { type: "route/state", route: UK, in: ["heard", "known", "applying", "granted", "departed"] } },
      { id: "known", requirement: { type: "route/state", route: UK, in: ["known", "applying", "granted", "departed"] } },
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
    // One item that is an `any`, so one path closes the chapter.
    items: [
      {
        id: "secure",
        requirement: {
          type: "any",
          of: [
            // `settled`: a settled or citizen status held.
            { type: "status/is", statuses: ["status.uk-settled", "status.uk-citizen", "status.ca-resident", "status.ca-citizen"] },
            // `home`: a return recorded. The chapter is current only after Landing, which is met
            // abroad, so being home now means a return. no requirement reads the shape,
            // so any return closes it, not only one with papers or by choice.
            { type: "place/is", where: "home" },
            // `second`: a second route granted. the UK master's is the only route in
            // content; the routes of route-gates.md join when they are entered.
            { type: "route/state", route: UK, in: ["granted"] },
          ],
        },
      },
    ],
  },
};
