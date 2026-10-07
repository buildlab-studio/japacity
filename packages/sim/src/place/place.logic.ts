// Place: docs/rules/place.md. Stub: at home, with the view real.
import type { RegisteredKind } from "../engine/kind";
import { effectsNotBuilt, requirementsNotBuilt } from "../engine/stub";
import type { PlaceSlice } from "../engine/types";
import type { PlaceEvent } from "./place.events";

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
