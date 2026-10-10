// The Month sheet's contents (docs/rules/world.md R-WORLD-007): the job held, what is planned, as
// rows that can be taken out (the slot empties), the free slots, Same again as one chip, and the
// real End month with the reason it is held when it is. Nothing else plans the month: a slot fills
// only when an act that takes one is chosen from its thing in the world. The shell's sheet frame
// holds this.
import type { PlayerView, SlotLock, SlotPick } from "@japacity/sim";
import { Briefcase, Repeat, X, Lock } from "lucide-react";
import { useEffect } from "react";

import { useGame, useGameStoreIfAny, useView } from "../../authority/GameProvider";
import { slotted, slotsUsed, takesSlot } from "../../authority/store";
import { cue } from "../../shared/sound/cues";
import { Rejection } from "../../shared/ui/Rejection";
import { answersNow } from "../../shared/words/acts";
import { workingPlanned } from "../../shared/words/count";
import { lockWords } from "../../shared/words/locks";
import { hasWords, nameOf, paramWords, say } from "../../shared/words/text";
import { stretchedWords } from "../../shared/days/stretch";
import { blockedBy } from "./TurnBar";
import { TurnClock } from "./TurnClock";
import { turnWords } from "./turn.words";
import { huntsHeldJob } from "./untilNews";

function pickWords(pick: SlotPick): string {
  return pick.param === null ? nameOf(pick.activity) : `${nameOf(pick.activity)}: ${paramWords(pick.param)}`;
}

/** The jobs held, as the sheet's first rows: the month's work is planned before anything else. */
function jobRows(job: PlayerView["job"]): string[] {
  return [...(job.id === null ? [] : [turnWords("turn.month.working", { job: nameOf(job.id) })]), ...(job.side === null ? [] : [turnWords("turn.month.side", { job: nameOf(job.side) })])];
}

const COOK = "activity.cook-at-home";
const WATER = "activity.fetch-water";

/**
 * The room's basics planned, which fill no slot, said so the foot never reads "Nothing planned" over
 * them. Null when neither is planned.
 */
function choreWords(plan: readonly (SlotPick | null)[], working: boolean): string | null {
  const cook = plan.some((pick) => pick?.activity === COOK);
  const water = plan.some((pick) => pick?.activity === WATER);
  if (cook || water) return say(`ui.month.${working ? "working-chores" : "chores"}.${cook && water ? "both" : cook ? "cook" : "water"}`);
  // Any other pick that fills no slot (the word of someone who went, R-TURN-006) is still something planned, never "nothing".
  const beside = plan.find((pick): pick is SlotPick => pick !== null && !takesSlot(pick));
  return beside === undefined ? null : say(working ? "ui.month.working-beside" : "ui.month.beside", { what: pickWords(beside) });
}

/**
 * The End month button's second line: what is planned of the free time. While working, the job is
 * said and the count is only of the time beside it, so the job is never read as one of the things
 * planned.
 */
function footWords(view: PlayerView, plan: readonly (SlotPick | null)[]): string {
  const used = slotsUsed(plan);
  const working = view.job.id !== null;
  if (used === 0) return choreWords(plan, working) ?? turnWords(working && plan.every((pick) => pick === null) ? "turn.month.working-rest" : "ui.month.rest");
  // Working: what is planned beside the job, counted as a person says it.
  if (working) return workingPlanned(used);
  return turnWords("ui.month.slots", { used, slots: view.freeSlots });
}

/** A held slot as a row of the plan: "At the burial", or the lock's sentence where content has no row words. */
function lockRow(lock: SlotLock, month: number): string {
  return hasWords(`ui.locks.row.${lock.why}`) ? say(`ui.locks.row.${lock.why}`) : lockWords(lock, month);
}

