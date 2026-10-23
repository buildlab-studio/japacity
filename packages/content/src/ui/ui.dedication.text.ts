// The dedication page's own words (account:dedication-page-and-its-doors), reached from the lantern canoe on the map
// (world:lantern-canoe-on-map) and Settings' five taps, and naming a light of the player's own (account:name-a-light-for-yours), in the
// voice of docs/rules/text.md. The dedication's lines and the nickname under the big light are content's (about.data.ts), never here.
// Read only once the page opens, so they ride a chunk of their own, fetched with it (engine:first-download-has-budget); the canoe's
// name stays in ui.online.text.ts.
export const uiDedicationText: Record<string, string> = {
  "ui.dedication.page": "Dedication",
  "ui.dedication.count": "{count} lights",
  "ui.dedication.count.one": "{count} light",
  "ui.dedication.tonight": "on the water tonight",
  "ui.dedication.rest": "Sun re o.",
  "ui.dedication.close": "Close",
  "ui.dedication.light-one": "Light one for yours",
  "ui.dedication.out": "The water is out of reach right now.",
  "ui.dedication.yours": "yours",
  "ui.dedication.name": "Who is it for?",
  "ui.dedication.years": "Years, if you want",
  "ui.dedication.from": "First year",
  "ui.dedication.to": "Last year",
  "ui.dedication.between": "to",
  "ui.dedication.hint": "Four words at most. Its name shows to everyone once it has been looked over.",
  "ui.dedication.light-it": "Light it",
  "ui.dedication.mine": "Yours is on the water. Its name shows to everyone once it has been looked over.",
  "ui.dedication.put-out": "Put it out",
  "ui.dedication.problem.name-words": "Four words at most.",
  "ui.dedication.problem.name-characters": "Forty letters at most.",
  "ui.dedication.problem.first-year": "A year from {first} to {year}.",
  "ui.dedication.problem.last-year": "A year from {first} to {year}.",
  "ui.dedication.problem.last-before": "The last year cannot come before the first.",
  "ui.dedication.problem.name-empty": "A name first.",
};
