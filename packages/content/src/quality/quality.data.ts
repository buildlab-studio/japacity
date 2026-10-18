// From docs/rules/quality.md, "Entries".
import type { Id, QualityEntry } from "@japacity/sim";

const UK: Id<"route"> = "route.uk-masters";

export const qualityTable:Record<Id<"quality">, QualityEntry> = {
  "quality.age-months": { id: "quality.age-months", group: "self", min: 192, max: 1200, shown: true, counts: [] },
  "quality.edu-level": { id: "quality.edu-level", group: "education", min: 0, max: 5, shown: true, counts: [UK] },
  "quality.edu-grade": { id: "quality.edu-grade", group: "education", min: 0, max: 5, shown: true, counts: [UK] },
  "quality.english": { id: "quality.english", group: "skills", min: 0, max: 100, shown: true, counts: [UK] },
  "quality.tech": { id: "quality.tech", group: "skills", min: 0, max: 100, shown: true, counts: [] },
  // The body (R-QUALITY-007, decision 0011): moved by what you do today and said in words, never as a meter.
  "quality.belly": { id: "quality.belly", group: "self", min: 0, max: 100, shown: false, counts: [], start: 60 },
  "quality.energy": { id: "quality.energy", group: "self", min: 0, max: 100, shown: false, counts: [], start: 70 },
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
  // `counts` is empty, though the page names route.uk-care and route.canada-points and both
  // are in content (an open question in route-gates.md).
  "quality.care": { id: "quality.care", group: "skills", min: 0, max: 100, shown: true, counts: [] },
  // car.md: 1 for the lives that can drive. Hidden.
  "quality.driving": { id: "quality.driving", group: "self", min: 0, max: 1, shown: false, counts: [] },

  // health.md. Three hidden counters the health rules keep; the player sees the warning, the offers and the locks.
  // R-HEALTH-001: months in a row under the run-down line at the month phase. The top is one past the warning:
  // the warning comes at 2, and illness may roll from 3, the month after it.
  "quality.run-down-months": { id: "quality.run-down-months", group: "self", min: 0, max: 3, shown: false, counts: [] },
  // R-HEALTH-002 and 003: where the last illness stands. 0 nothing pending, 1 treated at the chemist and 2 ignored
  // (each waits on its relapse draw), 3 worse and not yet answered, 4 worse and answered.
  "quality.illness-course": { id: "quality.illness-course", group: "self", min: 0, max: 4, shown: false, counts: [] },
  // R-HEALTH-005: months before another forced month may come. A choice that locks a slot for illness, a burial or a
  // court date fills it to the top, so forced months are at most one in any twelve.
  "quality.forced-wait": { id: "quality.forced-wait", group: "self", min: 0, max: 12, shown: false, counts: [] },
};
