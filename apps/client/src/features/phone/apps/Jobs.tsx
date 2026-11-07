// Jobs (world:phone-rises-over-scene): the job held and the job offers the view lists. Quitting
// and taking each open their own card, which sends `activity/quit` or `offer/choose`. In the game's look
// (docs/design/09-the-games-look.md section 2): each job a card with its picture, the pay as a green chip and the time to
// answer as a word in a pill, the offer picked ringed in yellow, and one yellow button at the foot that repeats the pick.
import { content } from "@japacity/content";
import type { Id, OfferView, PassbookRoad, PlayerView } from "@japacity/sim";
import { MapPin } from "lucide-react";
import { type ReactNode, use, useState } from "react";

import { useGame, useView } from "../../../authority/GameProvider";
import { payLine } from "../../../shared/words/pay";
import { tierPay, withNextTier } from "../../../shared/words/profile";
import { byMonths, hasWords, lowerFirst, monthsAgo, nameOf, say, sayCount, words } from "../../../shared/words/text";
import { PhoneNav } from "../../../shared/phone/nav";
import { PressButton } from "../../../shared/ui/look/PressButton";
import { metNeeds, NeedChips } from "../../../shared/ui/NeedChips";
import { Head, useAsk } from "../act";
import { openJobs } from "../context";
import { ladderRung, roadAcross } from "../ladder";
import { jobOffers } from "../seen";
import { GhostButton, MoneyChip, PicCard, PicTile, WordChip } from "../ui";

/**
 * A job's pay a month as words: the view's figure as the wallet will book it (wallet:view-carries-month-pay), or null when the view
 * reads none. A side job paid by level adds what lifts it next (activity:side-jobs-pay-by-tier).
 */
function payWords(job: Id<"activity">, pay: OfferView["pay"] | PlayerView["job"]["pay"], view: Pick<PlayerView, "qualities">): string | null {
  const said = payLine(pay, job);
  if (said === null) return null;
  return (content.activity[job]?.tiers ?? []).length > 0 ? withNextTier(view, job, said) : said;
}

/**
 * The held job's pay with the raise from being noticed, and when it came: "Raised last month" (activity:waiting-months-build-profile).
 * Null words when the job has no raise.
 */
function raiseWords(view: Pick<PlayerView, "job" | "month">): string | null {
  const raise = view.job.raise;
  if (raise === undefined) return null;
  return raise.month === null ? say("phone.jobs.raised.unknown") : say("phone.jobs.raised", { when: lowerFirst(monthsAgo(raise.month, view.month)) });
}

/** activity:naira-pay-reviewed-yearly: the months to the held job's next pay review, "Pay review in 5 months"; null for a job not reviewed. */
function reviewWords(view: Pick<PlayerView, "job">): string | null {
  const months = view.job.review;
  return months === undefined ? null : sayCount("phone.jobs.review", months, { count: months });
}

/** A side job to take while none is held: the passbook's side road (wallet:roads-to-the-target). */
function sideRoad(view: Pick<PlayerView, "job" | "passbook">): PassbookRoad | null {
  if (view.job.side !== null) return null;
  return view.passbook?.roads.find((each) => each.road === "side" && each.state !== "taken") ?? null;
}

/** What a road still asks, as chips (world:one-action-one-sheet), or that the board can be asked now; null for a road shut on nothing listed. */
function roadLine(view: Pick<PlayerView, "routes" | "job">, road: PassbookRoad): ReactNode {
  if (road.state === "open") return <p>{say("phone.jobs.rung.open")}</p>;
  if (road.needs.length === 0) return null;
  return (
    <div data-rung-needs>
      <NeedChips needs={road.needs} met={metNeeds(road.via, road.needs)} view={view} />
    </div>
  );
}

/** A rung or a side job to reach for: its picture, name and pay, and what it still asks. */
function RoadRow({ road, pay, line, data }: { road: PassbookRoad; pay: string | null; line: ReactNode; data: "rung" | "side" }) {
  return (
    <PicCard
      pic={road.via}
      tint="study"
      title={nameOf(road.via)}
      line={line}
      chips={pay === null ? null : <MoneyChip className="whitespace-normal">{pay}</MoneyChip>}
      {...(data === "rung" ? { "data-job-rung": road.via } : { "data-job-side-road": road.via })}
    />
  );
}

/** A written pay a month as words, for a job not held. */
function writtenPay(job: Id<"activity">): OfferView["pay"] {
  const pay = content.activity[job]?.pay;
  return pay === undefined || pay === null || typeof pay.amount !== "number" ? undefined : { currency: pay.currency, amount: pay.amount };
}

const HUNT = "activity.job-hunt";
/** The line a job asked for this month leaves, with the job as its `param` (activity:now-acts-and-month-acts). */
const APPLIED_LINE = "line.activity.job-hunt.now";

/**
 * The jobs asked for this month and not yet answered: the hunt done this month, and the
 * month's lines that name each job. The answer comes with the month's end, as an offer or a "not this time".
 */
