// A requirement as a short sentence, for "why not". It names what is needed
// from the requirement's own data and content's names. It never judges
// whether the requirement holds: the view's `missing` list already says so.
import type { Amount, Requirement, RouteStateName } from "@japacity/sim";

import { formatBand, formatBp, formatMoney, formatNumber } from "./format";
import { hasWords, nameOf, say } from "./text";

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

export function requirementSentence(requirement: Requirement): string {
  switch (requirement.type) {
    case "quality/min": {
      const label = `${requirement.quality}.value.${String(requirement.value)}`;
      // Levels with names read better as "Degree grade: Second class upper or better".
      if (hasWords(label)) return say("ui.req.quality-min-label", { quality: nameOf(requirement.quality), value: say(label) });
      return say("ui.req.quality-min", { quality: nameOf(requirement.quality), value: requirement.value });
    }
    case "quality/max":
      return say("ui.req.quality-max", {
        quality: nameOf(requirement.quality),
        value: qualityValue(requirement.quality, requirement.value),
      });
    case "job/any":
      return say("ui.req.job-any");
    case "job/none":
      return say("ui.req.job-none");
    case "job/is":
      return say("ui.req.job-is", { jobs: list(requirement.activities.map(nameOf)) });
    case "activity/tenure":
      return requirement.activities.length === 0
        ? say("ui.req.tenure-any", { months: requirement.months })
        : say("ui.req.tenure", { months: requirement.months, jobs: list(requirement.activities.map(nameOf)) });
    case "document/held":
      if (requirement.min === undefined) return say("ui.req.document-held", { document: nameOf(requirement.document) });
      if (requirement.document === ENGLISH_RESULT) {
        return say("ui.req.document-held-band", { document: nameOf(requirement.document), band: formatBand(requirement.min) });
      }
      return say("ui.req.document-held-min", { document: nameOf(requirement.document), value: requirement.min });
    case "document/absent":
      return say("ui.req.document-absent", { document: nameOf(requirement.document) });
    case "document/pending":
      return say("ui.req.document-pending", { document: nameOf(requirement.document) });
    case "route/state":
      return say("ui.req.route-state", { route: nameOf(requirement.route), states: routeStates(requirement.in) });
    case "route/offer":
      return say("ui.req.route-offer", { route: nameOf(requirement.route) });
    case "route/deposit":
      return say("ui.req.route-deposit", { route: nameOf(requirement.route) });
    case "route/funds":
      return say("ui.req.route-funds", { route: nameOf(requirement.route), months: requirement.heldMonths });
    case "route/unexplained-max":
      return say("ui.req.route-unexplained", { route: nameOf(requirement.route), percent: formatBp(requirement.bp) });
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
      return say("ui.req.not", { inner: requirementSentence(requirement.of) });
    case "any":
      return say("ui.req.any", { inner: list(requirement.of.map(requirementSentence)) });
    default: {
      const never: never = requirement;
      throw new Error(`No sentence for the requirement ${JSON.stringify(never)}.`);
    }
  }
}
