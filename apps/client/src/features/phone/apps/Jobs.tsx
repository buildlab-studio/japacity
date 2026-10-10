// Jobs (docs/rules/world.md R-WORLD-018): the job held and the job offers the view lists. Quitting
// and taking each open their own card; the commands are the ones the month page sent.
import { content } from "@japacity/content";
import type { Id, OfferView, PlayerView } from "@japacity/sim";
import { Briefcase } from "lucide-react";

import { useGame, useView } from "../../../authority/GameProvider";
import { formatMoney } from "../../../shared/words/format";
import { payAMonth } from "../../../shared/words/pay";
import { tierPay, withNextTier } from "../../../shared/words/profile";
import { byMonths, lowerFirst, monthsAgo, nameOf, say, sayCount, words } from "../../../shared/words/text";
import { Head, useAsk } from "../act";
import { phoneWords } from "../phone.words";
import { jobOffers } from "../seen";

/**
 * A job's pay a month as words, or null when content gives no figure (R-WORLD-006: the jobs list's figure). A side
 * job paid by level says its tier's pay and what lifts it next (R-ACTIVITY-014).
 */
function payWords(job: Id<"activity">, view: Pick<PlayerView, "qualities">): string | null {
  const tiered = (content.activity[job]?.tiers ?? []).length > 0;
  const pay = tiered ? tierPay(view, job) : payAMonth(job);
  if (pay === null) return null;
  const words = say("ui.job.pay", { amount: formatMoney(pay.amount, pay.currency) });
  return tiered ? withNextTier(view, job, words) : words;
}

/**
 * The held job's pay with the raise from being noticed, and when it landed: "Raised last month" (R-ACTIVITY-013;
 * the maintainer). Null words when the job has no raise.
 */
function raiseWords(view: Pick<PlayerView, "job" | "month">): { pay: string; when: string } | null {
  const raise = view.job.raise;
  if (raise === undefined) return null;
  return {
    pay: say("ui.job.pay", { amount: formatMoney(raise.pay.amount, raise.pay.currency) }),
    when: raise.month === null ? phoneWords("phone.jobs.raised.unknown") : phoneWords("phone.jobs.raised", { when: lowerFirst(monthsAgo(raise.month, view.month)) }),
  };
}

/** Jobs' words for an application out, first drafts in the voice of docs/rules/text.md; the phone's table wins. */
const APPLIED_TEXT: Record<string, string> = {
  "phone.jobs.applied": "Applied: {job}. They answer at the month's end.",
  "phone.jobs.applied-at": "Applied: {job} at {place}. They answer at the month's end.",
};

function appliedWords(key: string, params: Record<string, string>): string {
  const said = phoneWords(key, params);
  if (said !== key) return said;
  return (APPLIED_TEXT[key] ?? key).replace(/\{([A-Za-z][\w-]*)\}/g, (whole, name: string) => params[name] ?? whole);
}

const HUNT = "activity.job-hunt";
/** The line a job asked for this month leaves, with the job as its `param` (R-ACTIVITY-015). */
const APPLIED_LINE = "line.activity.job-hunt.now";

/**
 * The jobs asked for this month and not yet answered: the hunt done this month, and the
 * month's lines that name each job. The answer comes with the month's end, as an offer or a "not this time".
 */
export function appliedJobs(view: Pick<PlayerView, "activities" | "job">, monthLines: readonly { key: string; params: Record<string, unknown> }[]): Id<"activity">[] {
  if (view.activities.find((option) => option.id === HUNT)?.done !== true) return [];
  const asked = monthLines.filter((line) => line.key === APPLIED_LINE).map((line) => line.params["param"]);
  return [...new Set(asked.filter((job): job is Id<"activity"> => typeof job === "string" && job !== view.job.id && content.activity[job as Id<"activity">] !== undefined))];
}

/** "Applied: Staff nurse at the clinic. They answer at the month's end.": the place that stages the job, where there is one. */
function appliedLine(job: Id<"activity">): string {
  const place = Object.values(content.place).find((entry) => entry.stages.includes(job));
  return place === undefined ? appliedWords("phone.jobs.applied", { job: nameOf(job) }) : appliedWords("phone.jobs.applied-at", { job: nameOf(job), place: nameOf(place.id) });
}

/** The job an offer carries, from its terms. */
function offeredJob(offer: OfferView): Id<"activity"> | null {
  const job = offer.terms.job;
  return typeof job === "string" ? (job as Id<"activity">) : null;
}

/** The choice that takes the job: `accept` where content has it, else the first allowed. */
function takeChoice(offer: OfferView): string | null {
  const accept = offer.choices.find((choice) => choice.id === "accept" && choice.allowed);
  return (accept ?? offer.choices.find((choice) => choice.allowed && choice.pick === null))?.id ?? null;
}

