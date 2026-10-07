// From docs/rules/director.md, "Eras". Weights name story groups; a group an era
// does not name weighs 1. `after` is this era's weight following each other era;
// an era it does not name weighs 0.
import type { EraEntry, Id } from "@japacity/sim";

const ERAS: Id<"era">[] = [
  "era.calm",
  "era.open-door",
  "era.hard-line",
  "era.crash",
  "era.scandal",
  "era.strike",
  "era.pandemic",
];

/** "From any: 3": every other era. */
const FROM_ANY: Record<string, number> = Object.fromEntries(
  ERAS.filter((era) => era !== "era.calm").map((era) => [era, 3]),
);

export const eraTable: Record<Id<"era">, EraEntry> = {
  "era.calm": {
    id: "era.calm",
    ticks: [18, 30],
    weights: { fx: 1, uk: 1, ca: 1, uae: 1, home: 1 },
    after: FROM_ANY,
    once: false,
    story: "news.era-calm",
  },
  "era.open-door": {
    id: "era.open-door",
    ticks: [18, 26],
    weights: { openings: 3, closures: 0, fx: 1 },
    after: { "era.calm": 2, "era.strike": 2, "era.crash": 1 },
    once: false,
    story: "news.era-open-door",
  },
  "era.hard-line": {
    id: "era.hard-line",
    ticks: [20, 30],
    weights: { closures: 3, strictness: 3, openings: 0 },
    after: { "era.open-door": 3, "era.scandal": 2 },
    once: false,
    story: "news.era-hard-line",
  },
  "era.crash": {
    id: "era.crash",
    ticks: [14, 22],
    weights: { fx: 4, home: 3, openings: 1 },
    after: { "era.calm": 1, "era.hard-line": 1, "era.strike": 2 },
    once: false,
    story: "news.era-crash",
  },
  "era.scandal": {
    id: "era.scandal",
    ticks: [14, 20],
    weights: { closures: 2, abroad: 3 },
    after: { "era.open-door": 3 },
    once: false,
    story: "news.era-scandal",
  },
  "era.strike": {
    id: "era.strike",
    ticks: [10, 16],
    weights: { home: 3, study: 2 },
    after: { "era.calm": 2, "era.crash": 2 },
    once: false,
    story: "news.era-strike",
  },
  "era.pandemic": {
    id: "era.pandemic",
    ticks: [12, 18],
    weights: { closures: 4, remote: 3, fx: 2 },
    after: { "era.calm": 1 },
    once: true,
    story: "news.era-pandemic",
  },
};
