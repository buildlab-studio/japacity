// The couch: docs/rules/people.md R-PEOPLE-032. Arriving in a country where a
// sibling lives, the shared room of R-ABROAD-003 opens `tuning.people.couchMonths`
// months later instead of at once. Upkeep is charged as usual. The obligation
// kind asks these two questions; the sibling is read from the bonds' facts.
import type { Effect, Id, ReadCtx, State } from "../engine/types";

/** A sibling, real or computer, whose facts show them living abroad in `country`. */
export function siblingLivesIn(state: State, country: Id<"country">): boolean {
  return Object.values(state.people.bonds).some(
    (bond) => bond.role === "sibling" && bond.stage !== "ended" && bond.facts !== null && bond.facts.where === "abroad" && bond.facts.country === country,
  );
}

function monthsHere(state: State): number {
  return state.turn.month - state.place.movedMonth;
}

function roomHere(read: ReadCtx): Id<"obligation"> | null {
  const { place } = read.state;
  if (place.where !== "abroad" || place.country === null) return null;
  return read.content.country[place.country]?.rentRoom ?? null;
}

/** R-PEOPLE-032: the room is not opened while the couch lasts. */
export function onTheCouch(read: ReadCtx, obligation: Id<"obligation">): boolean {
  const { place } = read.state;
  if (roomHere(read) !== obligation || place.country === null) return false;
  return monthsHere(read.state) < read.content.tuning.people.couchMonths && siblingLivesIn(read.state, place.country);
}

/**
 * R-PEOPLE-032: the month the couch ends, the room opens. Abroad with no rent
 * open happens only after a couch, since arrival opens the room otherwise and
 * an eviction opens it again. It opens after the month's charges, so the couch
 * months are free.
 */
export function couchEnds(read: ReadCtx): Effect[] {
  const room = roomHere(read);
  if (room === null || monthsHere(read.state) < read.content.tuning.people.couchMonths) return [];
  const renting = Object.values(read.state.obligation.items).some((item) => read.content.obligation[item.entry]?.type === "rent");
  return renting ? [] : [{ type: "obligation/open", obligation: room }];
}
