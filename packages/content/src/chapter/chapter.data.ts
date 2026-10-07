// From docs/rules/chapter.md, "Entries".
import type { ChapterEntry, Id } from "@japacity/sim";

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
};
