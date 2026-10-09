// The month plan: the job, the free slots, and every free-slot activity as a
// card. What is allowed, what is missing and what may be picked all come from
// the view; this screen only arranges them.
import { content } from "@japacity/content";
import type { ActivityOption, PlayerView, SlotPick } from "@japacity/sim";
import { Briefcase, Lock, Plus, X } from "lucide-react";
import { useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { bondName, timeWith } from "../../shared/sim/people";
import { Button } from "../../shared/ui/Button";
import { Card, Panel, Tag } from "../../shared/ui/Panel";
import { afterPaying, plannedCosts, shortfall, type AfterPaying, type Money } from "../../shared/words/cost";
import { formatBand, formatMoney } from "../../shared/words/format";
import { lockWords, SIDE_JOB_LOCK } from "../../shared/words/locks";
import { alreadyDone, needsWords, requirementSentence } from "../../shared/words/requirement";
import { ENGLISH_TEST, STUDY_ENGLISH, testChance } from "../../shared/words/test";
import { blurbOf, hasWords, lowerFirst, nameOf, paramWords, say, sayCount } from "../../shared/words/text";
import { payAMonth } from "../../shared/words/pay";
import { ApplyFor, huntOrder, JobList } from "./JobList";
import { RouteList } from "./RouteList";
import { routesWords } from "./routes.words";

const ENGLISH_RESULT = "document.english-test";
const GRADE = "quality.edu-grade";

function Job() {
  const view = useView();
  const busy = useGame((state) => state.busy);
  const send = useGame((state) => state.send);
  const [confirming, setConfirming] = useState(false);
  const job = view.job.id;
  const pay = job === null ? null : content.activity[job]?.pay;

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
              {pay === null || pay === undefined || typeof pay.amount !== "number" ? null : (
                <p className="text-sm font-medium tabular-nums">{say("ui.job.pay", { amount: formatMoney(pay.amount, pay.currency) })}</p>
              )}
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
  const pay = side === null ? null : content.activity[side]?.pay;
  return (
    <Card data-side-job>
      {/* On a phone the quit button goes under the words, so they keep the card's width. */}
      <div className="flex flex-col gap-3 @sm:flex-row @sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-3" data-side-words>
          <Briefcase size={20} className="mt-0.5 shrink-0 text-text-2" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-xs font-semibold tracking-wide text-text-2 uppercase">{say("ui.side.title")}</p>
            {side === null ? null : <p className="font-semibold">{nameOf(side)}</p>}
            {pay === null || pay === undefined || typeof pay.amount !== "number" ? null : (
              <p className="text-sm font-medium tabular-nums">{say("ui.job.pay", { amount: formatMoney(pay.amount, pay.currency) })}</p>
            )}
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

/** Slots held by something this month, why, and for how long (R-TURN-009, R-HEALTH-007). */
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
  // Time with someone names the bond it goes to (R-PEOPLE-014).
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
  const grade = view.qualities.find((quality) => quality.id === GRADE)?.value ?? 0;
  const have = `${band}, ${gradeWords(grade)}`;
  const applied = new Set(view.routes.flatMap((route) => route.schools.map((school) => school.id)));
  return Object.values(content.school).map((school) =>
    applied.has(school.id)
      ? say("ui.activity.school-applied", { school: nameOf(school.id) })
      : say("ui.activity.school-needs", { school: nameOf(school.id), band: formatBand(school.minBand), grade: gradeWords(school.minGrade), have }),
  );
}

/**
 * Which figure is short when an allowed activity cannot be paid for: the same figure the button
 * says, counting what the month's plan already pays for (R-WORLD-006). With nothing short by the
 * screen's count but the engine still saying no, it says so plainly and names no figure.
 */
function cannotPayWords(view: PlayerView, option: ActivityOption, planned: readonly Money[], paying: AfterPaying | null): string {
  const costs = option.cost.map((cost) => formatMoney(cost.amount, cost.currency)).join(" + ");
  if (paying === null || paying.short === null) return say("ui.activity.cannot-pay");
  const short = formatMoney(paying.short.amount, paying.short.currency);
  const gap = shortfall(view, [...planned, ...option.cost]);
  if (gap.foreign) return say("ui.activity.short-foreign", { short, cost: costs, naira: formatMoney(gap.need, "NGN"), have: formatMoney(gap.have, "NGN") });
  const plannedNaira = shortfall(view, planned).need;
  if (plannedNaira > 0) return say("ui.activity.short-planned", { short, cost: costs, planned: formatMoney(plannedNaira, "NGN"), have: formatMoney(gap.have, "NGN") });
  return say("ui.activity.short", { short, cost: costs, have: formatMoney(gap.have, "NGN") });
}

/** The button's second line: what is left after, or how much is short, as the ask card says it. */
function afterWords(paying: AfterPaying): string {
  return paying.short === null ? say("ui.world.left", { amount: formatMoney(paying.left.amount, paying.left.currency) }) : say("ui.world.short", { amount: formatMoney(paying.short.amount, paying.short.currency) });
}

/**
 * True when a paper's request is already in the month's plan: it asks that the paper not be held
 * or on its way, so a second request in the same month would ask for what the first already asks.
 */
function plannedOnce(option: ActivityOption, plan: readonly (SlotPick | null)[], param: string): boolean {
  const once = content.activity[option.id]?.requires.some((requirement) => requirement.type === "document/absent") === true;
  return once && plan.some((pick) => pick !== null && pick.activity === option.id && (pick.param ?? "") === param);
}

/** Why an activity with a choice inside it has nothing to choose yet, in a few words for its button. */
function nothingToPickWords(option: ActivityOption): string {
  const param = content.activity[option.id]?.param;
  if (param === "route" || param === "known-route") return say("ui.needs.route");
  if (param === "school") return say("ui.needs.school");
  return say("ui.needs.nothing-to-pick");
}

/**
 * The button's second line, one reason and never two that disagree (R-WORLD-006): what it needs
 * first when it is not allowed, how much is short when it cannot be paid, the engine's no when the
 * screen sees no gap, else what is left after.
 */
function buttonLine(option: ActivityOption, paying: AfterPaying | null, view: PlayerView, planned: boolean): { words: string; kind: "needs" | "short" | "left" | "planned" } | null {
  if (planned) return { words: say("ui.needs.planned"), kind: "planned" };
  if (!option.allowed) return { words: option.missing.length > 0 ? needsWords(option.missing, { routes: view.routes }) : nothingToPickWords(option), kind: "needs" };
  if (paying !== null && paying.short !== null) return { words: afterWords(paying), kind: "short" };
  if (!option.affordable) return { words: say("ui.needs.money"), kind: "short" };
  return paying === null ? null : { words: afterWords(paying), kind: "left" };
}

function ActivityCard({ option }: { option: ActivityOption }) {
  const plan = useGame((state) => state.plan);
  const addToPlan = useGame((state) => state.addToPlan);
  const view = useView();
  const ended = view.ended;
  const [param, setParam] = useState<string>("");
  const name = nameOf(option.id);
  const blurb = blurbOf(option.id);
  // R-TURN-006: an activity that fills no slot can be planned however full the month is.
  const full = content.activity[option.id]?.slot !== "none" && !plan.includes(null);
  const needsParam = option.params !== null;
  // A job to hunt is picked from a list of rows with pay and chance, the likely and best paid first (R-WORLD-006).
  const jobs = content.activity[option.id]?.param === "job" ? huntOrder(view, option.params ?? []) : null;
  // A route is picked from a list too; with more than one, nothing is picked for the player.
  const kind = content.activity[option.id]?.param;
  const routes = kind === "route" || kind === "known-route" ? (option.params ?? []) : null;
  // With a job held, the first pick is the first listed job that pays more than it.
  const heldPay = view.job.id === null ? 0 : (payAMonth(view.job.id)?.amount ?? 0);
  const betterJob = jobs?.find((id) => (payAMonth(id)?.amount ?? 0) > heldPay) ?? null;
  const firstParam = routes !== null && routes.length > 1 ? "" : (betterJob ?? (jobs ?? option.params)?.[0] ?? "");
  const chosenParam = needsParam ? (option.params?.includes(param) === true ? param : firstParam) : "";
  // R-WORLD-006: what is left after, counting what the month already pays for; a cost that cannot be paid shuts the button.
  const planned = plannedCosts(view, plan);
  const paying = option.cost.length === 0 ? null : afterPaying(view, planned, option.cost);
  const already = plannedOnce(option, plan, chosenParam);
  const canAdd = option.allowed && option.affordable && (paying === null || paying.short === null) && !full && !ended && !already && (!needsParam || chosenParam !== "");
  const unpicked = routes !== null && option.allowed && chosenParam === "";
  const line = unpicked ? { words: routesWords("routes.pick-first"), kind: "needs" as const } : buttonLine(option, paying, view, already);
  const cannotPay = option.allowed && !already && (!option.affordable || (paying !== null && paying.short !== null));
  const selectId = `param-${option.id}`;
  // R-WORLD-006: the English test says its chance of the band the route needs before the fee is paid.
  const chance = option.id === ENGLISH_TEST ? testChance(view) : null;
  // A job picked from the list: one main button in the action colour that repeats the pick (R-WORLD-006, R-WORLD-021).
  const applying = jobs !== null && chosenParam !== "" && !(full && option.allowed);

  return (
    <li>
      <Card tone={option.allowed ? "plain" : "muted"} className="flex h-full flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold">{name}</h3>
          {option.cost.length === 0 ? (
            <Tag>{say("ui.activity.free")}</Tag>
          ) : (
            <Tag tone={option.affordable ? "plain" : "bad"}>
              {say("ui.activity.cost", {
                amount: option.cost.map((cost) => formatMoney(cost.amount, cost.currency)).join(" + "),
              })}
            </Tag>
          )}
        </div>
        {blurb === null ? null : <p className="text-sm text-text-2">{blurb}</p>}
        {chance === null ? null : (
          <div className="flex flex-col gap-1 text-sm" data-test-chance={chance.band}>
            <p className="font-medium">{chance.words}</p>
            {chance.study === null ? null : <p className="text-text-2">{chance.study}</p>}
          </div>
        )}

        {option.missing.length > 0 ? (
          <div className="text-sm">
            <p className="font-medium">
              {option.missing.every((requirement) => alreadyDone(requirement, { routes: view.routes })) ? say("ui.activity.done-already") : say("ui.activity.why-not")}
            </p>
            <ul className="list-disc pl-5">
              {option.missing.map((requirement, index) => (
                <li key={index}>{requirementSentence(requirement, { routes: view.routes })}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {cannotPay ? <p className="text-sm text-bad">{cannotPayWords(view, option, planned, paying)}</p> : null}

        {needsParam && (option.allowed || option.params?.length === 0) ? (
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
          <Button
            small={!applying}
            variant={applying ? "primary" : "secondary"}
            disabled={!canAdd}
            aria-label={`${say("ui.activity.add")}: ${name}`}
            onClick={() => addToPlan({ activity: option.id, param: needsParam ? chosenParam : null })}
            className={applying ? "w-full justify-between" : ""}
          >
            {applying ? (
              <ApplyFor id={chosenParam} />
            ) : (
              <>
                <Plus size={16} />
                {full && option.allowed ? say("ui.activity.full") : say("ui.activity.do")}
              </>
            )}
            {line === null ? null : (
              <span className={`text-xs font-semibold ${line.kind === "left" ? "opacity-80" : line.kind === "short" ? "text-bad" : ""}`} data-after={line.kind}>
                {line.words}
              </span>
            )}
          </Button>
        </div>
      </Card>
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
  const sorted = [...view.activities].sort((a, b) => Number(b.allowed) - Number(a.allowed));
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
        <ul className="grid gap-3 @lg:grid-cols-2">
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
            <ul className="mt-3 grid gap-3 @lg:grid-cols-2">
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

/** The world mode's sheet (docs/design/11, rule 12): only the activities `only` names, as the cards above show them. */
export function ActivityPicker({ only }: { only: readonly string[] }) {
  const view = useView();
  // On a long shot the test's sheet carries the study act too, so studying first is one tap away (R-WORLD-006).
  const studyFirst = only.includes(ENGLISH_TEST) && !only.includes(STUDY_ENGLISH) && testChance(view).study !== null;
  const shown = studyFirst ? [...only, STUDY_ENGLISH] : only;
  const options = view.activities.filter((option) => shown.includes(option.id)).sort((a, b) => shown.indexOf(a.id) - shown.indexOf(b.id));
  return (
    <ul className="grid gap-3" data-activity-picker>
      {options.map((option) => (
        <ActivityCard key={option.id} option={option} />
      ))}
    </ul>
  );
}
