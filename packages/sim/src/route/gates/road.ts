// The road: docs/rules/road.md R-ROAD-001 to 012, under the fifteen rules of
// docs/brainstorm/02 section 6. The chain runs in `clocks`.
//
// The gate's state carries the step, the months at it and, before the chain
// starts, the money the men will ask for. Its notes name lines `line.route.<note>`.
// Nothing here names a place, a price or a method beyond the page's stylised
// steps.
import { divFloor } from "../../engine/int";
import { emit } from "../../engine/kind";
import type { BaseEvent, Cause, Content, Ctx, Effect, Id, PlayerView, ReadCtx, RouteEntry, RouteGateState, RouteState } from "../../engine/types";
import type { RouteKindEvent } from "../route.events";
import type { Gate } from "./gate";
import { NO_TERM } from "./gate";

type RoadState = Extract<RouteGateState, { gate: "road" }>;
type RoadStep = NonNullable<RouteEntry["road"]>["steps"][number];
type RoadStepEffect = Extract<Effect, { type: "route/road-step" }>;

const NIGHT: Id<"setpiece"> = "setpiece.road-night";
const TRUTH: Id<"setpiece"> = "setpiece.road-truth";
const RANSOM: Id<"offer"> = "offer.road-ransom-call";
/** R-ROAD-007: the way out, open every month on the road. */
const EXIT_OFFER: Id<"offer"> = "offer.road-exit";
const AGENT_DEBT: Id<"obligation"> = "obligation.agent-debt";
const FAMILY_MEANS: Id<"quality"> = "quality.family-means";
const STANDING: Id<"quality"> = "quality.standing";
/** R-ROAD-009: where the sea step ends, and the status it ends in. The route entry has no country or status (R-ROAD-001). */
const FAR_SHORE: Id<"country"> = "country.italy";
const IRREGULAR: Id<"status"> = "status.eu-irregular";
/** R-ROAD-006: the step whose `held` opens the agent's debt. */
const COMPOUND = "compound";

/** The steps before the chain, in order (R-ROAD-003 to 005). */
const BEFORE = ["night", "truth"] as const;
/** Ended steps that carry the real-story card until the next month's clocks (R-ROAD-011). */
const CARD_STEPS: readonly string[] = ["turned-back", "exit", "lost", "arrived"];
/** Ended steps that settle quietly into `over` in the next month's clocks. */
const SETTLING: readonly string[] = ["turned-back", "exit", "arrived", "fraud"];
const OVER = "over";

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

function initialRoad(): RoadState {
  return { gate: "road", step: null, monthsHere: 0, debt: 0 };
}

function roadOf(held: RouteState): RoadState {
  return held.gate?.gate === "road" ? held.gate : initialRoad();
}

function chainOf(entry: RouteEntry): RoadStep[] {
  if (entry.road === undefined) throw new Error(`${entry.id} is a road route with no outcome tables.`);
  return entry.road.steps;
}

/** Every step from the night meeting to the sea, in order. */
function orderOf(entry: RouteEntry): string[] {
  return [...BEFORE, ...chainOf(entry).map((step) => step.id)];
}

/** The road route of the content. One effect type has one handler, and the effect names no route. */
function roadEntry(content: Content): RouteEntry {
  const entry = Object.values(content.route).find((candidate) => candidate.gate === "road");
  if (entry === undefined) throw new Error("The content has no road route.");
  return entry;
}

function heldOf(read: ReadCtx, entry: RouteEntry): RouteState {
  const held = read.state.route[entry.id];
  if (held === undefined) throw new Error(`The state holds no route ${entry.id}.`);
  return held;
}

/** R-ROAD-003: a real-ish connection, kept hidden on the route's secret. */
function realish(held: RouteState): boolean {
  // the route's only hidden field is `secret.sponsorFraud`, so the road keeps "the connection is real-ish"
  // there; R-ROAD-003 wants a hidden kind of its own on the route (`secret.roadKind`, or a hidden field on the gate state).
  return held.secret.sponsorFraud === true;
}

/** The chain has begun and not ended: from the night meeting to the sea (R-ROAD-012 keeps the pitches away). */
export function underway(entry: RouteEntry, held: RouteState): boolean {
  const step = roadOf(held).step;
  return step !== null && orderOf(entry).includes(step);
}

function monthsOnRoad(read: ReadCtx): number {
  const { place, turn } = read.state;
  return place.where === "road" ? turn.month - place.movedMonth : 0;
}

