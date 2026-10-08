// A requirement as a short sentence, for "why not". It names what is needed
// from the requirement's own data and content's names. It never judges
// whether the requirement holds: the view's `missing` list already says so.
import type { Amount, Id, Requirement, RouteStateName } from "@japacity/sim";

import { formatBand, formatBp, formatMoney, formatNumber } from "./format";
import { AGE, yearsOf } from "./quality";
import { hasWords, lowerFirst, nameOf, runningName, say, sayCount } from "./text";

/** What the sentence may read from the view to say more than the requirement alone. */
export interface SentenceContext {
  /** Each route's state now, so a step already passed reads as done, not as "not yet". */
  routes?: readonly { id: Id<"route">; state: RouteStateName }[];
}

// The order a route moves through. Refused is off the line, so it is never "past" a step.
const ROUTE_ORDER: readonly RouteStateName[] = ["unknown", "heard", "known", "applying", "granted", "departed"];

/** The route's state now, when it has already gone past every state the requirement names. */
function passedState(requirement: Extract<Requirement, { type: "route/state" }>, context: SentenceContext): RouteStateName | null {
  const now = context.routes?.find((route) => route.id === requirement.route)?.state;
  const furthest = Math.max(...requirement.in.map((state) => ROUTE_ORDER.indexOf(state)));
  return now !== undefined && furthest >= 0 && ROUTE_ORDER.indexOf(now) > furthest ? now : null;
}

/**
 * True when the requirement is unmet because the step is already behind the
 * player: the route has moved past it, or the paper is already held or on its way.
 */
export function alreadyDone(requirement: Requirement, context: SentenceContext = {}): boolean {
  if (requirement.type === "document/absent") return true;
  return requirement.type === "route/state" && passedState(requirement, context) !== null;
}

function routeStateSentence(requirement: Extract<Requirement, { type: "route/state" }>, context: SentenceContext): string {
  const now = passedState(requirement, context);
  if (now !== null) return say("ui.req.route-state-past", { route: nameOf(requirement.route), state: lowerFirst(say(`ui.route.state.${now}`)) });
  const single = requirement.in.length === 1 ? `ui.req.route-state.${requirement.in[0] ?? ""}` : null;
  if (single !== null && hasWords(single)) return say(single, { route: runningName(requirement.route) });
  return say("ui.req.route-state", { route: nameOf(requirement.route), states: routeStates(requirement.in) });
}

const ENGLISH_RESULT = "document.english-test";

function amountWords(amount: Amount, currency: Parameters<typeof formatMoney>[1]): string {
  return typeof amount === "number" ? formatMoney(amount, currency) : say("ui.req.some-amount");
}

function qualityValue(quality: string, value: number): string {
  const label = `${quality}.value.${String(value)}`;
  return hasWords(label) ? say(label) : formatNumber(value);
}

function list(names: readonly string[]): string {
  return names.join(say("ui.req.or"));
}

function routeStates(states: readonly RouteStateName[]): string {
  return list(states.map((state) => say(`ui.route.state.${state}`)));
}

