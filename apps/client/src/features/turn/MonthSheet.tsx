// The Month sheet's contents (docs/rules/world.md R-WORLD-007): the job held, what is planned, as
// rows that can be taken out (the slot empties), the free slots, Same again as one chip, and the
// real End month with the reason it is held when it is. Nothing else plans the month: a slot fills
// only when an act that takes one is chosen from its thing in the world. The shell's sheet frame
// holds this.
import type { PlayerView, SlotPick } from "@japacity/sim";
import { Briefcase, Repeat, X } from "lucide-react";

import { useGame, useGameStoreIfAny, useView } from "../../authority/GameProvider";
import { slotted, slotsUsed, takesSlot } from "../../authority/store";
import { cue } from "../../shared/sound/cues";
import { Rejection } from "../../shared/ui/Rejection";
import { nameOf, paramWords } from "../../shared/words/text";
import { blockedBy } from "./TurnBar";
import { TurnClock } from "./TurnClock";
import { turnWords } from "./turn.words";

function pickWords(pick: SlotPick): string {
  return pick.param === null ? nameOf(pick.activity) : `${nameOf(pick.activity)}: ${paramWords(pick.param)}`;
}

const HUNT = "activity.job-hunt";

/** A hunt for a job the character already holds: last month's search, done now that it paid off. */
export function huntsHeldJob(pick: SlotPick | null, job: PlayerView["job"]): boolean {
  return pick !== null && pick.activity === HUNT && pick.param !== null && (pick.param === job.id || pick.param === job.side);
}

/** The jobs held, as the sheet's first rows: the month's work is planned before anything else. */
function jobRows(job: PlayerView["job"]): string[] {
  return [...(job.id === null ? [] : [turnWords("turn.month.working", { job: nameOf(job.id) })]), ...(job.side === null ? [] : [turnWords("turn.month.side", { job: nameOf(job.side) })])];
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
  const canRepeat = !(view.lastSlots.length === 0 && view.report === null) && !busy && !view.ended;
  const free = plan.some((pick) => pick === null);

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
      {slotted(plan).length === 0 ? <p className="text-[14px] text-text-2">{turnWords("turn.month.no-slots")}</p> : null}
      {plan.length === 0 ? null : (
        <ol className="flex flex-col gap-1.5" aria-label={turnWords("turn.month.title")} data-month-plan>
          {plan.map((pick, index) =>
            pick === null ? (
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
      <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-col gap-1.5 bg-sheet px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]">
        <button
          type="button"
          className="btn-main"
          disabled={busy || blocked !== null}
          onClick={() => {
            cue("tap");
            void endMonth();
          }}
          data-month-end
        >
          <span>{turnWords("turn.month.end")}</span>
          <span className="text-[13px] font-semibold opacity-80">
            {slotsUsed(plan) > 0 ? turnWords("ui.month.slots", { used: slotsUsed(plan), slots: view.freeSlots }) : turnWords(view.job.id !== null && plan.every((pick) => pick === null) ? "turn.month.working-rest" : "ui.month.rest")}
          </span>
        </button>
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