// ---------------------------------------------------------------------------
// Changing the gate
// ---------------------------------------------------------------------------

/** R-ROAD-010: the route kind tells a road gate's notes in tone `bad`. */
function update(ctx: Ctx, entry: RouteEntry, gate: RoadState, note: string | null, secret?: RouteState["secret"]): BaseEvent[] {
  const event: RouteKindEvent =
    secret === undefined ? { type: "route/gate-updated", route: entry.id, gate, note } : { type: "route/gate-updated", route: entry.id, gate, note, secret };
  return emit(ctx, "route", [event]);
}

/** R-ROAD-005: the route's way from where it stands to `applying`, by the page's arrows. */
const TO_APPLYING: Partial<Record<RouteState["state"], RouteState["state"][]>> = {
  unknown: ["heard", "known", "applying"],
  heard: ["known", "applying"],
  known: ["applying"],
};

/** R-ROAD-005: the route is `applying` while the chain runs. */
function setApplying(ctx: Ctx, entry: RouteEntry): BaseEvent[] {
  const path = TO_APPLYING[heldOf(ctx, entry).state] ?? [];
  const moves = path.map((to): RouteKindEvent => ({ type: "route/moved", route: entry.id, to }));
  return emit(ctx, "route", moves);
}

/** The chain is over: the route is known again, so a pitch may come once more. */
function setKnown(ctx: Ctx, entry: RouteEntry): BaseEvent[] {
  if (heldOf(ctx, entry).state !== "applying") return [];
  const known: RouteKindEvent = { type: "route/moved", route: entry.id, to: "known" };
  return emit(ctx, "route", [known]);
}

function causeOf(entry: RouteEntry): Cause {
  return { source: entry.id, param: null, terms: {} };
}

/** R-ROAD-008: the ending. Final for the character; the authority may still grant turns that nothing uses. */
function lose(ctx: Ctx, entry: RouteEntry): BaseEvent[] {
  const months = monthsOnRoad(ctx);
  const events = [...update(ctx, entry, { gate: "road", step: "lost", monthsHere: months, debt: 0 }, "road-lost"), ...setKnown(ctx, entry)];
  ctx.apply([{ type: "turn/finish" }], causeOf(entry));
  return events;
}

/**
 * R-ROAD-007: the assisted return from any step after the truth, standing by
 * R-RETURN-002. The agent's debt is an obligation `where: any`, so it stays open
 * in naira. At the truth itself the character has not left yet, so the return
 * finds them at home and does nothing.
 */
function exit(ctx: Ctx, entry: RouteEntry, note: string): BaseEvent[] {
  const months = monthsOnRoad(ctx);
  ctx.apply([{ type: "place/return", shape: "assisted" }], causeOf(entry));
  return [...update(ctx, entry, { gate: "road", step: "exit", monthsHere: months, debt: 0 }, note), ...setKnown(ctx, entry)];
}

/** R-ROAD-009: `on` from the last step. The debt stays open; cash work only comes with the status. */
function arrive(ctx: Ctx, entry: RouteEntry): BaseEvent[] {
  const months = monthsOnRoad(ctx);
  ctx.apply(
    [
      { type: "place/move", to: "abroad", country: FAR_SHORE },
      { type: "status/grant", status: IRREGULAR },
    ],
    causeOf(entry),
  );
  return [...update(ctx, entry, { gate: "road", step: "arrived", monthsHere: months, debt: 0 }, "road-arrived"), ...setKnown(ctx, entry)];
}

/**
 * R-ROAD-006: whether a step's time is up after `months` there. A step lasts a
 * whole number of months drawn evenly from its range: before the least it is
 * not up, at the most it is, and between them it is up with one chance in the
 * months left to the most, a draw on `road`. drawn month by month so
 * the length needs no field of its own, and a range of 0 is up on arrival.
 */
function timeUp(ctx: Ctx, step: RoadStep, months: number): boolean {
  const [least, most] = step.months;
  if (months < least) return false;
  if (months >= most) return true;
  return ctx.random.int("road", most - months + 1) === 0;
}

/**
 * Enters the step at `index`, or arrives past the last. a step whose
 * drawn length is 0 months (the compound may be) is passed by with no outcome
 * draw, and the chain goes straight to the step after it.
 */
function enter(ctx: Ctx, entry: RouteEntry, index: number): BaseEvent[] {
  const steps = chainOf(entry);
  const step = steps[index];
  if (step === undefined) return arrive(ctx, entry);
  if (step.months[0] === 0 && timeUp(ctx, step, 0)) return enter(ctx, entry, index + 1);
  return update(ctx, entry, { gate: "road", step: step.id, monthsHere: 0, debt: 0 }, `road-${step.id}`);
}

