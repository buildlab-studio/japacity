import type { Id, OfferState } from "../engine/types";
import type { AgentKind, Look } from "./offer.agent";

export type OfferEvent =
  /** An offer opened with its terms, signs and hidden fraud fixed (offer:opening-fixes-terms-and-fraud). Records when and how often its entry opened. */
  | { type: "offer/opened"; item: OfferState; rolled?: true }
  /** A choice was taken and its effects applied. The offer is removed (offer:choice-needs-conditions-and-funds). */
  | { type: "offer/taken"; id: string; entry: Id<"offer">; choice: string }
  /** The offer's month came. `choice` is the lapse choice applied, if one was (offer:lapsed-offer-removed). */
  | { type: "offer/lapsed"; id: string; entry: Id<"offer">; choice: string | null }
  /** An effect opened the same entry again: this one closed unanswered, with no lapse effects, for the new one (offer:effect-opens-named-offer). */
  | { type: "offer/replaced"; id: string; entry: Id<"offer"> }
  /** The effect `offer/close` closed it unanswered: no choice, nothing paid (person:family-requests-shared, a request handled in another life). */
  | { type: "offer/closed"; id: string; entry: Id<"offer"> }
  /** A free look on an agent's sheet found these tells; the look is marked done (advice:scams-show-their-tells). */
  | { type: "offer/looked"; id: string; entry: Id<"offer">; look: Look; found: string[] }
  /**
   * An agent was paid (advice:agent-kind-drawn-on-offer, advice:bad-news-told-straight): his kind, who he is, the fee, the tells the player had seen,
   * and the paper a fixer brings forward, if any. Changes nothing itself.
   */
  | { type: "offer/agent-paid"; id: string; entry: Id<"offer">; kind: AgentKind; agent: string; fee: number; seen: string[]; paper: Id<"document"> | null }
  /** The month an overpromiser named has come and nothing moved (advice:agent-kind-drawn-on-offer). Changes nothing itself. */
  | { type: "offer/promise-broken"; id: string; agent: string; month: number };
