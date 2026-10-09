// The waiting months' words (docs/rules/activity.md R-ACTIVITY-013 and 014): the route each act counts
// toward as a person says it, the labels of the things that stage the acts, and a side job's pay by level.
// First drafts in the voice of docs/rules/text.md; content's table wins over these.
import { content, text } from "@japacity/content";
import type { ActivityTier, Id, MoneyParam, PlayerView } from "@japacity/sim";

import { formatMoney, formatNumber } from "./format";

export const profileText: Record<string, string> = {
  // "Counts toward: the talent route" (R-ACTIVITY-013).
  "ui.counts.toward": "Counts toward: {routes}",
  "ui.counts.and": "and",
  "ui.counts.route.route.uk-masters": "the study visa",
  "ui.counts.route.route.uk-talent": "the talent route",
  "ui.counts.route.route.uk-care": "care work in the UK",
  "ui.counts.route.route.uk-skilled": "the skilled worker visa",
  "ui.counts.route.route.canada-points": "Canada's points",
  "ui.counts.route.route.gulf-contract": "the Gulf contract",
  "ui.counts.route.route.road": "the road",

  // R-ACTIVITY-014: "₦60,000 a month; ₦90,000 at tech 50".
  "ui.tier.next": "{pay}; {lift}",
  "ui.tier.lift": "{next} at {quality} {value}",
  "ui.tier.quality.quality.tech": "tech",
  "ui.tier.quality.quality.english": "English",
  "ui.tier.quality.quality.network": "network",

  // The things and acts that stage them (R-WORLD-005).
  "city.thing.laptops": "Laptops",
  "city.act.post": "Post about your work",
  "city.act.post.done": "You write a thread on what you built. It counts when the month ends.",
  "city.act.talk": "Give the talk",
  "city.act.certify": "Certification",
  "city.act.exam": "Sit the exam",
};

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

/** Words for a profile key: content's first, then these drafts. Kept here so this file reads no other words file. */
function profileWords(key: string, params: Record<string, string>): string {
  const template = text[key] ?? profileText[key] ?? key;
  return template.replace(/\{([A-Za-z][\w-]*)\}/g, (whole, name: string) => params[name] ?? whole);
}

/**
 * R-ACTIVITY-014: the pay words with what lifts them next, "₦60,000 a month; ₦90,000 at tech 50", or the
 * pay words alone when no tier is ahead.
 */
export function withNextTier(view: Pick<PlayerView, "qualities">, job: string, payWords: string): string {
  const lift = liftWords(view, job);
  return lift === null ? payWords : profileWords("ui.tier.next", { pay: payWords, lift });
}

/** R-ACTIVITY-014: what lifts a side job's pay next, "₦90,000 at tech 50", or null when nothing does. */
export function liftWords(view: Pick<PlayerView, "qualities">, job: string): string | null {
  const next = nextTier(view, job);
  if (next === null || typeof next.pay.amount !== "number") return null;
  const quality = profileWords(`ui.tier.quality.${next.min.quality}`, {});
  return profileWords("ui.tier.lift", { next: formatMoney(next.pay.amount, next.pay.currency), quality, value: formatNumber(next.min.value) });
}
