import type { Id, OfferState } from "../engine/types";
import type { AgentKind, Look } from "./offer.agent";

export type OfferEvent =
  /** An offer opened with its terms, signs and hidden fraud fixed (R-OFFER-002). Records when and how often its entry opened. */
  | { type: "offer/opened"; item: OfferState }
  /** A choice was taken and its effects applied. The offer is removed (R-OFFER-003). */
  | { type: "offer/taken"; id: string; entry: Id<"offer">; choice: string }
  /** The offer's month came. `choice` is the lapse choice applied, if one was (R-OFFER-005). */
  | { type: "offer/lapsed"; id: string; entry: Id<"offer">; choice: string | null }
  /** An effect opened the same entry again: this one closed unanswered, with no lapse effects, for the new one (R-OFFER-007). */
  | { type: "offer/replaced"; id: string; entry: Id<"offer"> }
  /** The effect `offer/close` closed it unanswered: no choice, nothing paid (R-PEOPLE-034, a request handled in another life). */
  | { type: "offer/closed"; id: string; entry: Id<"offer"> }
  /** A free look on an agent's sheet found these tells; the look is marked done (R-ADVICE-006). */
  | { type: "offer/looked"; id: string; entry: Id<"offer">; look: Look; found: string[] }
  /**
   * An agent was paid (R-ADVICE-005, 009): his kind, who he is, the fee, the tells the player had seen,
   * and the paper a fixer brings forward, if any. Changes nothing itself.
   */
  | { type: "offer/agent-paid"; id: string; entry: Id<"offer">; kind: AgentKind; agent: string; fee: number; seen: string[]; paper: Id<"document"> | null }
  /** The month an overpromiser named has come and nothing moved (R-ADVICE-005). Changes nothing itself. */
  | { type: "offer/promise-broken"; id: string; agent: string; month: number };