/**
 * R-ROAD-006: a held month. Every `held` brings the ransom call to the family;
 * the compound's also opens the agent's debt for the call's sum, so the debt
 * is what the men say is owed whether or not the family pays, and an unpaid
 * call adds the sum again (`cannot` in content opens the same debt, which
 * grows it). the call is opened first so its drawn sum is the debt's.
 */
function hold(ctx: Ctx, entry: RouteEntry, step: RoadStep, months: number): BaseEvent[] {
  const events = update(ctx, entry, { gate: "road", step: step.id, monthsHere: months, debt: 0 }, "road-held");
  const cause = causeOf(entry);
  ctx.apply([{ type: "offer/open", offer: RANSOM }], cause);
  const call = Object.values(ctx.state.offer.items).find((item) => item.entry === RANSOM && item.openedMonth === ctx.state.turn.month);
  const sum = call?.terms.sum;
  if (step.id === COMPOUND && typeof sum === "number") ctx.apply([{ type: "obligation/open", obligation: AGENT_DEBT, principal: sum }], cause);
  return events;
}

/**
 * R-ROAD-006: the outcome draw on `road` from the step's row. A real-ish
 * connection halves `held` (road.md, "Entries"). the half taken off
 * `held` goes to `on`, so the row still adds up to 10000.
 */
export function outcomeOf(step: RoadStep, halved: boolean, roll: number): "on" | "held" | "turned" | "lost" {
  const held = halved ? divFloor(step.held, 2) : step.held;
  const on = step.on + step.held - held;
  if (roll < on) return "on";
  if (roll < on + held) return "held";
  if (roll < on + held + step.turned) return "turned";
  return "lost";
}

/**
 * Whether the last month was a held one at this step: the ransom call every
 * `held` opens was opened last month. read from the offer record so
 * the gate needs no flag of its own; a held month is followed by an outcome
 * draw, never by more waiting out the step's time.
 */
function heldLastMonth(read: ReadCtx): boolean {
  return read.state.offer.lastOpened[RANSOM] === read.state.turn.month - 1;
}

/** One month at a step of the chain (R-ROAD-006). */
function chainMonth(ctx: Ctx, entry: RouteEntry, held: RouteState, gate: RoadState, index: number): BaseEvent[] {
  const step = chainOf(entry)[index];
  if (step === undefined) throw new Error(`${entry.id} has no step ${String(gate.step)}.`);
  const months = gate.monthsHere + 1;
  if (!heldLastMonth(ctx) && !timeUp(ctx, step, months)) return update(ctx, entry, { ...gate, monthsHere: months }, null);
  if (step.on + step.held + step.turned + step.lost !== 10000) throw new Error(`${entry.id} step ${step.id} does not add up to 10000.`);
  const outcome = outcomeOf(step, realish(held), ctx.random.int("road", 10000));
  switch (outcome) {
    case "on":
      return enter(ctx, entry, index + 1);
    case "held":
      return hold(ctx, entry, step, months);
    case "turned":
      return exit(ctx, entry, "road-turned");
    case "lost":
      return lose(ctx, entry);
    default: {
      const never: never = outcome;
      throw new Error(`Unknown outcome ${String(never)}.`);
    }
  }
}

/** Opens a set piece of the chain unless one is open already; the gate tries again next month (R-ENGINE-011). */
function openScene(ctx: Ctx, entry: RouteEntry, setpiece: Id<"setpiece">): void {
  if (ctx.state.setpiece.open !== null) return;
  ctx.apply([{ type: "setpiece/open", setpiece, route: null }], causeOf(entry));
}

// ---------------------------------------------------------------------------
// The clocks phase
// ---------------------------------------------------------------------------

/**
 * R-ROAD-004 to 006 and 011, month by month: a scene not yet open opens, the
 * chain takes its month, and an ended chain settles. A fraud is told a month
 * after the deposit went (R-ROAD-003); the other ends keep the real-story card
 * for the month they happened in.
 */
