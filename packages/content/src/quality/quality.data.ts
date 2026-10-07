// From docs/rules/quality.md, "Entries".
import type { Id, QualityEntry } from "@japacity/sim";

const UK: Id<"route"> = "route.uk-masters";

export const qualityTable:Record<Id<"quality">, QualityEntry> = {
  "quality.age-months": { id: "quality.age-months", group: "self", min: 192, max: 1200, shown: true, counts: [] },
  "quality.edu-level": { id: "quality.edu-level", group: "education", min: 0, max: 5, shown: true, counts: [UK] },
  "quality.edu-grade": { id: "quality.edu-grade", group: "education", min: 0, max: 5, shown: true, counts: [UK] },
  "quality.english": { id: "quality.english", group: "skills", min: 0, max: 100, shown: true, counts: [UK] },
  "quality.tech": { id: "quality.tech", group: "skills", min: 0, max: 100, shown: true, counts: [] },
  "quality.interview-prep": { id: "quality.interview-prep", group: "skills", min: 0, max: 100, shown: true, counts: [UK] },
  "quality.portfolio": { id: "quality.portfolio", group: "proof", min: 0, max: 10, shown: true, counts: [] },
  "quality.land": { id: "quality.land", group: "proof", min: 0, max: 3, shown: true, counts: [] },
  "quality.network": { id: "quality.network", group: "people", min: 0, max: 100, shown: true, counts: [] },
  "quality.family-means": { id: "quality.family-means", group: "people", min: 0, max: 100, shown: true, counts: [] },
  "quality.family-stake": { id: "quality.family-stake", group: "people", min: 0, max: 1, shown: true, counts: [] },
  "quality.standing": { id: "quality.standing", group: "self", min: 0, max: 100, shown: true, counts: [] },
  "quality.wellbeing": { id: "quality.wellbeing", group: "self", min: 0, max: 100, shown: true, counts: [] },
  "quality.credit-mark": { id: "quality.credit-mark", group: "self", min: 0, max: 3, shown: true, counts: [] },

  // route-gates.md "New qualities": nursing and care skill. A nurse starts at 60, a care assistant at 30.
  // `counts` stays empty until route.uk-care and route.canada-points are in
  // content (the home-side content adds them); the page's two routes join it then.
  "quality.care": { id: "quality.care", group: "skills", min: 0, max: 100, shown: true, counts: [] },
  // car.md: 1 for the lives that can drive. Hidden.
  "quality.driving": { id: "quality.driving", group: "self", min: 0, max: 1, shown: false, counts: [] },
};
