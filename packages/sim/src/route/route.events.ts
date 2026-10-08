import type { Currency, Id, RouteGateState, RouteState, RouteStateName, VisaApplication } from "../engine/types";

/** Why a visa was refused, most telling first (R-ROUTE-019). */
export type RefusalReason = "funds" | "interview" | "history" | "credibility" | "sponsor" | "agent" | "endorsement";

/** Every event of the route kind. */
export type RouteKindEvent =
  /**
   * The route moved along one of the page's arrows that carries nothing else
   * (R-ROUTE-001): heard (R-ROUTE-002, 003), known (R-ROUTE-004), granted
   * (R-ROUTE-017) and departed (R-ROUTE-020). `via` says how talk of it
   * arrived, for the report: the activity, the story or `friend`.
   */
  | { type: "route/moved"; route: Id<"route">; to: RouteStateName; via?: string }
  /** An application went to a school; its answer is due in `readyMonth` (R-ROUTE-006). */
  | { type: "route/school-applied"; route: Id<"route">; school: Id<"school">; readyMonth: number }
  /** A school answered (R-ROUTE-007). `discount` is in pence and is 0 with no offer. */
  | { type: "route/school-answered"; route: Id<"route">; school: Id<"school">; offer: boolean; discount: number }
  /** The deposit was paid to the school, which becomes the route's school (R-ROUTE-008). Pence. */
  | { type: "route/deposit-paid"; route: Id<"route">; school: Id<"school">; amount: number }
  /** The month-end funds check (R-ROUTE-011). `was` is whether the check before it was covered. */
  | { type: "route/funds-checked"; route: Id<"route">; funds: RouteState["funds"]; was: boolean }
  /** The visa application went in and the route is applying (R-ROUTE-014). */
  | { type: "route/applied"; route: Id<"route">; visa: VisaApplication }
  /** The interview's score went on the open application (R-SETPIECE-004). Never shown. */
  | { type: "route/interview-scored"; route: Id<"route">; score: number }
  /**
   * The visa was refused (R-ROUTE-018, 019): back to known, one more refusal,
   * the school and the months held cleared, the deposit's refund booked.
   */
  | {
      type: "route/refused";
      route: Id<"route">;
      month: number;
      reasons: RefusalReason[];
      depositRefund: { amount: number; readyMonth: number } | null;
    }
  /** The booked deposit refund arrived in the pound bank pocket (R-ROUTE-018). Pence. */
  | { type: "route/deposit-refunded"; route: Id<"route">; amount: number }
  /** Family money that counts by consent toward the route's funds (R-ROUTE-010). */
  | { type: "route/supported"; route: Id<"route">; support: { currency: Currency; amount: number } }
  /**
   * A gate's own state moved (docs/rules/route-gates.md): a sponsor recorded, the
   * pool entered, an invitation, a step on the road. `note` names the line to
   * show, as `line.route.<note>` with the route, or null for a silent change.
   */
  | { type: "route/gate-updated"; route: Id<"route">; gate: RouteGateState; note: string | null };

/**
 * news.test.ts stands in for the route kind with the stub's
 * `route/moved` event and reads `to` from any `RouteEvent`, and another kind's
 * test is not this agent's to edit. So the stub's name keeps meaning that one
 * event until the test moves to `RouteKindEvent`.
 */
export type RouteEvent = Extract<RouteKindEvent, { type: "route/moved" }>;
