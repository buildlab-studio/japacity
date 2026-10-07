// Place: docs/rules/place.md. Stub: at home, with the view real.
import type { RegisteredKind } from "../engine/kind";
import { effectsNotBuilt, requirementsNotBuilt } from "../engine/stub";
import type { Id, PlaceSlice, State, WhereEntry } from "../engine/types";
import type { PlaceEvent } from "./place.events";

/** An entry that may be tied to a place: activities, offers, obligations, routes, goals. */
export interface Placed {
  /** Missing means home. */
  where?: WhereEntry;
  /** Abroad: the country it belongs to. Null or missing means every country. */
  country?: Id<"country"> | null;
}

/**
 * R-PLACE-003: whether an entry applies where the character is. `any` applies
 * everywhere, the road included; `home` and `abroad` apply only there; an
 * abroad entry with a country applies only in that country.
 */
export function appliesHere(entry: Placed, state: State): boolean {
  const where = entry.where ?? "home";
  if (where === "any") return true;
  if (where !== state.place.where) return false;
  if (where === "abroad" && entry.country !== undefined && entry.country !== null) return entry.country === state.place.country;
  return true;
}

export const placeKind: RegisteredKind<PlaceSlice, PlaceEvent> = {
  kind: "place",
  initial: () => ({ where: "home", country: null, movedMonth: 0, returns: [], heldAbroad: null }),
  effects: effectsNotBuilt(["place/move"]),
  evolve: (slice) => slice,
  requirements: requirementsNotBuilt(["place/is", "place/returned", "place/months-here"]),
  view: ({ state }) => ({
    place: {
      where: state.place.where,
      country: state.place.country,
      monthsHere: state.turn.month - state.place.movedMonth,
      returns: state.place.returns,
      heldAbroad: state.place.heldAbroad?.status ?? null,
    },
  }),
};
