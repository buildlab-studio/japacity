// From docs/rules/route.md, "Entry: route.uk-masters".
import type { Id, RouteEntry } from "@japacity/sim";

const UK: Id<"route"> = "route.uk-masters";

export const routeTable: Record<Id<"route">, RouteEntry> = {
  "route.uk-masters": {
    id: UK,
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
};
