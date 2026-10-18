import type { HomeHost, HomePlace } from "../engine/types";

export type HomeEvent =
  /**
   * home:move-home-once-a-month: the character lives here from this month. `from` is where they lived, null after an eviction or as a guest.
   * `opening`: the home a life from sixteen starts in, chosen on its last card, which is no move (prologue:makoko-start-never-a-trap).
   * `rent`: what the move took at once. `putOut`: back to the family house because the room's rent went bad (home:rent-default-returns-to-family).
   */
  | { type: "home/moved"; from: HomePlace | null; to: HomePlace; month: number; rent: number; opening?: true; putOut?: true }
  /** home:move-home-once-a-month with place:family-takes-you-back: back from abroad, the family house took the character back; told by the return, not again here. */
  | { type: "home/taken-back"; month: number }
  /** home:makoko-eviction-draw: the settlement was cleared; `lost` is the naira cash that went with the room. */
  | { type: "home/evicted"; month: number; lost: number }
  /** home:taken-in-after-eviction: taken in by a host, `by` naming the bond or the person, until the month given. */
  | { type: "home/taken-in"; host: HomeHost; by: string; month: number; until: number }
  /** home:hosting-costs-the-host: the authority says a joined player's character stays here until `until`, or no longer. */
  | { type: "home/hosting"; pair: string; until: number | null }
  /** home:hosting-costs-the-host: the month's rise on the upkeep for the guest, taken as the upkeep is. */
  | { type: "home/hosted"; pair: string; amount: number };
