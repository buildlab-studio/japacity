import type { Id, OfferState } from "../engine/types";

export type OfferEvent =
  /** An offer opened with its terms, signs and hidden fraud fixed (R-OFFER-002). Records when and how often its entry opened. */
  | { type: "offer/opened"; item: OfferState }
  /** A choice was taken and its effects applied. The offer is removed (R-OFFER-003). */
  | { type: "offer/taken"; id: string; entry: Id<"offer">; choice: string }
  /** The offer's month came. `choice` is the lapse choice applied, if one was (R-OFFER-005). */
  | { type: "offer/lapsed"; id: string; entry: Id<"offer">; choice: string | null }
  /** An effect opened the same entry again: this one closed unanswered, with no lapse effects, for the new one (R-OFFER-007). */
  | { type: "offer/replaced"; id: string; entry: Id<"offer"> };
