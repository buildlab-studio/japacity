// The waiting months' figures in words (activity:waiting-months-build-profile and activity:side-jobs-pay-by-tier): the route each act
// counts toward, and a side job's pay by level and the band that lifts it. The words are content's ui/ui.profile.text.ts.
import { content } from "@japacity/content";
import type { ActivityTier, Id, MoneyParam, PlayerView, Requirement } from "@japacity/sim";
import { qualityIn } from "@japacity/sim";

import { formatMoney } from "./format";
import { requirementSentence, timeWords } from "./requirement";
import { bandOpening, hasWords, lowerFirst, nameOf, say } from "./text";


function figure(tier: ActivityTier): number {
  return typeof tier.pay.amount === "number" ? tier.pay.amount : 0;
}

/**
 * activity:side-jobs-pay-by-tier: a tier's need as the view can judge it. A quality is read from the view; months across a trade's jobs
 * are not in the view, so a tier that asks them is never promised from here: the held side job's pay is the view's `sidePay`.
 */
function needMet(view: Pick<PlayerView, "qualities">, need: Requirement): boolean {
  return need.type === "quality/min" && qualityIn(view, need.quality) >= need.value;
}

function tierMet(view: Pick<PlayerView, "qualities">, tier: ActivityTier): boolean {
  return tier.needs.every((need) => needMet(view, need));
}

/**
 * A side job's pay a month now, as the simulation pays it (activity.pay.ts `tierFigure`, activity:side-jobs-pay-by-tier): the
 * best-paying tier whose figure the character meets, else the entry's own pay. Null for a job with no figure.
 */
export function tierPay(view: Pick<PlayerView, "qualities">, job: string): MoneyParam | null {
  const entry = content.activity[job as Id<"activity">];
  if (entry === undefined || entry.pay === null || typeof entry.pay.amount !== "number") return null;
  const met = (entry.tiers ?? []).filter((tier) => tierMet(view, tier)).map(figure);
  return { currency: entry.pay.currency, amount: Math.max(entry.pay.amount, ...met) };
}

/** The tier that lifts the pay next: of the tiers not met that pay more than now, the one that pays least. */
export function nextTier(view: Pick<PlayerView, "qualities">, job: string): ActivityTier | null {
  const now = tierPay(view, job);
  const entry = content.activity[job as Id<"activity">];
  if (now === null || entry === undefined) return null;
  const ahead = (entry.tiers ?? []).filter((tier) => !tierMet(view, tier) && figure(tier) > now.amount);
  return ahead.reduce<ActivityTier | null>((best, tier) => (best === null || figure(tier) < figure(best) ? tier : best), null);
}

/**
 * activity:side-jobs-pay-by-tier: the pay words with what lifts them next, "₦60,000 a month; ₦90,000 once your tech is good",
 * or the pay words alone when no tier is ahead.
 */
export function withNextTier(view: Pick<PlayerView, "qualities">, job: string, payWords: string): string {
  const lift = liftWords(view, job);
  return lift === null ? payWords : say("ui.tier.next", { pay: payWords, lift });
}

/** activity:side-jobs-pay-by-tier: what lifts a side job's pay next, "₦90,000 once your tech is good", or null when nothing does. */
export function liftWords(view: Pick<PlayerView, "qualities">, job: string): string | null {
  const next = nextTier(view, job);
  return next === null || typeof next.pay.amount !== "number" ? null : tierWords(next);
}

/**
 * A tier's pay with the band its quality opens it at, never the figure (text:bands-not-figures):
 * "₦90,000 once your tech is good". The band is the lowest whose every value meets the tier, so the words
 * never promise the pay to someone it does not reach.
 */
export function tierWords(tier: ActivityTier): string {
  const next = typeof tier.pay.amount === "number" ? formatMoney(tier.pay.amount, tier.pay.currency) : say("ui.req.some-amount");
  // Each need as a person says it: a quality by its band, months across the trade's jobs as time in the trade, anything else as its requirement.
  const said = tier.needs.map((need) => {
    if (need.type === "activity/tenure") return { once: true, words: say("ui.tier.trade-months", { time: timeWords(need.months) }) };
    const band = need.type === "quality/min" ? bandOpening(need.quality, need.value) : null;
    if (need.type === "quality/min" && band !== null) return { once: true, words: lowerFirst(say(`ui.band.${need.quality}.${String(band)}`)) };
    return { once: false, words: lowerFirst(requirementSentence(need)) };
  });
  const phrases = said.map((one) => one.words);
  const joined = phrases.length <= 1 ? (phrases[0] ?? "") : `${phrases.slice(0, -1).join(", ")} ${say("ui.counts.and")} ${phrases.at(-1) ?? ""}`;
  if (said.every((one) => one.once)) return say("ui.tier.lift", { next, band: joined });
  return say("ui.tier.lift-needs", { next, needs: joined });
}

/** activity:waiting-months-build-profile: "Counts toward: the talent route", the routes the activity's entry counts toward, or null with none. */
export function countsWords(id: string): string | null {
  const routes = content.activity[id as Id<"activity">]?.counts ?? [];
  if (routes.length === 0) return null;
  const named = routes.map((route) => (hasWords(`ui.counts.route.${route}`) ? say(`ui.counts.route.${route}`) : lowerFirst(nameOf(route))));
  const list = named.length === 1 ? (named[0] ?? "") : `${named.slice(0, -1).join(", ")} ${say("ui.counts.and")} ${named.at(-1) ?? ""}`;
  return say("ui.counts.toward", { routes: list });
}
