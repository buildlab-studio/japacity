// A gate is the part of a route that differs between the study route and the
// others: the steps between known and applying, what applying needs, and which
// terms the decision reads (docs/rules/route-gates.md R-GATE-001 and 002). The
// route kind dispatches on the entry's `gate` to one module from this folder;
// each module owns its own file and nothing else.
import type { BaseEvent, Cause, Ctx, Effect, EffectType, ReadCtx, RouteEntry, RouteGate, RouteGateState, RouteState } from "../../engine/types";
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
}

export const EVERY_TERM: DecisionTerms = { strictness: true, unexplained: true, refusals: true, interview: true, goodGrade: true };
export const NO_TERM: DecisionTerms = { strictness: false, unexplained: false, refusals: false, interview: false, goodGrade: false };
