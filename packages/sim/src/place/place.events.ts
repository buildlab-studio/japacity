import type { Currency, Id, ReturnShape, RideWay, Where } from "../engine/types";

export type PlaceEvent =
  /** place:departure-moves-abroad and place:return-home-paid-or-assisted: the character is somewhere new from this month. */
  | { type: "place/moved"; to: Where; country: Id<"country"> | null; month: number }
  /** place:return-home-paid-or-assisted and place:return-shape-decided-at-once: a return is recorded. `kept` is the status token kept abroad, with the months it had (return:papers-return-keeps-status). */
  | {
      type: "place/returned";
      shape: ReturnShape;
      country: Id<"country"> | null;
      month: number;
      kept: Id<"status"> | null;
      keptMonths: { monthsHeld: number; lawfulMonths: number } | null;
      /** place:leaving-an-overstay-bans, status:overstay-counts-as-refusal: a return from an overstay past the grace or with a ban. */
      overstay?: { banMonths: number; pastGrace: boolean };
    }
  /** place:returns-service-takes-you-home: the returns service's grant arrived in the naira bank. */
  | { type: "place/grant-received"; amount: number }
  /** return:papers-return-keeps-status: the character flew back to the country the token is for. */
  | { type: "place/token-used"; status: Id<"status"> }
  /** return:papers-return-keeps-status: a resident token lapses after too long away. */
  | { type: "place/token-lapsed"; status: Id<"status">; months: number }
  /** return:december-visit-set-piece: the December visit opened in this month of the character's (place:view-shows-place-and-returns's `decemberMonth`). */
  | { type: "place/december-opened"; month: number }
  /** place:rides-between-city-places: a ride inside the city, its fare paid in `currency` (naira at home, the country's money abroad), 0 on foot or on this month's bus pass (place:country-pass-covers-ways). */
  | { type: "place/rode"; from: Id<"place">; to: Id<"place">; way: RideWay; fare: number; currency: Currency };
