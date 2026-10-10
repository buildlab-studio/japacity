import type { HomeHost, HomePlace } from "../engine/types";

export type HomeEvent =
  /**
   * R-HOME-002: the character lives here from this month. `from` is where they lived, null after an eviction or as a guest.
   * `opening`: the home a life from sixteen starts in, chosen on its last card, which is no move (R-PROLOGUE-012).
   * `rent`: what the move took at once. `putOut`: back to the family house because the room's rent went bad (R-HOME-011).
   */
  | { type: "home/moved"; from: HomePlace | null; to: HomePlace; month: number; rent: number; opening?: true; putOut?: true }
  /** R-HOME-002 with R-PLACE-007: back from abroad, the family house took the character back; told by the return, not again here. */
  | { type: "home/taken-back"; month: number }
  /** R-HOME-003: the settlement was cleared; `lost` is the naira cash that went with the room. */
  | { type: "home/evicted"; month: number; lost: number }
  /** R-HOME-004: taken in by a host, `by` naming the bond or the person, until the month given. */
  | { type: "home/taken-in"; host: HomeHost; by: string; month: number; until: number }
  /** R-HOME-005: the authority says a joined player's character stays here until `until`, or no longer. */
  | { type: "home/hosting"; pair: string; until: number | null }
  /** R-HOME-005: the month's rise on the upkeep for the guest, taken as the upkeep is. */
  | { type: "home/hosted"; pair: string; amount: number };