export function requirementSentence(requirement: Requirement, context: SentenceContext = {}): string {
  switch (requirement.type) {
    case "quality/min": {
      if (requirement.quality === AGE) return say("ui.req.age-min", { years: yearsOf(requirement.value) });
      const label = `${requirement.quality}.value.${String(requirement.value)}`;
      // Levels with names read better as "Degree grade: Second class upper or better".
      if (hasWords(label)) return say("ui.req.quality-min-label", { quality: nameOf(requirement.quality), value: say(label) });
      return say("ui.req.quality-min", { quality: nameOf(requirement.quality), value: requirement.value });
    }
    case "quality/max":
      if (requirement.quality === AGE) return say("ui.req.age-max", { years: yearsOf(requirement.value) });
      return say("ui.req.quality-max", {
        quality: nameOf(requirement.quality),
        value: qualityValue(requirement.quality, requirement.value),
      });
    case "job/any":
      return say("ui.req.job-any");
    case "job/none":
      return say("ui.req.job-none");
    case "job/is":
      return say("ui.req.job-is", { jobs: list(requirement.activities.map(runningName)) });
    case "activity/tenure":
      return requirement.activities.length === 0
        ? sayCount("ui.req.tenure-any", requirement.months, { months: requirement.months })
        : sayCount("ui.req.tenure", requirement.months, { months: requirement.months, jobs: list(requirement.activities.map(runningName)) });
    case "document/held":
      if (requirement.min === undefined) return say("ui.req.document-held", { document: nameOf(requirement.document) });
      if (requirement.document === ENGLISH_RESULT) {
        return say("ui.req.document-held-band", { document: nameOf(requirement.document), band: formatBand(requirement.min) });
      }
      return say("ui.req.document-held-min", { document: nameOf(requirement.document), value: requirement.min });
    case "document/absent":
      return say("ui.req.document-absent", { document: runningName(requirement.document) });
    case "document/pending":
      return say("ui.req.document-pending", { document: nameOf(requirement.document) });
    case "route/state":
      return routeStateSentence(requirement, context);
    case "route/offer":
      return say("ui.req.route-offer", { route: runningName(requirement.route) });
    case "route/deposit":
      return say("ui.req.route-deposit", { route: runningName(requirement.route) });
    case "route/funds":
      return sayCount("ui.req.route-funds", requirement.heldMonths, { route: runningName(requirement.route), months: requirement.heldMonths });
    case "route/unexplained-max":
      return say("ui.req.route-unexplained", { route: runningName(requirement.route), percent: formatBp(requirement.bp) });
    case "money/min": {
      const amount = amountWords(requirement.amount, requirement.currency);
      return requirement.pocket === undefined
        ? say("ui.req.money-min", { amount })
        : say("ui.req.money-min-pocket", { amount, pocket: say(`ui.pocket.${requirement.pocket}`) });
    }
    case "money/can-pay":
      return say("ui.req.money-can-pay", { amount: amountWords(requirement.amount, requirement.currency) });
    case "var/min":
      return say("ui.req.var-min", { var: nameOf(requirement.var), value: requirement.value });
    case "var/max":
      return say("ui.req.var-max", { var: nameOf(requirement.var), value: requirement.value });
    case "month/min":
      return say("ui.req.month-min", { value: requirement.value });
    case "chapter/done":
      return say("ui.req.chapter-done", { chapter: nameOf(requirement.chapter) });
    case "not":
      if (requirement.of.type === "document/pending") return say("ui.req.not-pending", { document: runningName(requirement.of.document) });
      if (requirement.of.type === "document/held") return say("ui.req.not-held", { document: runningName(requirement.of.document) });
      return say("ui.req.not", { inner: requirementSentence(requirement.of, context) });
    case "any":
      return say("ui.req.any", { inner: list(requirement.of.map((inner) => requirementSentence(inner, context))) });
    // Whole-life requirements (docs/rules/place.md and after). Plain first drafts.
    case "place/is":
      return say("ui.req.place-is", { where: say(`ui.place.${requirement.where}`) });
    case "status/is":
      return say("ui.req.status-is", { statuses: list(requirement.statuses.map(runningName)) });
    case "status/clock-under":
      return say("ui.req.status-clock-under", { months: requirement.months });
    case "credit/min":
      return say("ui.req.credit-min", { value: requirement.value });
    case "goal/done":
      return say("ui.req.goal-done", { goal: nameOf(requirement.goal) });
    case "era/is":
      return say("ui.req.era-is", { eras: list(requirement.eras.map(nameOf)) });
    case "obligation/has":
      return say("ui.req.obligation-has", { type: say(`ui.obligation.type.${requirement.obligationType}`) });
    case "route/gate-step":
      return say("ui.req.route-gate-step", { route: nameOf(requirement.route), step: requirement.step });
    case "activity/local-tenure":
      return sayCount("ui.req.local-tenure", requirement.months, { months: requirement.months });
    case "setpiece/answered": {
      const times = requirement.times ?? 1;
      return sayCount("ui.req.setpiece-answered", times, { setpiece: nameOf(requirement.setpiece), times });
    }
    case "setpiece/answered-with":
      return say("ui.req.setpiece-answered-with", { setpiece: nameOf(requirement.setpiece) });
    case "world/lottery":
      return say(requirement.online ? "ui.req.world-lottery-online" : "ui.req.world-lottery-offline");
    case "wallet/total":
      return say(requirement.flow === "in" ? "ui.req.wallet-total-in" : "ui.req.wallet-total-out", { amount: amountWords(requirement.amount, requirement.currency), reason: requirement.reason.replaceAll("-", " ") });
    case "place/returned":
      return requirement.shapes.length === 0
        ? say("ui.req.place-returned")
        : say("ui.req.place-returned-shapes", { shapes: list(requirement.shapes.map((shape) => say(`ui.place.shape.${shape}`))) });
    case "place/months-here":
      return sayCount("ui.req.place-months-here", requirement.months, { months: requirement.months, where: say(`ui.place.${requirement.where}`) });
    default: {
      const never: never = requirement;
      throw new Error(`No sentence for the requirement ${JSON.stringify(never)}.`);
    }
  }
}

/**
 * The paths of an `any` requirement as the player reads them: one sentence
 * each, with a run of routes that must reach the same state said once
 * ("A visa granted on one of: ..."). Empty for any other requirement.
 */
export function anyOptions(requirement: Requirement, context: SentenceContext = {}): string[] {
  if (requirement.type !== "any") return [];
  const sentences: string[] = [];
  const routes = requirement.of.filter((inner): inner is Extract<Requirement, { type: "route/state" }> => inner.type === "route/state");
  const together = routes.length > 1 && routes.every((inner) => inner.in.join() === routes[0]?.in.join());
  let saidRoutes = false;
  for (const inner of requirement.of) {
    if (together && inner.type === "route/state") {
      if (!saidRoutes) sentences.push(say("ui.req.routes-state", { states: routeStates(inner.in), routes: routes.map((route) => nameOf(route.route)).join(", ") }));
      saidRoutes = true;
    } else sentences.push(requirementSentence(inner, context));
  }
  return sentences;
}