export function MonthSheet() {
  const view = useView();
  const plan = useGame((state) => state.plan);
  const busy = useGame((state) => state.busy);
  const setSlot = useGame((state) => state.setSlot);
  const sameAgain = useGame((state) => state.sameAgain);
  const store = useGameStoreIfAny();
  const endMonth = useGame((state) => state.endMonth);
  // An interview with a question still to answer holds the month as a set piece does (R-INTERVIEW-004).
  const blocked = blockedBy(view.ended, view.turns.banked, view.setpiece !== null || (view.interview?.question ?? null) !== null);
  // Same again repeats a month that had something in it: after one with nothing planned it would plan nothing.
  const canRepeat = view.lastSlots.length > 0 && !busy && !view.ended;
  const free = plan.some((pick) => pick === null);
  const untilNews = useGame((state) => state.untilNews);
  const abroad = view.place.where === "abroad";
  const shut = busy || blocked !== null;
  // R-WORLD-030: the plan that stretches the character is said before the page turns.
  const stretched = stretchedWords(view, plan);
  // R-ACTIVITY-015: the sheet lists only what takes the month. An act done at once, kept from a plan made before it
  // answered in the place, is taken out, last first so the rows before it keep their places.
  useEffect(() => {
    for (let index = plan.length - 1; index >= 0; index -= 1) {
      const pick = plan[index];
      if (pick !== null && pick !== undefined && answersNow(pick.activity)) setSlot(index, null);
    }
  }, [plan, setSlot]);
  const endButton = (main: boolean) => (
    <button
      key="end"
      type="button"
      className={main ? "btn-main" : "chip press flex h-12 w-full items-center justify-between px-4 text-[15px] font-extrabold disabled:opacity-50"}
      disabled={shut}
      onClick={() => {
        cue("tap");
        void endMonth();
      }}
      data-month-end
      data-main={main}
    >
      <span>{turnWords("turn.month.end")}</span>
      <span className="truncate pl-2 text-[13px] font-semibold opacity-80">{footWords(view, plan)}</span>
    </button>
  );
  const untilButton = (main: boolean) => (
    <button
      key="until"
      type="button"
      className={main ? "btn-main" : "chip press flex h-12 w-full items-center justify-between px-4 text-[15px] font-extrabold disabled:opacity-50"}
      disabled={shut}
      onClick={() => {
        cue("tap");
        void untilNews();
      }}
      data-month-until
      data-main={main}
    >
      <span className="shrink-0">{turnWords("ui.month.until-news")}</span>
      <span className="truncate pl-2 text-right text-[12px] leading-tight font-semibold opacity-80">{turnWords("ui.month.until-news-foot")}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-3" data-month-sheet>
      {jobRows(view.job).length === 0 ? null : (
        <ul className="flex flex-col gap-1.5" data-month-jobs>
          {jobRows(view.job).map((row) => (
            <li key={row} className="flex min-h-11 items-center gap-2 rounded-[5px] bg-sheet-muted px-3 text-[15px] font-bold" data-slot="job">
              <Briefcase size={16} aria-hidden className="shrink-0 text-text-2" />
              <span className="min-w-0 flex-1 truncate">{row}</span>
            </li>
          ))}
        </ul>
      )}
      {view.locks.length === 0 ? null : (
        <ul className="flex flex-col gap-1.5" aria-label={say("ui.locks.title")} data-month-locks>
          {view.locks.map((lock, index) => (
            <li key={`${lock.why}-${String(index)}`} className="flex min-h-11 items-center gap-2 rounded-[5px] bg-sheet-muted px-3 text-[15px] font-bold" data-slot="lock" data-lock={lock.why}>
              <Lock size={16} aria-hidden className="shrink-0 text-text-2" />
              <span className="min-w-0 flex-1 truncate">{lockRow(lock, view.month)}</span>
            </li>
          ))}
        </ul>
      )}
      {slotted(plan).length === 0 ? <p className="text-[14px] text-text-2">{turnWords("turn.month.no-slots")}</p> : null}
      {plan.length === 0 ? null : (
        <ol className="flex flex-col gap-1.5" aria-label={turnWords("turn.month.title")} data-month-plan>
          {plan.map((pick, index) =>
            pick !== null && answersNow(pick.activity) ? null : pick === null ? (
              <li key={`free-${String(index)}`} className="flex min-h-11 items-center rounded-[5px] border-2 border-dashed border-sheet-line px-3 text-[14px] text-text-2" data-slot="free">
                {turnWords("turn.month.free")}
              </li>
            ) : (
              <li key={`${pick.activity}-${String(index)}`} className="chip-in flex min-h-11 items-center gap-2 rounded-[5px] bg-sheet-muted py-1 pr-1 pl-3 text-[15px] font-bold" data-slot="planned">
                <span className="min-w-0 flex-1 truncate">{pickWords(pick)}</span>
                {/* R-TURN-006: the word of someone who went rides with the month and fills no slot. */}
                {takesSlot(pick) ? null : (
                  <span className="shrink-0 text-[12px] font-semibold text-text-2" data-slot-none>
                    {turnWords("turn.month.no-slot")}
                  </span>
                )}
                <button
                  type="button"
                  aria-label={turnWords("turn.month.remove", { activity: pickWords(pick) })}
                  onClick={() => {
                    cue("close");
                    setSlot(index, null);
                  }}
                  className="press flex size-9 shrink-0 items-center justify-center rounded-[4px] text-text-2"
                >
                  <X size={18} />
                </button>
              </li>
            ),
          )}
        </ol>
      )}
      {free ? <p className="text-[13px] text-text-2">{turnWords("turn.month.hint")}</p> : null}
      {canRepeat ? (
        <div>
          <button
            type="button"
            className="chip press inline-flex h-9 items-center gap-1.5 px-3 text-[13px] font-bold"
            onClick={() => {
              cue("tap");
              sameAgain();
              // R-WORLD-007: the search that found the job held now is not planned again.
              (store?.getState().plan ?? []).forEach((pick, index) => {
                if (huntsHeldJob(pick, view.job)) setSlot(index, null);
              });
            }}
            data-same-again
          >
            <Repeat size={15} aria-hidden />
            {turnWords("ui.month.same-again")}
          </button>
        </div>
      ) : null}
      <Rejection />
      <div className="sticky -bottom-4 -mx-4 -mb-4 flex flex-col gap-1.5 bg-sheet px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]">
        {stretched === null ? null : (
          <p className="text-[13px] font-semibold text-text-2" data-month-stretched>
            {stretched}
          </p>
        )}
        {/* R-WORLD-028: abroad the quiet months go by Until news, so it is the main button there and End month the second. */}
        {abroad ? untilButton(true) : endButton(true)}
        {abroad ? endButton(false) : untilButton(false)}
        {blocked === null ? null : (
          <p className="text-[13px] text-text-2" data-month-blocked>
            {blocked}
          </p>
        )}
        {blocked !== null && view.turns.banked < 1 ? <TurnClock /> : null}
      </div>
    </div>
  );
}
