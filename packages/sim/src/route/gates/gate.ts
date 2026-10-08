// A gate is the part of a route that differs between the study route and the
// others: the steps between known and applying, what applying needs, and which
// terms the decision reads (docs/rules/route-gates.md R-GATE-001 and 002). The
// route kind dispatches on the entry's `gate` to one module from this folder;
// each module owns its own file and nothing else.
import type { BaseEvent, Cause, Ctx, Effect, EffectType, ForeignCurrency, Id, ReadCtx, RouteEntry, RouteGate, RouteGateState, RouteGateView, RouteState } from "../../engine/types";
import type { RefusalReason } from "../route.events";

/** Which of R-ROUTE-016's terms the decision reads for this gate (R-GATE-002). The floor and ceiling always apply. */
export interface DecisionTerms {
  strictness: boolean;
  unexplained: boolean;
  refusals: boolean;
  interview: boolean;
  goodGrade: boolean;
}

export interface Decision {
  terms: DecisionTerms;
  /** A refusal that happens whatever the draw says (a fraud sponsor, a fraud agent), with its reason. */
  override: RefusalReason | null;
  /** Whether a refusal from the override bans every route into the country (R-GATE-005). */
  bans: boolean;
  /** True: nothing is decided this month, and the gate is asked again next month (R-PEOPLE-023, 027). Missing: false. */
  wait?: boolean;
  /** Basis points added to the route's base before the floor and ceiling (R-INTERVIEW-009's doubt). Missing: 0. */
  addBp?: number;
}

export type GateEffectHandler = (ctx: Ctx, effect: Effect, cause: Cause) => BaseEvent[];

export interface Gate {
  gate: RouteGate;
  /** The named steps between known and applying, in order (R-GATE-001). */
  steps: readonly string[];
  /** The gate's own state on a fresh route. */
  initial(): RouteGateState;
  /** R-GATE-001: whether the named step is reached, for the requirement `route/gate-step`. */
  reached(read: ReadCtx, entry: RouteEntry, held: RouteState, step: string): boolean;
  /** The gate's own conditions on `route/apply`, beyond the slot's requirements and the window. */
  mayApply(ctx: Ctx, entry: RouteEntry, held: RouteState, cause: Cause): boolean;
  /** What the decision reads (R-GATE-002) and any override. */
  decision(read: ReadCtx, entry: RouteEntry, held: RouteState): Decision;
  /** Monthly work for one route in the `clocks` phase, run before the shared decision. */
  clocks?(ctx: Ctx, entry: RouteEntry): BaseEvent[];
  /** Effects this gate carries out. The dispatcher merges them into the kind's table. */
  effects?: Partial<Record<EffectType, GateEffectHandler>>;
  /** The figures an application records on the day it is sent (R-ROUTE-014). Missing: the study gate's UK figures. */
  application?(read: ReadCtx, entry: RouteEntry, held: RouteState): ApplicationFigures;
  /** The funds the route asks to see, in its own currency (R-ROUTE-009). Missing: the study gate's tuition and living line. Null: the route shows no funds. */
  funds?(read: ReadCtx, entry: RouteEntry, held: RouteState): { required: number; currency: ForeignCurrency } | null;
  /** The job the character holds on arrival (R-SPONSOR-007, R-CONTRACT-004). Missing or null: none. */
  departureJob?(entry: RouteEntry, held: RouteState): Id<"activity"> | null;
  /** Effects to apply once the application is recorded (the dependant gate pays its fee from the lead's route). */
  onSend?(ctx: Ctx, entry: RouteEntry, cause: Cause): void;
  /** Effects to apply as the character departs, after the move and the status (the study gate opens the tuition). */
  onDepart?(ctx: Ctx, entry: RouteEntry, held: RouteState, cause: Cause): void;
  /** The gate's part of the route's view. Missing: null. */
  view?(read: ReadCtx, entry: RouteEntry, held: RouteState): RouteGateView | null;
}

export interface ApplicationFigures {
  strictness: number;
  /** What the application paid in surcharge, refunded on a refusal (R-ROUTE-018). Pence. */
  surchargePaid: number;
  decisionMonths: number;
}

export const EVERY_TERM: DecisionTerms = { strictness: true, unexplained: true, refusals: true, interview: true, goodGrade: true };
export const NO_TERM: DecisionTerms = { strictness: false, unexplained: false, refusals: false, interview: false, goodGrade: false };