function clocks(ctx: Ctx, entry: RouteEntry): BaseEvent[] {
  const held = heldOf(ctx, entry);
  const gate = roadOf(held);
  const step = gate.step;
  if (step === null || step === OVER || step === "lost") return [];
  if (step === "night") {
    openScene(ctx, entry, NIGHT);
    return [];
  }
  // The truth comes a month after the bus leaves (R-ROAD-004: the months pass while you wait).
  if (step === "truth") {
    if (ctx.state.setpiece.open?.entry !== TRUTH) openScene(ctx, entry, TRUTH);
    return [];
  }
  if (SETTLING.includes(step)) return update(ctx, entry, { ...gate, step: OVER }, step === "fraud" ? "road-fraud" : null);
  const index = chainOf(entry).findIndex((candidate) => candidate.id === step);
  if (index < 0) throw new Error(`${entry.id} is at an unknown step ${step}.`);
  const events = chainMonth(ctx, entry, held, gate, index);
  // R-ROAD-007: every month still on the road, the way out is on the table.
  if (ctx.state.place.where === "road" && ctx.content.offer[EXIT_OFFER] !== undefined) ctx.apply([{ type: "offer/open", offer: EXIT_OFFER }], causeOf(entry));
  return events;
}

// ---------------------------------------------------------------------------
// The effect: route/road-step
// ---------------------------------------------------------------------------

/**
 * R-ROAD-003: a pitch taken that is not a fraud. The offer kind's draw on
 * `road` hands over the kind as the term `kind`; the deposit is the term
 * `deposit`. the `more` the truth asks for (R-ROAD-005) is the deposit
 * again, kept as the gate's `debt` until the truth: the page names no figure
 * for it, and a term on the pitch would show it in the offer's view.
 */
function night(ctx: Ctx, entry: RouteEntry, cause: Cause): BaseEvent[] {
  const deposit = cause.terms.deposit;
  const more = typeof deposit === "number" ? deposit : 0;
  const events = update(ctx, entry, { gate: "road", step: "night", monthsHere: 0, debt: more }, null, { sponsorFraud: cause.terms.kind === "realish" });
  openScene(ctx, entry, NIGHT);
  return events;
}

/**
 * R-ROAD-005: paying or calling home sets the character on the road. Paying
 * takes the money asked from cash. what cash cannot cover is not
 * waved through; it opens as the agent's debt, the money the men say you owe.
 * Calling home takes family means, one point for each ₦100,000; the stake and
 * the standing are the answer's own effects in content. Then the home
 * obligations stop, the job at home ends, and the first step begins.
 * The route is `applying` for the chain's remaining steps.
 */
function setOff(ctx: Ctx, entry: RouteEntry, gate: RoadState, how: "pay" | "call-home"): BaseEvent[] {
  const cause = causeOf(entry);
  const more = gate.debt;
  const effects: Effect[] = [];
  if (how === "pay") {
    const paid = Math.min(more, ctx.state.wallet.pockets.NGN.cash);
    if (paid > 0) effects.push({ type: "money/take", currency: "NGN", pocket: "cash", amount: paid, reason: "fee-agent" });
    if (more > paid) effects.push({ type: "obligation/open", obligation: AGENT_DEBT, principal: more - paid });
  } else {
    // R-ROAD-005: family means fall one point for each `meansStep` the family pays.
    const fall = divFloor(more, ctx.content.tuning.road.meansStep);
    if (fall > 0) effects.push({ type: "quality/add", quality: FAMILY_MEANS, amount: -fall });
  }
  effects.push(
    { type: "place/move", to: "road", country: null },
    // R-ROAD-005: the home obligations are suspended; the family house takes them up again on return (R-PLACE-007).
    { type: "obligation/close", obligationType: "upkeep" },
    { type: "obligation/close", obligationType: "support" },
    // a job at home cannot be held from the road.
    { type: "activity/end-job", why: "road" },
  );
  ctx.apply(effects, cause);
  return [...setApplying(ctx, entry), ...enter(ctx, entry, 0)];
}

/**
 * `route/road-step`: the pitch, the night meeting and the truth move the chain
 * through this effect. A step that does not follow from where the chain is
 * does nothing (R-GATE-001).
 */
