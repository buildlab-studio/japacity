// The month plan: the job, the free slots, and every free-slot activity as a
// card. What is allowed, what is missing and what may be picked all come from
// the view; this screen only arranges them.
import { content } from "@japacity/content";
import type { ActivityOption, Currency, PlayerView, SlotPick } from "@japacity/sim";
import { qualityIn } from "@japacity/sim";
import { Briefcase, Lock, Plus, X } from "lucide-react";
import { useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { plannedShut } from "../../authority/store";
import { bondName, timeWith } from "../../shared/sim/person";
import { actOnCard, answersNow, pickable } from "../../shared/words/acts";
import { chipEffectsLine, chipTimeOf, freeShown } from "../../shared/words/chips";
import { Balance, pricedLabel } from "../../shared/world/Balance";
import { Button } from "../../shared/ui/Button";
import { Card, Panel } from "../../shared/ui/Panel";
import { afterPaying, plannedCosts, shortfall, type AfterPaying, type Money } from "../../shared/words/cost";
import { formatBand, formatMoney } from "../../shared/words/format";
import { lockWords, SIDE_JOB_LOCK } from "../../shared/words/locks";
import { alreadyDone, needsWords, requirementSentence, saysWhyOnCard } from "../../shared/words/requirement";
import { ENGLISH_TEST, STUDY_ENGLISH, testChance } from "../../shared/words/englishTest";
import { studyWords } from "./study";
import { PressButton } from "../../shared/ui/lively/PressButton";
import { Tile } from "../../shared/tiles/Tile";
import { blurbOf, hasWords, lowerFirst, nameOf, paramWords, say, sayCount } from "../../shared/words/text";
import { payLine } from "../../shared/words/pay";
import { localCurrency } from "../../shared/words/wayHome";
import { countsWords, withNextTier } from "../../shared/words/profile";
import { ApplyFor, firstJob, huntOrder, JobList } from "./JobList";
import { RouteList } from "./RouteList";

const ENGLISH_RESULT = "document.english-test";
const GRADE = "quality.edu-grade";

function Job() {
  const view = useView();
  const busy = useGame((state) => state.busy);
  const send = useGame((state) => state.send);
  const [confirming, setConfirming] = useState(false);
  const job = view.job.id;
  // wallet:view-carries-month-pay: the month's pay as the wallet will book it, from the view; never content's written figure.
  const pay = payLine(view.job.pay);

  return (
    <Card>
      <div className="flex items-start gap-3">
        <Briefcase size={20} className="mt-0.5 shrink-0 text-text-2" />
        <div className="flex flex-1 flex-col gap-1">
          {job === null ? (
            <p>{say("ui.job.none")}</p>
          ) : (
            <>
              <p className="font-semibold">{nameOf(job)}</p>
              {pay === null ? null : <p className="text-sm font-medium tabular-nums">{pay}</p>}
              <p className="text-sm text-text-2">{sayCount("ui.job.months", view.job.months, { months: view.job.months })}</p>
            </>
          )}
        </div>
        {job === null || confirming ? null : (
          <Button small onClick={() => setConfirming(true)} disabled={busy || view.ended}>
            {say("ui.job.quit")}
          </Button>
        )}
      </div>
      {confirming ? (
        <div className="mt-3 flex flex-col gap-2 border-t border-sheet-line pt-3">
          <p>{say("ui.job.quit-sure")}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              small
              variant="primary"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                void send({ type: "activity/quit" });
              }}
            >
              {say("ui.job.quit-yes")}
            </Button>
            <Button small onClick={() => setConfirming(false)}>
              {say("ui.job.quit-no")}
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function SideJob() {
  const view = useView();
  const busy = useGame((state) => state.busy);
  const send = useGame((state) => state.send);
  const [confirming, setConfirming] = useState(false);
  const side = view.job.side;
  if (side === null && !view.locks.some((lock) => lock.why === SIDE_JOB_LOCK)) return null;
  // activity:side-jobs-pay-by-tier, wallet:view-carries-month-pay: the side job's pay at its level now from the view, and what lifts it next.
  const pay = side === null ? null : payLine(view.job.sidePay);
  return (
    <Card data-side-job>
      {/* On a phone the quit button goes under the words, so they keep the card's width. */}
      <div className="flex flex-col gap-3 @sm:flex-row @sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3" data-side-words>
          <Briefcase size={20} className="mt-0.5 shrink-0 text-text-2" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-xs font-semibold tracking-wide text-text-2 uppercase">{say("ui.side.title")}</p>
            {side === null ? null : <p className="font-semibold">{nameOf(side)}</p>}
            {pay === null || side === null ? null : <p className="text-sm font-medium tabular-nums">{withNextTier(view, side, pay)}</p>}
            <p className="text-sm text-text-2">{say("ui.side.holds")}</p>
          </div>
        </div>
        {confirming ? null : (
          <div className="pl-8 @sm:pl-0">
            <Button small onClick={() => setConfirming(true)} disabled={busy || view.ended}>
              {say("ui.side.quit")}
            </Button>
          </div>
        )}
      </div>
      {confirming ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-sheet-line pt-3">
          <Button
            small
            variant="primary"
            disabled={busy}
            onClick={() => {
              setConfirming(false);
              void send({ type: "activity/quit", side: true });
            }}
          >
            {say("ui.side.quit-yes")}
          </Button>
          <Button small onClick={() => setConfirming(false)}>
            {say("ui.job.quit-no")}
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

/** Slots held by something this month, why, and for how long (turn:slots-can-be-locked, health:view-shows-health-warning). */
function Locks() {
  const { locks, month } = useView();
  if (locks.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 text-sm" aria-label={say("ui.locks.title")}>
      {locks.map((lock, index) => (
        <li key={`${lock.why}-${String(index)}`} data-lock={lock.why} className="flex items-start gap-2">
          <Lock size={14} className="mt-0.5 shrink-0 text-text-2" />
          <span>{lockWords(lock, month)}</span>
        </li>
      ))}
    </ul>
  );
}

function pickWords(pick: SlotPick, view: PlayerView): string {
  const named = pick.param === null ? nameOf(pick.activity) : `${nameOf(pick.activity)}: ${paramWords(pick.param)}`;
  // Time with someone names the bond it goes to (person:time-together-is-an-act).
  const bond = timeWith(view, pick.activity);
  return bond === null ? named : `${named} ${say("ui.people.time-with", { name: bondName(bond) })}`;
}

function Slots() {
  const view = useView();
  const plan = useGame((state) => state.plan);
  const setSlot = useGame((state) => state.setSlot);
  if (view.freeSlots === 0) return <p className="text-text-2">{say("ui.month.no-slots")}</p>;
  return (
    <ol className="grid gap-2 @md:grid-cols-3" aria-label={say("ui.month.plan")}>
      {plan.map((pick, index) => (
        <li
          key={index}
          className={`flex min-h-14 items-center gap-2 rounded-md border px-3 py-2 ${pick === null ? "border-dashed border-sheet-line text-text-2" : "border-ink/60 bg-sheet-2"}`}
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-[4px] bg-sheet-muted text-xs font-semibold text-ink">
            {index + 1}
          </span>
          <span className="flex-1">{pick === null ? say("ui.month.slot-empty") : pickWords(pick, view)}</span>
          {pick === null ? null : (
            <button
              type="button"
              aria-label={`${say("ui.month.slot-remove")}: ${pickWords(pick, view)}`}
              className="inline-flex size-9 items-center justify-center rounded-md hover:bg-sheet-muted"
              onClick={() => setSlot(index, null)}
            >
              <X size={16} />
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}

function gradeWords(value: number): string {
  const label = `${GRADE}.value.${String(value)}`;
  return hasWords(label) ? lowerFirst(say(label)) : String(value);
}

/**
 * Why no university can be picked: each one's minimums against the band and
 * grade held now, or that it already has the application.
 */
function noSchoolReasons(view: PlayerView): string[] {
  const english = view.documents.find((paper) => paper.id === ENGLISH_RESULT && paper.state === "held");
  const band = english?.value === null || english === undefined ? say("ui.activity.no-band") : say("ui.document.band", { band: formatBand(english.value) }).toLowerCase();
  const grade = qualityIn(view, GRADE);
  const have = `${band}, ${gradeWords(grade)}`;
  const applied = new Set(view.routes.flatMap((route) => route.schools.map((school) => school.id)));
  return Object.values(content.school).map((school) =>
    applied.has(school.id)
      ? say("ui.activity.school-applied", { school: nameOf(school.id) })
      : say("ui.activity.school-needs", { school: nameOf(school.id), band: formatBand(school.minBand), grade: gradeWords(school.minGrade), have }),
  );
}

/**
 * A cost in another money than the one lived on, more than is held of it: what it needs in that money,
 * or null. When the naira cannot buy it at the bank now (its queue holds foreign money back, wallet:foreign-fee-payment-order),
 * the card says the money and the way, never only that it cannot be paid.
 */
function foreignNeed(view: PlayerView, option: ActivityOption): { amount: number; currency: Currency; held: number } | null {
  const local = localCurrency(view);
  const cost = option.cost.find((each) => each.currency !== local);
  if (cost === undefined) return null;
  const held = view.pockets[cost.currency].bank + view.pockets[cost.currency].cash;
  return cost.amount > held ? { amount: cost.amount - held, currency: cost.currency, held } : null;
}

/** A money's name mid-sentence: "pounds". */
function moneyName(currency: Currency): string {
  return lowerFirst(say(`ui.currency.${currency}`));
}

function foreignWords(need: { amount: number; currency: Currency; held: number }): string {
  return say(need.held > 0 ? "ui.activity.needs-foreign-more" : "ui.activity.needs-foreign", { amount: formatMoney(need.amount, need.currency), currency: moneyName(need.currency) });
}

/**
 * Which figure is short when an allowed activity cannot be paid for: the same figure the button
 * says, counting what the month's plan already pays for (world:one-action-one-sheet). With nothing short by the
 * screen's count but the engine still saying no, it says so plainly and names no figure.
 */
function cannotPayWords(view: PlayerView, option: ActivityOption, planned: readonly Money[], paying: AfterPaying | null): string {
  const costs = option.cost.map((cost) => formatMoney(cost.amount, cost.currency)).join(" + ");
  const foreign = paying === null || paying.short === null ? foreignNeed(view, option) : null;
  if (foreign !== null) return foreignWords(foreign);
  if (paying === null || paying.short === null) return say("ui.activity.cannot-pay");
  const short = formatMoney(paying.short.amount, paying.short.currency);
  const gap = shortfall(view, [...planned, ...option.cost]);
  if (gap.foreign) return say("ui.activity.short-foreign", { short, cost: costs, naira: formatMoney(gap.need, "NGN"), have: formatMoney(gap.have, "NGN") });
  const plannedNaira = shortfall(view, planned).need;
  if (plannedNaira > 0) return say("ui.activity.short-planned", { short, cost: costs, planned: formatMoney(plannedNaira, "NGN"), have: formatMoney(gap.have, "NGN") });
  return say("ui.activity.short", { short, cost: costs, have: formatMoney(gap.have, "NGN") });
}

/** The button's second line when the money is short, as the ask card says it. */
function afterWords(paying: Extract<AfterPaying, { short: Money }>): string {
  return say("ui.world.short", { amount: formatMoney(paying.short.amount, paying.short.currency) });
}

/** Why an activity with a choice inside it has nothing to choose yet, in a few words for its button. */
function nothingToPickWords(option: ActivityOption): string {
  const param = content.activity[option.id]?.param;
  if (param === "route" || param === "known-route") return say("ui.needs.route");
  if (param === "school") return say("ui.needs.school");
  return say("ui.needs.nothing-to-pick");
}

/**
 * The button's second line, one reason and never two that disagree (world:one-action-one-sheet): what it needs
 * first when it is not allowed, how much is short when it cannot be paid, the engine's no when the
 * screen sees no gap, else what is left after.
 */
function buttonLine(option: ActivityOption, paying: AfterPaying | null, view: PlayerView, planned: boolean): { words: string; kind: "needs" | "short" | "left" | "planned" } | null {
  if (planned) return { words: say("ui.needs.planned"), kind: "planned" };
  // The card's "Not yet:" list says why, once; the button only says it is shut.
  if (saysWhyOnCard(option, (requirement) => alreadyDone(requirement, { routes: view.routes }))) return { words: say("ui.needs.not-yet"), kind: "needs" };
  if (!option.allowed) return { words: option.missing.length > 0 ? needsWords(option.missing, { routes: view.routes }) : nothingToPickWords(option), kind: "needs" };
  if (paying !== null && paying.short !== null) return { words: afterWords(paying), kind: "short" };
  if (!option.affordable) {
    const foreign = foreignNeed(view, option);
    return { words: foreign === null ? say("ui.needs.money") : say("ui.needs.foreign", { currency: moneyName(foreign.currency) }), kind: "short" };
  }
  // What is left after stands under the button as the balance before and after (world:one-action-one-sheet), not on the button.
  return null;
}

function ActivityCard({ option }: { option: ActivityOption }) {
  const plan = useGame((state) => state.plan);
  const addToPlan = useGame((state) => state.addToPlan);
  const send = useGame((state) => state.send);
  const view = useView();
  const ended = view.ended;
  const [param, setParam] = useState<string>("");
  const name = nameOf(option.id);
  const costWords = option.cost.map((cost) => formatMoney(cost.amount, cost.currency)).join(" + ");
  const blurb = blurbOf(option.id);
  const counts = countsWords(option.id);
  // Chips earn their place (design page 09 section 2): the time only past a morning, at most two effects, Free only on a meal.
  const time = chipTimeOf(option.id, option.halfDays);
  const does = chipEffectsLine(option.id);
  // turn:free-slots-per-month: an activity that fills no slot can be planned however full the month is.
  // activity:now-acts-and-month-acts: an act done at once fills no slot either, so a full month never shuts it.
  const now = answersNow(option.id);
  const full = !now && content.activity[option.id]?.slot !== "none" && !plan.includes(null);
  const needsParam = option.params !== null;
  // A job to hunt is picked from a list of rows with pay and chance, the likely and best paid first (world:one-action-one-sheet).
  const jobs = content.activity[option.id]?.param === "job" ? huntOrder(view, option.params ?? []) : null;
  // A route is picked from a list too; with more than one, nothing is picked for the player.
  const kind = content.activity[option.id]?.param;
  const routes = kind === "route" || kind === "known-route" ? (option.params ?? []) : null;
  // The life's own trade is the first pick; with a job held, the first that pays more than it.
  const betterJob = jobs === null ? null : firstJob(view, jobs);
  const firstParam = routes !== null && routes.length > 1 ? "" : (betterJob ?? (jobs ?? option.params)?.[0] ?? "");
  const chosenParam = needsParam ? (option.params?.includes(param) === true ? param : firstParam) : "";
  // world:one-action-one-sheet: what is left after, counting what the month already pays for; a cost that cannot be paid shuts the button.
  const planned = plannedCosts(view, plan);
  const paying = option.cost.length === 0 ? null : afterPaying(view, planned, option.cost);
  const already = plannedShut(plan, { activity: option.id, param: chosenParam === "" ? null : chosenParam });
  const canAdd = option.allowed && option.affordable && (paying === null || paying.short === null) && !full && !ended && !already && (!needsParam || chosenParam !== "");
  const unpicked = routes !== null && option.allowed && chosenParam === "";
  const line = unpicked ? { words: say("routes.pick-first"), kind: "needs" as const } : buttonLine(option, paying, view, already);
  const cannotPay = option.allowed && !already && (!option.affordable || (paying !== null && paying.short !== null));
  const selectId = `param-${option.id}`;
  // world:one-action-one-sheet: the English test says its chance of the band the route needs before the fee is paid.
  const chance = option.id === ENGLISH_TEST ? testChance(view) : null;
  // A job picked from the list: one main button in the action colour that repeats the pick (world:one-action-one-sheet, world:colours-are-role-tokens).
  const applying = jobs !== null && chosenParam !== "" && !(full && option.allowed);

  return (
    <li>
      {/* The act as a card in the lively dress (design page 09, section 2): the thing's picture
          on its soft tile, the title and one line, the price, the time past a morning and what it does as chips. */}
      <div className={`lively-card flex h-full flex-col gap-2 p-3.5 ${option.allowed ? "" : "opacity-80"}`} data-act-card={option.id}>
        <div className="flex items-start gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-[14px] bg-tint-study" aria-hidden>
            <span className="sticker-cut" style={{ rotate: "-5deg" }}>
              <Tile of={option.id} size={40} />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] leading-tight font-bold">{name}</h3>
            {blurb === null ? null : <p className="mt-0.5 text-[14px] leading-snug text-text-2">{blurb}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {option.cost.length === 0 ? (
                freeShown(option.id) ? (
                  <span className="sticker-chip bg-tint-money" style={{ rotate: "-2deg", color: "var(--money-ink)" }}>
                    {say("ui.activity.free")}
                  </span>
                ) : null
              ) : (
                <span className={`sticker-chip num ${option.affordable ? "bg-[var(--soft)]" : "bg-sheet-2"}`} style={{ rotate: "-2deg", ...(option.affordable ? {} : { color: "var(--out)" }) }}>
                  {say("ui.activity.cost", {
                    amount: option.cost.map((cost) => formatMoney(cost.amount, cost.currency)).join(" + "),
                  })}
                </span>
              )}
              {/* activity:now-acts-spend-half-days: an act done at once says the time it takes in words, never a number of days. */}
              {time === null ? null : (
                <span className="sticker-chip bg-tint-study" style={{ rotate: "1.5deg" }} data-time>
                  {time}
                </span>
              )}
              {does === null ? null : (
                <span className="sticker-chip bg-tint-body chip-wrap" style={{ rotate: "-1deg" }} data-does>
                  {does}
                </span>
              )}
            </div>
          </div>
        </div>
        {counts === null ? null : (
          <p className="text-sm font-medium" data-counts>
            {counts}
          </p>
        )}
        {chance === null ? null : (
          <div className="flex flex-col gap-1 text-sm" data-test-chance={chance.band}>
            <p className="font-medium">{chance.words}</p>
            {chance.study === null ? null : <p className="text-text-2">{studyWords(view)}</p>}
          </div>
        )}

        {option.missing.length > 0 ? (
          <div className="text-sm">
            {/* The shut button already says "Not yet": the card says why, once, without a second "Not yet" over it. */}
            {line?.kind === "needs" && line.words === say("ui.needs.not-yet") ? null : (
              <p className="font-medium">
                {option.missing.every((requirement) => alreadyDone(requirement, { routes: view.routes })) ? say("ui.activity.done-already") : say("ui.activity.why-not")}
              </p>
            )}
            <ul className="list-disc pl-5">
              {option.missing.map((requirement, index) => (
                <li key={index}>{requirementSentence(requirement, { routes: view.routes })}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {cannotPay ? <p className="text-sm text-bad">{cannotPayWords(view, option, planned, paying)}</p> : null}

        {needsParam && (option.allowed || (option.params?.length === 0 && option.missing.length === 0)) ? (
          option.params?.length === 0 ? (
            content.activity[option.id]?.param === "school" ? (
              <div className="text-sm">
                <p className="font-medium">{say("ui.activity.no-school")}</p>
                <ul className="list-disc pl-5">
                  {noSchoolReasons(view).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-text-2">{say(content.activity[option.id]?.param === "route" || content.activity[option.id]?.param === "known-route" ? "ui.activity.no-route" : "ui.activity.nothing-to-pick")}</p>
            )
          ) : jobs !== null ? (
            <JobList view={view} jobs={jobs} chosen={chosenParam} onPick={setParam} />
          ) : routes !== null ? (
            <RouteList view={view} routes={routes} chosen={chosenParam} onPick={setParam} label={`routes-${option.id}`} />
          ) : (
            <label htmlFor={selectId} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{say("ui.activity.pick")}</span>
              <select
                id={selectId}
                value={chosenParam}
                onChange={(event) => setParam(event.target.value)}
                className="min-h-11 rounded-md border border-sheet-line bg-sheet px-3"
              >
                {option.params?.map((value) => (
                  <option key={value} value={value}>
                    {paramWords(value)}
                  </option>
                ))}
              </select>
            </label>
          )
        ) : null}

        <div className="mt-auto pt-1">
          {/* activity:spent-body-refuses-acts: a spent body says so where the button was, and there is no button. */}
          {option.spent === true ? (
            <p className="rounded-[6px] bg-sheet-muted px-3 py-2.5 text-center text-[14px] font-bold" data-act-spent={option.id}>
              {say("ui.act.spent")}
            </p>
          ) : (
          // The card's one yellow action (design page 09, section 2), the verb and the thing, the price on it.
          <PressButton
            disabled={!canAdd}
            aria-label={name}
            onClick={() => void actOnCard({ activity: option.id, param: needsParam ? chosenParam : null }, { send, addToPlan })}
            className="w-full px-4 py-2 text-center text-[16px] leading-tight"
          >
            {applying ? (
              <ApplyFor id={chosenParam} />
            ) : (
              <>
                <Plus size={16} />
                {already ? say("ui.activity.planned") : full && option.allowed ? say("ui.activity.full") : option.cost.length === 0 ? name : pricedLabel(name, costWords)}
              </>
            )}
            {line === null ? null : (
              <span className={`text-xs font-semibold ${line.kind === "short" ? "text-bad" : ""}`} data-after={line.kind}>
                {line.words}
              </span>
            )}
          </PressButton>
          )}
          {/* world:one-action-one-sheet: under a priced act's button, the balance before struck and the balance after; nothing moves until the tap. */}
          {option.spent === true || paying === null || paying.short !== null || !canAdd ? null : (
            <Balance className="mt-2 justify-start" before={{ amount: paying.before.amount, words: formatMoney(paying.before.amount, paying.before.currency) }} after={{ amount: paying.left.amount, words: formatMoney(paying.left.amount, paying.left.currency) }} />
          )}
          {/* An act done at once fills no slot (activity:now-acts-and-month-acts), so it never claims the month's free time. */}
          {content.activity[option.id]?.slot === "free" && !applying && !now ? <p className="mt-1 text-[12px] text-text-2">{say("ui.activity.uses-free")}</p> : null}
        </div>
      </div>
    </li>
  );
}

/** True for what can only be done once you have left: it asks to be abroad. */
function forAbroad(option: ActivityOption): boolean {
  if (content.activity[option.id]?.where === "abroad") return true;
  return option.missing.some((requirement) => requirement.type === "place/is" && requirement.where === "abroad");
}

export function ActivityView() {
  const view = useView();
  const atHome = view.place.where === "home";
  // Allowed first, so the cards a player can use now are the ones they see first.
  // turn:free-slots-per-month: rest is never a card to pick; an empty slot already rests.
  const sorted = pickable(view.activities).sort((a, b) => Number(b.allowed) - Number(a.allowed));
  const later = atHome ? sorted.filter(forAbroad) : [];
  const options = atHome ? sorted.filter((option) => !forAbroad(option)) : sorted;
  return (
    <div className="flex flex-col gap-6">
      <Panel title={say("ui.job.title")}>
        <Job />
        <SideJob />
      </Panel>
      <Panel title={say("ui.month.plan")}>
        <Locks />
        <Slots />
      </Panel>
      <Panel title={say("ui.activity.title")}>
        <ul className="grid grid-cols-1 gap-3 @lg:grid-cols-2">
          {options.map((option) => (
            <ActivityCard key={option.id} option={option} />
          ))}
        </ul>
        {later.length === 0 ? null : (
          <details className="rounded-md border border-sheet-line bg-sheet-2 p-4" data-later>
            <summary className="cursor-pointer font-semibold">
              {say("ui.activity.later")} <span className="font-normal text-text-2">({later.length})</span>
            </summary>
            <p className="mt-2 text-sm text-text-2">{say("ui.activity.later-hint", { count: later.length })}</p>
            <ul className="mt-3 grid grid-cols-1 gap-3 @lg:grid-cols-2">
              {later.map((option) => (
                <ActivityCard key={option.id} option={option} />
              ))}
            </ul>
          </details>
        )}
      </Panel>
    </div>
  );
}

/** The world mode's sheet (docs/design/07-the-world-first.md, section 2 point 4: one action, one sheet): only the activities `only` names, as the cards above show them. */
export function ActivityPicker({ only }: { only: readonly string[] }) {
  const view = useView();
  // On a long shot the test's sheet carries the study act too, so studying first is one tap away (world:one-action-one-sheet).
  const studyFirst = only.includes(ENGLISH_TEST) && !only.includes(STUDY_ENGLISH) && testChance(view).study !== null;
  const shown = studyFirst ? [...only, STUDY_ENGLISH] : only;
  const options = pickable(view.activities)
    .filter((option) => shown.includes(option.id))
    .sort((a, b) => shown.indexOf(a.id) - shown.indexOf(b.id));
  return (
    <ul className="grid gap-3" data-activity-picker>
      {options.map((option) => (
        <ActivityCard key={option.id} option={option} />
      ))}
    </ul>
  );
}
