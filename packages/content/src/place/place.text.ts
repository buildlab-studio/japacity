// First drafts from docs/rules/place.md and return.md: the report lines of the place kind.
export const placeText: Record<string, string> = {
  "line.place.arrived": "You land in {country}. Everything costs more than you planned for.",
  "line.place.on-road": "You leave by road. Nobody at home knows the whole plan.",
  "line.place.returned-with-papers": "You come home from {country} with papers in your pocket. The door stays open behind you.",
  "line.place.returned-by-choice": "You come home from {country} because you chose to. People still ask why.",
  "line.place.returned-broke": "You come home from {country} with the fare and not much more. Everyone notices.",
  "line.place.returned-road": "You come home from the road on a ticket someone else paid for. Nobody asks where you went.",
  "line.place.returned-assisted": "You come home from {country} on a ticket someone else paid for. Nobody says it, but everyone knows.",
  "line.place.returned-removed": "You are sent home from {country}. There is no way back in for years.",
  "line.place.token-used": "You fly back on {status}. No new visa, only the ticket.",
  "line.place.token-lapsed": "{months} months away and {status} has lapsed. You would have to start again.",
};
