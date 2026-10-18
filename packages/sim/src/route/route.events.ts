import type { Currency, Id, RouteGateState, RouteState, RouteStateName, VisaApplication } from "../engine/types";

/** Why a visa was refused, most telling first (route:refusal-reasons-recorded). */
export type RefusalReason = "funds" | "interview" | "history" | "credibility" | "sponsor" | "agent" | "endorsement" | "relationship" | "sham" | "lead";

/** Every event of the route kind. */
export type RouteKindEvent =
  /**
   * The route moved along one of the page's arrows that carries nothing else
   * (route:routes-move-along-arrows): heard (route:hearing-a-route, route:friend-tells-by-month), known (route:looking-into-makes-known), granted
   * (route:grant-moves-to-granted) and departed (route:departure-pays-flight). `via` says how talk of it
   * arrived, for the report: the activity, the story or `friend`.
   */
  | { type: "route/moved"; route: Id<"route">; to: RouteStateName; via?: string }
  /** An application went to a school; its answer is due in `readyMonth` (route:applying-to-a-school). */
  | { type: "route/school-applied"; route: Id<"route">; school: Id<"school">; readyMonth: number }
  /** A school answered (route:school-answers-by-grade). `discount` is in pence and is 0 with no offer. */
  | { type: "route/school-answered"; route: Id<"route">; school: Id<"school">; offer: boolean; discount: number }
  /** The deposit was paid to the school, which becomes the route's school (route:deposit-secures-school). Pence. */
  | { type: "route/deposit-paid"; route: Id<"route">; school: Id<"school">; amount: number }
  /** The month-end funds check (route:funds-held-month-count). `was` is whether the check before it was covered. */
  | { type: "route/funds-checked"; route: Id<"route">; funds: RouteState["funds"]; was: boolean }
  /** The visa application went in and the route is applying (route:application-fixes-figures). */
  | { type: "route/applied"; route: Id<"route">; visa: VisaApplication }
  /** The interview's score went on the open application (route:answers-score-and-close). Never shown. */
  | { type: "route/interview-scored"; route: Id<"route">; score: number }
  /**
   * The visa was refused (route:refusal-refunds-and-resets, route:refusal-reasons-recorded): back to known, one more refusal,
   * the school and the months held cleared, the deposit's refund booked.
   */
  | {
      type: "route/refused";
      route: Id<"route">;
      month: number;
      reasons: RefusalReason[];
      depositRefund: { amount: number; readyMonth: number } | null;
    }
  /** The booked deposit refund arrived in the pound bank pocket (route:refusal-refunds-and-resets). Pence. */
  | { type: "route/deposit-refunded"; route: Id<"route">; amount: number }
  /** Family money that counts by consent toward the route's funds (route:funds-shown-exclude-cash). */
  | { type: "route/supported"; route: Id<"route">; support: { currency: Currency; amount: number } }
  /**
   * A gate's own state moved (docs/rules/route-gates.md): a sponsor recorded, the
   * pool entered, an invitation, a step on the road. `note` names the line to
   * show, as `line.route.<note>` with the route, or null for a silent change.
   */
  | { type: "route/gate-updated"; route: Id<"route">; gate: RouteGateState; note: string | null; secret?: RouteState["secret"] }
  /** A refusal recorded without a decision draw: the endorsing body said no (route-gates:endorsement-decided-by-draw). Counts as a refusal. */
  | { type: "route/refusal-noted"; route: Id<"route">; month: number; reason: RefusalReason }
  /** A deception ban (route-gates:deception-bans-country): the route is refused until `until`, then known again. */
  | { type: "route/banned"; route: Id<"route">; until: number }
  /**
   * An application resting on a bond was withdrawn, or a dependant's grant not
   * yet used was voided (person:joint-collapses-with-bond): back to known with
   * no application, the fee kept, `refunded` pence of surcharge returned.
   */
  | { type: "route/withdrawn"; route: Id<"route">; refunded: number }
  /** A sponsor was looked for and none answered this month (route-gates:sponsor-offers-come-up): nothing moves but the line. */
  | { type: "route/sponsor-missed"; route: Id<"route"> }
  | { type: "route/unbanned"; route: Id<"route"> };

/**
 * news.test.ts stands in for the route kind with the stub's `route/moved`
 * event and reads `to` from any `RouteEvent`, so the name keeps meaning that
 * one event; the route kind's own events are `RouteKindEvent`.
 */
export type RouteEvent = Extract<RouteKindEvent, { type: "route/moved" }>;
