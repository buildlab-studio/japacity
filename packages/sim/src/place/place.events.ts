import type { Id, ReturnShape, Where } from "../engine/types";

export type PlaceEvent =
  /** R-PLACE-002 and 004: the character is somewhere new from this month. */
  | { type: "place/moved"; to: Where; country: Id<"country"> | null; month: number }
  /** R-PLACE-004 and 005: a return is recorded. `kept` is the status token kept abroad (R-RETURN-004). */
  | { type: "place/returned"; shape: ReturnShape; country: Id<"country"> | null; month: number; kept: Id<"status"> | null }
  /** R-RETURN-004: the character flew back to the country the token is for. */
  | { type: "place/token-used"; status: Id<"status"> }
  /** R-RETURN-004: a resident token lapses after too long away. */
  | { type: "place/token-lapsed"; status: Id<"status">; months: number }
  /** R-RETURN-005: the December visit opened in this month of the character's (R-PLACE-009's `decemberMonth`). */
  | { type: "place/december-opened"; month: number };
