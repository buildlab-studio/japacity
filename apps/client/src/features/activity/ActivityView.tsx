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
import { shortfall } from "../../shared/words/cost";
import { formatBand, formatMoney } from "../../shared/words/format";
import { lockWords, SIDE_JOB_LOCK } from "../../shared/words/locks";
import { alreadyDone, requirementSentence } from "../../shared/words/requirement";
import { blurbOf, hasWords, lowerFirst, nameOf, paramWords, say, sayCount } from "../../shared/words/text";

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
        <Briefcase size={20} className="mt-0.5 shrink-0 text-muted" />
        <div className="flex flex-1 flex-col gap-1">
          {job === null ? (
            <p>{say("ui.job.none")}</p>
          ) : (
            <>
              <p className="font-semibold">{nameOf(job)}</p>
              {pay === null || pay === undefined || typeof pay.amount !== "number" ? null : (
                <p className="text-sm font-medium tabular-nums">{say("ui.job.pay", { amount: formatMoney(pay.amount, pay.currency) })}</p>
              )}
              <p className="text-sm text-muted">{sayCount("ui.job.months", view.job.months, { months: view.job.months })}</p>
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
        <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
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
          <Briefcase size={20} className="mt-0.5 shrink-0 text-muted" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">{say("ui.side.title")}</p>
            {side === null ? null : <p className="font-semibold">{nameOf(side)}</p>}
            {pay === null || pay === undefined || typeof pay.amount !== "number" ? null : (
              <p className="text-sm font-medium tabular-nums">{say("ui.job.pay", { amount: formatMoney(pay.amount, pay.currency) })}</p>
            )}
            <p className="text-sm text-muted">{say("ui.side.holds")}</p>
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
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
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
          <Lock size={14} className="mt-0.5 shrink-0 text-muted" />
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
  if (view.freeSlots === 0) return <p className="text-muted">{say("ui.month.no-slots")}</p>;
  return (
    <ol className="grid gap-2 @md:grid-cols-3" aria-label={say("ui.month.plan")}>
      {plan.map((pick, index) => (
        <li
          key={index}
          className={`flex min-h-14 items-center gap-2 rounded-xl border px-3 py-2 ${pick === null ? "border-dashed border-line text-muted" : "border-ink/60 bg-surface"}`}
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sunk text-xs font-semibold text-ink">
            {index + 1}
          </span>
          <span className="flex-1">{pick === null ? say("ui.month.slot-empty") : pickWords(pick, view)}</span>
          {pick === null ? null : (
            <button
              type="button"
              aria-label={`${say("ui.month.slot-remove")}: ${pickWords(pick, view)}`}
              className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-sunk"
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

/** Which figure is short when an allowed activity cannot be paid for. */
function cannotPayWords(view: PlayerView, option: ActivityOption): string {
  const costs = option.cost.map((cost) => formatMoney(cost.amount, cost.currency)).join(" + ");
  const gap = shortfall(view, option.cost);
  if (gap.foreign) return say("ui.activity.short-foreign", { cost: costs, naira: formatMoney(gap.need, "NGN"), have: formatMoney(gap.have, "NGN") });
  if (gap.short === 0) return say("ui.activity.cannot-pay");
  return say("ui.activity.short", { short: formatMoney(gap.short, "NGN"), cost: costs, have: formatMoney(gap.have, "NGN") });
}

function ActivityCard({ option }: { option: ActivityOption }) {
  const plan = useGame((state) => state.plan);
  const addToPlan = useGame((state) => state.addToPlan);
  const view = useView();
  const ended = view.ended;
  const [param, setParam] = useState<string>("");
  const name = nameOf(option.id);
  const blurb = blurbOf(option.id);
  const full = !plan.includes(null);
  const needsParam = option.params !== null;
  const chosenParam = needsParam ? (option.params?.includes(param) === true ? param : (option.params?.[0] ?? "")) : "";
  const canAdd = option.allowed && option.affordable && !full && !ended && (!needsParam || chosenParam !== "");
  const selectId = `param-${option.id}`;

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
        {blurb === null ? null : <p className="text-sm text-muted">{blurb}</p>}

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
        {option.allowed && !option.affordable ? <p className="text-sm text-bad">{cannotPayWords(view, option)}</p> : null}

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
              <p className="text-sm text-muted">{say(content.activity[option.id]?.param === "route" || content.activity[option.id]?.param === "known-route" ? "ui.activity.no-route" : "ui.activity.nothing-to-pick")}</p>
            )
          ) : (
            <label htmlFor={selectId} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{say("ui.activity.pick")}</span>
              <select
                id={selectId}
                value={chosenParam}
                onChange={(event) => setParam(event.target.value)}
                className="min-h-11 rounded-lg border border-line bg-paper px-3"
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
            small
            disabled={!canAdd}
            aria-label={`${say("ui.activity.add")}: ${name}`}
            onClick={() => addToPlan({ activity: option.id, param: needsParam ? chosenParam : null })}
          >
            <Plus size={16} />
            {full && option.allowed ? say("ui.activity.full") : say("ui.activity.add")}
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
          <details className="rounded-xl border border-line bg-surface p-4" data-later>
            <summary className="cursor-pointer font-semibold">
              {say("ui.activity.later")} <span className="font-normal text-muted">({later.length})</span>
            </summary>
            <p className="mt-2 text-sm text-muted">{say("ui.activity.later-hint", { count: later.length })}</p>
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
  const options = view.activities.filter((option) => only.includes(option.id));
  return (
    <ul className="grid gap-3" data-activity-picker>
      {options.map((option) => (
        <ActivityCard key={option.id} option={option} />
      ))}
    </ul>
  );
}
