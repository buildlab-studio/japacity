// The endorsement gate: docs/rules/route-gates.md R-ENDORSE-001 to 003. The
// endorsing body's letter is a document the document kind issues; the gate
// decides in `clocks`, the month it is issued, whether the body really backs
// the character, and keeps the month of a refusal for the cooldown.
import { emit } from "../../engine/kind";
import type { BaseEvent, Ctx, Id, ReadCtx, RouteEntry, RouteGateState, RouteState } from "../../engine/types";
import type { RouteKindEvent } from "../route.events";
import type { Gate } from "./gate";

type EndorsementBlock = NonNullable<RouteEntry["endorsement"]>;
type EndorsementState = Extract<RouteGateState, { gate: "endorsement" }>;

const PORTFOLIO: Id<"quality"> = "quality.portfolio";
const NETWORK: Id<"quality"> = "quality.network";
/** The step `activity.apply-endorsement` needs: no refusal, or its cooldown run (R-ENDORSE-002). */
export const COOLED = "cooled";

function blockOf(entry: RouteEntry): EndorsementBlock {
  if (entry.endorsement === undefined) throw new Error(`${entry.id} runs the endorsement gate with no endorsement block.`);
  return entry.endorsement;
}

function gateOf(held: RouteState): EndorsementState {
  return held.gate?.gate === "endorsement" ? held.gate : { gate: "endorsement", endorsementRefusedMonth: null };
}

/**
 * The figure R-ENDORSE-001 asks of a quality, read from the route's own
 * checklist. the points above 3 and above 50 in R-ENDORSE-002 are the
 * bars of R-ENDORSE-001, which the checklist holds, so the chance reads them
 * there rather than keeping a copy in code or in the endorsement block.
 */
function barOf(entry: RouteEntry, quality: Id<"quality">): number {
  for (const item of entry.checklist) {
    if (item.requirement.type === "quality/min" && item.requirement.quality === quality) return item.requirement.value;
  }
  throw new Error(`${entry.id} has no checklist bar for ${quality}.`);
}

/**
 * R-ENDORSE-002: `baseBp`, plus `perPortfolioBp` for each portfolio point
 * above the bar, plus `perNetworkBp` for each network point above the bar,
 * never above `capBp`.
 */
export function endorsementChanceBp(read: ReadCtx, route: Id<"route">): number {
  const entry = read.content.route[route];
  if (entry === undefined) throw new Error(`The content has no route ${route}.`);
  const block = blockOf(entry);
  const portfolio = Math.max(0, (read.state.quality[PORTFOLIO] ?? 0) - barOf(entry, PORTFOLIO));
  const network = Math.max(0, (read.state.quality[NETWORK] ?? 0) - barOf(entry, NETWORK));
  return Math.min(block.capBp, block.baseBp + block.perPortfolioBp * portfolio + block.perNetworkBp * network);
}

/**
 * The document was issued this month: held, no copy being made, and running
 * out exactly `validMonths` from now. A copy granted between turns runs out a
 * month earlier than that from the next clocks, so it is never judged twice.
 */
function issuedNow(ctx: Ctx, document: Id<"document">): boolean {
  const held = ctx.state.document[document];
  const valid = ctx.content.document[document]?.validMonths ?? null;
  return held !== undefined && held.state === "held" && held.readyMonth === null && valid !== null && held.expiresMonth === ctx.state.turn.month + valid;
}

/**
 * R-ENDORSE-002: one draw on `visa` the month the letter is issued. A refusal
 * voids it at once and starts the cooldown.
 *
 * the page says the route "records a refusal with the reason
 * `endorsement`". The shared `route/refused` moves the route from applying to
 * known, and a route asking for an endorsement is known, so that arrow does
 * not exist (R-ROUTE-001). The refusal lives in the gate's state instead: it
 * is not added to `refusals`, so R-ENDORSE-003's earlier refusals do not count
 * it, and `lastRefusal` does not show it. Should it count?
 */
function clocks(ctx: Ctx, entry: RouteEntry): BaseEvent[] {
  const block = blockOf(entry);
  const held = ctx.state.route[entry.id];
  if (held === undefined || held.state !== "known" || !issuedNow(ctx, block.document)) return [];
  const read: ReadCtx = { state: ctx.state, world: ctx.world, content: ctx.content };
  if (ctx.random.chance("visa", endorsementChanceBp(read, entry.id))) return [];
  const event: RouteKindEvent = {
    type: "route/gate-updated",
    route: entry.id,
    gate: { gate: "endorsement", endorsementRefusedMonth: ctx.state.turn.month },
    note: "endorsement-refused",
  };
  const events = emit(ctx, "route", [event]);
  ctx.apply([{ type: "document/void", document: block.document }], { source: entry.id, param: null, terms: {} });
  return events;
}

export const endorsementGate: Gate = {
  gate: "endorsement",
  steps: [COOLED],
  initial: () => ({ gate: "endorsement", endorsementRefusedMonth: null }),
  /**
   * R-ENDORSE-002: `cooled` holds with no refusal on record, or from `cooldown`
   * months after the refusal's month.
   *
   * `activity.apply-endorsement` does not read this step, so the
   * cooldown does not yet hold the activity back. It needs one more
   * requirement in content: `{ type: "route/gate-step", route: TALENT, step: "cooled" }`.
   */
  reached: (read, entry, held, step) => {
    if (step !== COOLED) return false;
    const refused = gateOf(held).endorsementRefusedMonth;
    return refused === null || read.state.turn.month >= refused + blockOf(entry).cooldown;
  },
  // R-ENDORSE-003: the endorsement held and in date.
  mayApply: (ctx, entry) => ctx.check({ type: "document/held", document: blockOf(entry).document }).met,
  // R-ENDORSE-003: earlier refusals only, on the route's own base.
  decision: () => ({ terms: { strictness: false, unexplained: false, refusals: true, interview: false, goodGrade: false }, override: null, bans: false }),
  clocks,
};
