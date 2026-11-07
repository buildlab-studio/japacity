// A job's pay a month: the one figure the offer, the Jobs app and the jobs list show (docs/rules/world.md
// world:one-action-one-sheet). Content keeps a job abroad's pay a year and a job at home a
// month; the simulation pays the year over twelve (abroad-money:salary-abroad-taxed-locally), and so does this.
import { content } from "@japacity/content";
import { int, type Id, type MoneyParam } from "@japacity/sim";

import { formatMoney } from "./format";
import { say } from "./text";

const MONTHS_A_YEAR = 12;

/** The month's pay of a job in content, before tax; null for a job with no figure of its own (a sponsor's salary). */
export function payAMonth(job: string): MoneyParam | null {
  const entry = content.activity[job as Id<"activity">];
  const pay = entry?.pay;
  if (entry === undefined || pay === null || pay === undefined || typeof pay.amount !== "number") return null;
  // Content holds a job abroad's pay a year (activity.pay.ts paidYearly).
  const amount = entry.where === "abroad" ? int.divFloor(pay.amount, MONTHS_A_YEAR) : pay.amount;
  return { currency: pay.currency, amount };
}

/**
 * The pay line a screen shows for a job held, a side job or a job offered: the view's month as the wallet will book it
 * (wallet:view-carries-month-pay: after tax, with the raise, the tier and the sponsor's salary), never content's
 * written figure; null when the view can read none. A boat rung's is its base, said as depending on the catch
 * (activity:catch-drawn-each-month).
 */
export function payLine(pay: MoneyParam | null | undefined, job: string | null = null): string | null {
  if (pay === null || pay === undefined) return null;
  const caught = job !== null && content.activity[job as Id<"activity">]?.catch === true;
  return say(caught ? "ui.job.pay.catch" : "ui.job.pay", { amount: formatMoney(pay.amount, pay.currency) });
}
