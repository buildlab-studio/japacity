// The jobs' words and figures the list, the hunt's card and the offer share (world:one-action-one-sheet): a
// job's pay a month and its chance in words, read from content's ui/ui.jobs.text.ts. In shared/ so the city and the activity
// feature both read them without one feature importing another.
import { content, text } from "@japacity/content";
import type { ActivityEntry, Id, PlayerView } from "@japacity/sim";
import { qualityIn } from "@japacity/sim";

import { type Fact, flavourOf, whenFactOf } from "./facts";
import { formatMoney } from "./format";
import { payAMonth } from "./pay";
import { tierPay, withNextTier } from "./profile";
import { say } from "./text";

const NETWORK = "quality.network";

/** From 60% a month a hunt is likely, from 30% a fair chance, and below that a long shot. */
const LIKELY_BP = 6000;
const FAIR_BP = 3000;

/** A hunt at the bar every hunt stops at is as good as certain (see `huntBand`); any other chance has the three. */
export type ChanceBand = "certain" | "likely" | "fair" | "long";

export function chanceBand(bp: number): Exclude<ChanceBand, "certain"> {
  if (bp >= LIKELY_BP) return "likely";
  if (bp >= FAIR_BP) return "fair";
  return "long";
}

/**
 * A month's chance of the hunt landing this job, as the hunt rolls it (activity.logic.ts huntChanceBp, activity:job-hunt-lands-offer):
 * the job's own chance plus the network's share and the world's `bonus`, under the cap.
 */
export function jobChanceBp(entry: Pick<ActivityEntry, "hireBp">, network: number, bonus = 0): number {
  const { networkHireBp, hireMaxBp } = content.tuning.quality;
  return Math.min(hireMaxBp, (entry.hireBp ?? 0) + networkHireBp * network + bonus);
}

/** director.md: the remote-hiring boom adds its bonus to the remote job's hire chance, under the same cap. */
const REMOTE_JOB = "activity.job-remote-developer";
const REMOTE_BONUS = "var.remote-hire-bonus";

/**
 * A world variable as the view's news holds it (rate:latest-story-sets-variable): the value the story in force that came into
 * force last sets it to, else its start. Every story that sets the remote job's bonus reverts when it ends (jobs.chance.test.ts
 * holds it), so the stories in force are the whole of it.
 */
function worldVarOf(view: Pick<PlayerView, "news">, variable: string): number {
  let value = content.var[variable as Id<"var">]?.start ?? 0;
  let since = -Infinity;
  for (const story of view.news) {
    if (story.stage !== "in-force" || story.since < since) continue;
    const set = content.news[story.id]?.standIn.sets.find((each) => each.var === variable);
    if (set === undefined) continue;
    value = set.value;
    since = story.since;
  }
  return value;
}

/**
 * The world's bonus to a job's hire chance that the view holds: the remote-hiring boom's for the remote job while it is in force.
 * The bootcamp's help to the junior developer's hunt (activity:paid-tech-courses) is the life's and is not in the view.
 */
function worldBonusOf(view: Pick<PlayerView, "news">, id: string): number {
  return id === REMOTE_JOB ? worldVarOf(view, REMOTE_BONUS) : 0;
}


/**
 * A job's chance in a hunt as a band: at the bar every hunt stops at (activity:job-hunt-lands-offer, `tuning.quality.hireMaxBp`) it is
 * as good as certain (the racks, activity:fish-racks-at-makoko), never "Likely", else the three bands.
 */
export function huntBand(bp: number): ChanceBand {
  return bp >= content.tuning.quality.hireMaxBp ? "certain" : chanceBand(bp);
}

export function chanceOf(view: PlayerView, id: string): number {
  const entry = content.activity[id as Id<"activity">];
  return entry === undefined ? 0 : jobChanceBp(entry, qualityIn(view, NETWORK), worldBonusOf(view, id));
}

/** A job's pay a month in words; with the view, a side job paid by level says the tier it is paid at now (activity:side-jobs-pay-by-tier). */
export function payWords(id: string, view?: Pick<PlayerView, "qualities">): string | null {
  const tiered = view !== undefined && (content.activity[id as Id<"activity">]?.tiers ?? []).length > 0;
  const pay = tiered ? tierPay(view, id) : payAMonth(id);
  return pay === null ? null : say("jobs.pay", { amount: formatMoney(pay.amount, pay.currency) });
}

/** The pay now and what lifts it next, in one run of words: "₦60,000 a month; ₦90,000 once your tech is good" (activity:side-jobs-pay-by-tier). */
export function payLiftWords(id: string, view: Pick<PlayerView, "qualities">): string | null {
  const pay = payWords(id, view);
  return pay === null ? null : withNextTier(view, id, pay);
}

/**
 * A job's pay a month and its chance in words, as its row on the list says them, for the hunt's card when a
 * board or a notice names the job (Peckham's notice shows pay and chance like the hub's board).
 */
export function jobCardWords(view: PlayerView, id: string): string {
  const chance = say(`jobs.chance.${huntBand(chanceOf(view, id))}`);
  const pay = payLiftWords(id, view);
  return pay === null ? say("jobs.card.chance", { chance }) : say("jobs.card", { pay, chance });
}

/**
 * A hunt's card that names one job, as a line and its facts (world:one-action-one-sheet, text:show-then-tell): the line is the job's own
 * words where content has them (`<job>.card`), else its blurb cut to what no fact says, else the hunt's; the facts are its pay a month
 * (with what lifts it next, activity:side-jobs-pay-by-tier), its own chance (activity:job-hunt-lands-offer) and when it pays where the
 * blurb said so.
 */
export function jobCardFacts(view: PlayerView, hunt: string, job: string): { line: string | null; facts: Fact[] } {
  const line = text[`${job}.card`] ?? flavourOf(job) ?? flavourOf(hunt);
  const pay = payLiftWords(job, view);
  const when = whenFactOf(job);
  const facts: Fact[] = [...(pay === null ? [] : [{ kind: "pay" as const, words: pay }]), { kind: "chance", band: huntBand(chanceOf(view, job)) }, ...(when === null ? [] : [when])];
  return { line, facts };
}

/**
 * The line of a hunt's card that names one job (world:one-action-one-sheet): the job's own words where content has them, `<job>.card`
 * else its blurb, and only then the hunt's ("You send applications"), then its pay and its own chance (activity:job-hunt-lands-offer).
 * The racks speak as the racks, never as a hunt for applications.
 */
export function jobCardLine(view: PlayerView, hunt: string, job: string): string {
  const own = text[`${job}.card`] ?? text[`${job}.blurb`] ?? text[`${hunt}.blurb`] ?? null;
  return [own, jobCardWords(view, job)].filter((part): part is string => part !== null).join(" ");
}