function JobRow({ name, lines, act, actLabel }: { name: string; lines: (string | null)[]; act: (() => void) | null; actLabel: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[6px] border border-sheet-line bg-sheet-2 p-3">
      <Briefcase size={20} className="mt-0.5 shrink-0 text-text-2" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold">{name}</p>
        {lines.map((line) => (line === null ? null : <p key={line} className="text-[13px] text-text-2">{line}</p>))}
      </div>
      {act === null ? null : (
        <button type="button" onClick={act} className="btn-dark press shrink-0 px-3 py-2 text-[13px]">
          {actLabel}
        </button>
      )}
    </div>
  );
}

export function Jobs() {
  const view = useView();
  const { open, sheet } = useAsk();
  const job = view.job.id;
  const side = view.job.side;
  const offers = jobOffers(view);
  const applied = appliedJobs(view, useGame((state) => state.monthLines));
  const raised = raiseWords(view);
  const months = sayCount("ui.job.months", view.job.months, { months: view.job.months });

  const quit = (sideJob: boolean) => {
    const held = sideJob ? side : job;
    if (held === null) return;
    open({
      form: "card",
      icon: "briefcase",
      who: nameOf(held),
      title: phoneWords(sideJob ? "phone.jobs.quit-side.title" : "phone.jobs.quit.title"),
      line: sideJob ? phoneWords("phone.jobs.quit-side.line") : say("ui.job.quit-sure"),
      cost: null,
      button: say("ui.job.quit-yes"),
      have: 0,
      command: sideJob ? { type: "activity/quit", side: true } : { type: "activity/quit" },
      done: phoneWords("phone.jobs.left"),
    });
  };

  const take = (offer: OfferView) => {
    const choice = takeChoice(offer);
    const offered = offeredJob(offer);
    if (choice === null) return;
    open({
      form: "card",
      icon: "briefcase",
      who: words(`${offer.entry}.title`, offer.terms),
      title: offered === null ? phoneWords("phone.jobs.take.title") : nameOf(offered),
      line: [words(`${offer.entry}.body`, offer.terms), offered === null ? null : payWords(offered, view)].filter((part): part is string => part !== null).join(" "),
      cost: null,
      button: phoneWords("phone.jobs.take.button"),
      have: 0,
      command: { type: "offer/choose", offer: offer.id, choice },
      done: phoneWords("phone.jobs.taken"),
    });
  };

  return (
    <div data-phone-app="jobs">
      <Head>{phoneWords("phone.jobs.held")}</Head>
      {job === null ? (
        <p className="text-[14px] text-text-2">{say("ui.job.none")}</p>
      ) : (
        <JobRow
          name={nameOf(job)}
          lines={raised === null ? [payWords(job, view), months] : [raised.pay, raised.when, months]}
          act={view.ended ? null : () => quit(false)}
          actLabel={phoneWords("phone.jobs.quit")}
        />
      )}
      {side === null ? null : (
        <>
          <Head>{phoneWords("phone.jobs.side")}</Head>
          <JobRow name={nameOf(side)} lines={[payWords(side, view)]} act={view.ended ? null : () => quit(true)} actLabel={phoneWords("phone.jobs.quit")} />
        </>
      )}

      <Head>{phoneWords("phone.jobs.offers")}</Head>
      {/* An application out is said while it waits, never "no job offers" over it. */}
      {applied.map((asked) => (
        <p key={asked} className="mb-2 rounded-[6px] border-l-4 border-signal bg-sheet-2 px-3 py-2 text-[14px]" data-job-applied={asked}>
          {appliedLine(asked)}
        </p>
      ))}
      {offers.length === 0 ? (
        applied.length > 0 ? null : <p className="text-[14px] text-text-2">{phoneWords("phone.jobs.offers.none")}</p>
      ) : (
        <ul className="flex flex-col gap-2" data-job-offers>
          {offers.map((offer) => {
            const offered = offeredJob(offer);
            return (
              <li key={offer.id} data-offer={offer.id}>
                <JobRow
                  name={offered === null ? words(`${offer.entry}.title`, offer.terms) : nameOf(offered)}
                  lines={[offered === null ? null : payWords(offered, view), phoneWords("phone.jobs.answer-by", { when: byMonths(offer.expiresMonth, view.month) })]}
                  act={view.ended || takeChoice(offer) === null ? null : () => take(offer)}
                  actLabel={phoneWords("phone.jobs.take")}
                />
              </li>
            );
          })}
        </ul>
      )}
      {sheet}
    </div>
  );
}
