import type { Id, ReturnShape, Where } from "../engine/types";

/** Placeholder: the place work defines the real events. */
export type PlaceEvent =
  | { type: "place/moved"; to: Where; country: Id<"country"> | null; month: number }
  | { type: "place/returned"; shape: ReturnShape; country: Id<"country">; month: number };