function roadStep(ctx: Ctx, effect: Effect, cause: Cause): BaseEvent[] {
  if (effect.type !== "route/road-step") throw new Error(`route/road-step cannot carry out ${effect.type}.`);
  const entry = roadEntry(ctx.content);
  const held = heldOf(ctx, entry);
  const gate = roadOf(held);
  const step: RoadStepEffect["step"] = effect.step;
  switch (step) {
    case "night":
      return underway(entry, held) ? [] : night(ctx, entry, cause);
    // R-ROAD-003: money gone, nothing follows; the line comes a month later.
    case "fraud":
      return underway(entry, held) ? [] : update(ctx, entry, { gate: "road", step: "fraud", monthsHere: 0, debt: 0 }, null);
    // R-ROAD-004: `go`. The truth opens in next month's clocks.
    case "truth":
      return gate.step === "night" ? update(ctx, entry, { ...gate, step: "truth" }, "road-go") : [];
    // R-ROAD-004: `turn-back` costs the deposit already paid; the standing is the answer's own effect.
    case "turned-back":
      return gate.step === "night" ? update(ctx, entry, { gate: "road", step: "turned-back", monthsHere: 0, debt: 0 }, "road-turned-back") : [];
    case "pay":
    case "call-home":
      return gate.step === "truth" ? setOff(ctx, entry, gate, step) : [];
    // R-ROAD-005 and 007: the way out, at the truth or on the road.
    case "exit":
      return underway(entry, held) && gate.step !== "night" ? exit(ctx, entry, "road-exit") : [];
    default:
      throw new Error(`The road has no step ${step}.`);
  }
}

// ---------------------------------------------------------------------------
// A formal flight
// ---------------------------------------------------------------------------

/**
 * R-ROAD-005 and 012: the road sets off from home. A formal flight taken
 * after the pitch and before setting off ends the chain where it stands,
 * quietly, as a fraud does: the deposit is the only loss, and an answer to a
 * scene still open moves nothing.
 */
// the page is silent on a flight between the pitch and the truth; the kinder reading lets the visa win.
// The open scene closes unscored (the effect setpiece/close).
export function endBeforeSettingOff(ctx: Ctx): BaseEvent[] {
  const entry = Object.values(ctx.content.route).find((candidate) => candidate.gate === "road");
  const held = entry === undefined ? undefined : ctx.state.route[entry.id];
  if (entry === undefined || held === undefined) return [];
  const step = roadOf(held).step;
  if (step === null || !(BEFORE as readonly string[]).includes(step)) return [];
  const events = update(ctx, entry, { gate: "road", step: OVER, monthsHere: 0, debt: 0 }, null);
  // R-ROAD-004: a scene left open would block every turn abroad.
  ctx.apply([{ type: "setpiece/close", setpiece: NIGHT }, { type: "setpiece/close", setpiece: TRUTH }], causeOf(entry));
  return events;
}

// ---------------------------------------------------------------------------
// The view
// ---------------------------------------------------------------------------

/**
 * R-ROAD-008 and 011: once the chain ends, the card is the real-story card, or
 * on the ending the ending card, which carries it too. the card holds
 * for the month the chain ended in and settles at the next month's clocks; the
 * ending never settles. A fraud never began the chain and shows none. The
 * credits are the content's `road.real-story.*` keys.
 */
export function roadCard(read: ReadCtx): PlayerView["card"] {
  for (const entry of Object.values(read.content.route)) {
    const held = read.state.route[entry.id];
    if (entry.gate !== "road" || held === undefined) continue;
    const gate = roadOf(held);
    if (gate.step === null || !CARD_STEPS.includes(gate.step)) continue;
    return {
      kind: gate.step === "lost" ? "lost" : "real-story",
      route: entry.id,
      percent: null,
      months: gate.monthsHere,
      standing: read.state.quality[STANDING] ?? 0,
      topActivities: [],
      chapter: read.state.chapter.current,
      // R-SHARE-002: the road's cards carry no name.
      name: null,
    };
  }
  return null;
}

export const roadGate: Gate = {
  gate: "road",
  steps: [...BEFORE, "desert", "compound", "coast", "sea"],
  initial: initialRoad,
  // R-GATE-001: a step is reached while the chain is at it or past it and has not ended.
  reached: (_read, entry, held, step) => {
    const order = orderOf(entry);
    const at = order.indexOf(roadOf(held).step ?? "");
    const want = order.indexOf(step);
    return at >= 0 && want >= 0 && at >= want;
  },
  // R-ROAD-001: no application and no decision draw.
  mayApply: () => false,
  decision: () => ({ terms: NO_TERM, override: null, bans: false }),
  clocks,
  effects: { "route/road-step": roadStep },
  funds: () => null,
  // R-ROAD-001 keeps the road out of the routes view, so this part is never shown; the chain is seen
  // through `place.where`, the report lines and the card. A card for the chain under way needs a place in the view.
  view: (_read, _entry, held) => {
    const gate = roadOf(held);
    return { gate: "road", step: gate.step, monthsHere: gate.monthsHere };
  },
};
