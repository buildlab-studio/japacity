// The waiting months' figures in words (docs/rules/activity.md R-ACTIVITY-013 and 014): the route each act
// counts toward, and a side job's pay by level and the band that lifts it. The words table is profile.words.ts.
import { content } from "@japacity/content";
import type { ActivityTier, Id, MoneyParam, PlayerView } from "@japacity/sim";

import { formatMoney } from "./format";
import { requirementSentence } from "./requirement";
import { bandOpening, hasWords, lowerFirst, nameOf, say } from "./text";

function qualityOf(view: Pick<PlayerView, "qualities">, id: string): number {
  return view.qualities.find((quality) => quality.id === id)?.value ?? 0;
}

function figure(tier: ActivityTier): number {
  return typeof tier.pay.amount === "number" ? tier.pay.amount : 0;
}

/**
 * A side job's pay a month now, as the simulation pays it (activity.pay.ts `tierFigure`, R-ACTIVITY-014): the
 * best-paying tier whose figure the character meets, else the entry's own pay. Null for a job with no figure.
 */
export function tierPay(view: Pick<PlayerView, "qualities">, job: string): MoneyParam | null {
  const entry = content.activity[job as Id<"activity">];
  if (entry === undefined || entry.pay === null || typeof entry.pay.amount !== "number") return null;
  const met = (entry.tiers ?? []).filter((tier) => qualityOf(view, tier.min.quality) >= tier.min.value).map(figure);
  return { currency: entry.pay.currency, amount: Math.max(entry.pay.amount, ...met) };
}

/** The tier that lifts the pay next: of the tiers not met that pay more than now, the one that pays least. */
export function nextTier(view: Pick<PlayerView, "qualities">, job: string): ActivityTier | null {
  const now = tierPay(view, job);
  const entry = content.activity[job as Id<"activity">];
  if (now === null || entry === undefined) return null;
  const ahead = (entry.tiers ?? []).filter((tier) => qualityOf(view, tier.min.quality) < tier.min.value && figure(tier) > now.amount);
  return ahead.reduce<ActivityTier | null>((best, tier) => (best === null || figure(tier) < figure(best) ? tier : best), null);
}

/**
 * R-ACTIVITY-014: the pay words with what lifts them next, "₦60,000 a month; ₦90,000 once your tech is good",
 * or the pay words alone when no tier is ahead.
 */
export function withNextTier(view: Pick<PlayerView, "qualities">, job: string, payWords: string): string {
  const lift = liftWords(view, job);
  return lift === null ? payWords : say("ui.tier.next", { pay: payWords, lift });
}

/** R-ACTIVITY-014: what lifts a side job's pay next, "₦90,000 once your tech is good", or null when nothing does. */
export function liftWords(view: Pick<PlayerView, "qualities">, job: string): string | null {
  const next = nextTier(view, job);
  return next === null || typeof next.pay.amount !== "number" ? null : tierWords(next);
}

/**
 * A tier's pay with the band its quality opens it at, never the figure (R-TEXT-005):
 * "₦90,000 once your tech is good". The band is the lowest whose every value meets the tier, so the words
 * never promise the pay to someone it does not reach.
 */
export function tierWords(tier: ActivityTier): string {
  const next = typeof tier.pay.amount === "number" ? formatMoney(tier.pay.amount, tier.pay.currency) : say("ui.req.some-amount");
  const band = bandOpening(tier.min.quality, tier.min.value);
  if (band !== null) return say("ui.tier.lift", { next, band: lowerFirst(say(`ui.band.${tier.min.quality}.${String(band)}`)) });
  return say("ui.tier.lift-needs", { next, needs: lowerFirst(requirementSentence({ type: "quality/min", quality: tier.min.quality, value: tier.min.value })) });
}

/** R-ACTIVITY-013: "Counts toward: the talent route", the routes the activity's entry counts toward, or null with none. */
export function countsWords(id: string): string | null {
  const routes = content.activity[id as Id<"activity">]?.counts ?? [];
  if (routes.length === 0) return null;
  const named = routes.map((route) => (hasWords(`ui.counts.route.${route}`) ? say(`ui.counts.route.${route}`) : lowerFirst(nameOf(route))));
  const list = named.length === 1 ? (named[0] ?? "") : `${named.slice(0, -1).join(", ")} ${say("ui.counts.and")} ${named.at(-1) ?? ""}`;
  return say("ui.counts.toward", { routes: list });
}