function appliedJobs(view: Pick<PlayerView, "activities" | "job">, monthLines: readonly { key: string; params: Record<string, unknown> }[]): Id<"activity">[] {
  if (view.activities.find((option) => option.id === HUNT)?.done !== true) return [];
  const asked = monthLines.filter((line) => line.key === APPLIED_LINE).map((line) => line.params["param"]);
  return [...new Set(asked.filter((job): job is Id<"activity"> => typeof job === "string" && job !== view.job.id && content.activity[job as Id<"activity">] !== undefined))];
}

/** "Applied: Staff nurse at the clinic. They answer at the month's end.": the place that stages the job, where there is one. */
function appliedLine(job: Id<"activity">): string {
  const place = Object.values(content.place).find((entry) => entry.stages.includes(job));
  return place === undefined ? say("phone.jobs.applied", { job: nameOf(job) }) : say("phone.jobs.applied-at", { job: nameOf(job), place: nameOf(place.id) });
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

/** The place in the city whose board the hunt is done at, or null where none stands. */
function boardPlace(): Id<"place"> | null {
  return Object.values(content.place).find((entry) => entry.where === "home" && entry.stages.includes(HUNT))?.id ?? null;
}

/** While no offer waits: the board where jobs go up, and the way to it on the map (world:phone-holds-what-phones-hold: a visit opens the map). */
function Board() {
  const nav = use(PhoneNav);
  const place = boardPlace();
  if (place === null || nav.openMap === undefined) return null;
  // The hub as the briefs name it ("the hub"), else the place's own name.
  const brief = `chapter.brief.at.${place.replace(/^place\./, "")}`;
  const name = hasWords(brief) ? lowerFirst(say(brief)) : nameOf(place);
  return (
    <PicCard
      pic={HUNT}
      tint="study"
      title={say("phone.jobs.board", { place: name })}
      line={say("phone.jobs.board.line")}
      foot={
        <GhostButton wide onClick={() => nav.openMap?.(place)} data-jobs-board={place}>
          <MapPin size={18} aria-hidden />
          {say("phone.jobs.board.go", { place: name })}
        </GhostButton>
      }
    />
  );
}

/** The job held as a card: its picture, its name, the pay as a green chip, its lines, and the small act at its side. */
function JobRow({ id, name, pay, lines, review = null, act, actLabel }: { id: Id<"activity">; name: string; pay: string | null; lines: (string | null)[]; review?: string | null; act: (() => void) | null; actLabel: string }) {
  return (
    <PicCard
      pic={id}
      tint="money"
      title={name}
      line={
        <>
          {lines.filter((line): line is string => line !== null).map((line) => (
            <p key={line}>{line}</p>
          ))}
          {review === null ? null : <p data-job-review>{review}</p>}
        </>
      }
      chips={pay === null ? null : <MoneyChip className="whitespace-normal">{pay}</MoneyChip>}
      side={
        act === null ? null : (
          <button type="button" onClick={act} className="phone-ghost press min-h-10 px-3 text-[14px]">
            {actLabel}
          </button>
        )
      }
      data-job-row
    />
  );
}

/** An offer as a card to pick: the picked one ringed in yellow, its pay as a green chip and when to answer in a pill. */
function OfferRow({ job, name, pay, answer, on, onPick, id }: { job: Id<"activity"> | null; name: string; pay: string | null; answer: string; on: boolean; onPick: () => void; id: string }) {
  return (
    <li data-offer={id}>
      <button type="button" role="radio" aria-checked={on} onClick={onPick} className="press block w-full text-left">
        <PicCard
          {...(job === null ? {} : { pic: job })}
          tint="money"
          title={name}
          chips={
            <>
              {pay === null ? null : <MoneyChip className="whitespace-normal">{pay}</MoneyChip>}
              <WordChip tone={on ? "soft" : "study"}>{answer}</WordChip>
            </>
          }
          picked={on}
        />
      </button>
    </li>
  );
}

export function Jobs() {
  const view = useView();
  const { open, sheet } = useAsk();
  const job = view.job.id;
  const side = view.job.side;
  const offers = jobOffers(view);
  const onBoard = openJobs(view);
  const applied = appliedJobs(view, useGame((state) => state.monthLines));
  const raised = raiseWords(view);
  const review = reviewWords(view);
  const rung = ladderRung(view);
  const across = roadAcross(view, rung);
  const acrossPay = across === null ? null : payLine(writtenPay(across) ?? null, across);
  const sideToTake = sideRoad(view);
  const months = sayCount("ui.job.months", view.job.months, { months: view.job.months });
  // The offer picked: the first until another is tapped.
  const [picked, setPicked] = useState<string | null>(null);
  const chosen = offers.find((offer) => offer.id === picked) ?? offers[0];
  const offerName = (offer: OfferView): string => {
    const offered = offeredJob(offer);
    return offered === null ? words(`${offer.entry}.title`, offer.terms) : nameOf(offered);
  };

  const quit = (sideJob: boolean) => {
    const held = sideJob ? side : job;
    if (held === null) return;
    open({
      form: "card",
      icon: "briefcase",
      who: nameOf(held),
      title: say(sideJob ? "phone.jobs.quit-side.title" : "phone.jobs.quit.title"),
      line: sideJob ? say("phone.jobs.quit-side.line") : say("ui.job.quit-sure"),
      cost: null,
      button: say("ui.job.quit-yes"),
      have: 0,
      command: sideJob ? { type: "activity/quit", side: true } : { type: "activity/quit" },
      done: say("phone.jobs.left"),
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
      title: offered === null ? say("phone.jobs.take.title") : nameOf(offered),
      line: [words(`${offer.entry}.body`, offer.terms), offered === null ? null : payWords(offered, offer.pay, view)].filter((part): part is string => part !== null).join(" "),
      cost: null,
      button: say("phone.jobs.take.button"),
      have: 0,
      command: { type: "offer/choose", offer: offer.id, choice },
      done: say("phone.jobs.taken"),
    });
  };

  return (
    <div data-phone-app="jobs" className="flex flex-col gap-2">
      <Head>{say("phone.jobs.held")}</Head>
      {job === null ? (
        <div className="look-card flex items-center gap-3 p-3" data-job-none>
          <PicTile of={HUNT} size={48} tint="study" />
          <p className="min-w-0 flex-1 text-[15px] leading-snug">{say("ui.job.none")}</p>
        </div>
      ) : (
        <JobRow id={job} name={nameOf(job)} pay={payWords(job, view.job.pay, view)} lines={[raised, months]} review={review} act={view.ended ? null : () => quit(false)} actLabel={say("phone.jobs.quit")} />
      )}
      {rung === null || view.ended ? null : (
        <>
          <Head>{say("phone.jobs.rung")}</Head>
          <RoadRow road={rung} pay={payLine(writtenPay(rung.via as Id<"activity">) ?? null, rung.via)} line={roadLine(view, rung)} data="rung" />
          {across === null ? null : (
            <>
              <Head>{say("phone.jobs.across")}</Head>
              <PicCard
                pic={across}
                tint="study"
                title={nameOf(across)}
                line={<p>{say("phone.jobs.across.line")}</p>}
                chips={acrossPay === null ? null : <MoneyChip className="whitespace-normal">{acrossPay}</MoneyChip>}
                data-job-across={across}
              />
            </>
          )}
        </>
      )}
      {side === null ? null : (
        <>
          <Head>{say("phone.jobs.side")}</Head>
          <JobRow id={side} name={nameOf(side)} pay={payWords(side, view.job.sidePay, view)} lines={[]} act={view.ended ? null : () => quit(true)} actLabel={say("phone.jobs.quit")} />
        </>
      )}
      {sideToTake === null || view.ended ? null : (
        <>
          <Head>{say("phone.jobs.side")}</Head>
          <RoadRow road={sideToTake} pay={payWords(sideToTake.via as Id<"activity">, tierPay(view, sideToTake.via), view)} line={roadLine(view, sideToTake)} data="side" />
        </>
      )}

      <Head>{say("phone.jobs.offers")}</Head>
      {/* An application out is said while it waits, never "no job offers" over it. */}
      {applied.map((asked) => (
        <PicCard key={asked} pic={asked} tint="money" title={nameOf(asked)} line={<span data-job-applied={asked}>{appliedLine(asked)}</span>} />
      ))}
      {offers.length === 0 ? (
        applied.length > 0 ? null : (
          <>
            {/* The head's pill counts the jobs open on the board where no offer waits; the screen says the same count. */}
            <p className="px-0.5 text-[15px] text-text-2" data-jobs-none>
              {onBoard === 0 ? say("phone.jobs.offers.none") : say(onBoard === 1 ? "phone.jobs.offers.board.one" : "phone.jobs.offers.board", { count: onBoard })}
            </p>
            {view.ended ? null : <Board />}
          </>
        )
      ) : (
        <>
          <ul className="flex flex-col gap-2.5" role="radiogroup" aria-label={say("phone.jobs.offers")} data-job-offers>
            {offers.map((offer) => {
              const offered = offeredJob(offer);
              return (
                <OfferRow
                  key={offer.id}
                  id={offer.id}
                  job={offered}
                  name={offerName(offer)}
                  pay={offered === null ? null : payWords(offered, offer.pay, view)}
                  answer={say("phone.jobs.answer-by", { when: byMonths(offer.expiresMonth, view.month) })}
                  on={offer.id === chosen?.id}
                  onPick={() => setPicked(offer.id)}
                />
              );
            })}
          </ul>
          {/* One main button at the foot, repeating the pick: "Take · Junior developer". */}
          {chosen === undefined || view.ended || takeChoice(chosen) === null ? null : (
            <div className="sticky bottom-0 bg-sheet pt-2 pb-1">
              <PressButton className="w-full" onClick={() => take(chosen)} data-take-offer={chosen.id}>
                <span>{say("phone.jobs.take")}</span>
                {/* A space between the words, so the name a screen reader reads holds them apart (world:one-action-one-sheet). */}
                {" "}
                <span aria-hidden>·</span>{" "}
                <span className="min-w-0 truncate">{offerName(chosen)}</span>
              </PressButton>
            </div>
          )}
        </>
      )}
      {sheet}
    </div>
  );
}
