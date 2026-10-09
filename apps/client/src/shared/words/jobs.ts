// The jobs' words and figures the list, the hunt's card and the offer share (docs/rules/world.md R-WORLD-006): a
// job's pay a month, its chance in words, and the words table itself. In shared/ so the city and the activity
// feature both read them without one feature importing another.
import { content, text } from "@japacity/content";
import type { ActivityEntry, Id, PlayerView } from "@japacity/sim";

import { formatMoney } from "./format";
import { payAMonth } from "./pay";
import { tierPay, withNextTier } from "./profile";
import { hasWords, say, type Params } from "./text";

export const jobsUiText: Record<string, string> = {
  "jobs.pick": "Which job",
  "jobs.apply": "Apply",
  "jobs.pay": "{amount} a month",
  "jobs.chance.likely": "Likely",
  "jobs.chance.fair": "A fair chance",
  "jobs.chance.long": "A long shot",
  "jobs.out-of-reach": "Not open to you yet",
  "jobs.needs": "Needs: {needs}",
  "jobs.needs-count": "Needs {count} things first",
  "jobs.needs-count.one": "Needs 1 thing first",
  "jobs.card": "{pay}. {chance}.",
  "jobs.card.chance": "{chance}.",
};

/** Words for a jobs key: content's first, then the interface's, then the list's own drafts. */
export function jobsWords(key: string, params: Params = {}): string {
  if (text[key] !== undefined || hasWords(key)) return say(key, params);
  const template = jobsUiText[key] ?? key;
  return template.replace(/\{([A-Za-z][\w-]*)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined || typeof value === "object" ? whole : String(value);
  });
}

const NETWORK = "quality.network";

/** From 60% a month a hunt is likely, from 30% a fair chance, and below that a long shot. */
const LIKELY_BP = 6000;
const FAIR_BP = 3000;

export type ChanceBand = "likely" | "fair" | "long";

export function chanceBand(bp: number): ChanceBand {
  if (bp >= LIKELY_BP) return "likely";
  if (bp >= FAIR_BP) return "fair";
  return "long";
}

/**
 * A month's chance of the hunt landing this job, as the hunt rolls it (activity.logic.ts hireChanceBp, R-ACTIVITY-005):
 * the job's own chance plus the network's share, under the cap. The remote-hiring boom's bonus is the world's and is
 * not in the view, so the remote job may read a band low while it lasts.
 */
export function jobChanceBp(entry: Pick<ActivityEntry, "hireBp">, network: number): number {
  const { networkHireBp, hireMaxBp } = content.tuning.quality;
  return Math.min(hireMaxBp, (entry.hireBp ?? 0) + networkHireBp * network);
}

function qualityOf(view: PlayerView, id: string): number {
  return view.qualities.find((quality) => quality.id === id)?.value ?? 0;
}

export function chanceOf(view: PlayerView, id: string): number {
  const entry = content.activity[id as Id<"activity">];
  return entry === undefined ? 0 : jobChanceBp(entry, qualityOf(view, NETWORK));
}

/** A job's pay a month in words; with the view, a side job paid by level says the tier it is paid at now (R-ACTIVITY-014). */
export function payWords(id: string, view?: Pick<PlayerView, "qualities">): string | null {
  const tiered = view !== undefined && (content.activity[id as Id<"activity">]?.tiers ?? []).length > 0;
  const pay = tiered ? tierPay(view, id) : payAMonth(id);
  return pay === null ? null : jobsWords("jobs.pay", { amount: formatMoney(pay.amount, pay.currency) });
}

/** The pay now and what lifts it next, in one run of words: "₦60,000 a month; ₦90,000 at tech 50" (R-ACTIVITY-014). */
export function payLiftWords(id: string, view: Pick<PlayerView, "qualities">): string | null {
  const pay = payWords(id, view);
  return pay === null ? null : withNextTier(view, id, pay);
}

/**
 * A job's pay a month and its chance in words, as its row on the list says them, for the hunt's card when a
 * board or a notice names the job.
 */
export function jobCardWords(view: PlayerView, id: string): string {
  const chance = jobsWords(`jobs.chance.${chanceBand(chanceOf(view, id))}`);
  const pay = payLiftWords(id, view);
  return pay === null ? jobsWords("jobs.card.chance", { chance }) : jobsWords("jobs.card", { pay, chance });
}
