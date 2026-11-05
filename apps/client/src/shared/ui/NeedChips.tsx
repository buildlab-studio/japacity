// What a job still asks, as chips and never a sentence (world:one-action-one-sheet, text:show-then-tell): months in a
// trade as a progress chip, "2 / 18 months", with the jobs that count folded behind a tap, and each other need a chip
// with its mark, a cross while unmet and a tick once met. Jobs' next rung and side job and the Bank's roads share it.
import { content } from "@japacity/content";
import type { Id, PlayerView, Requirement } from "@japacity/sim";
import { useState } from "react";

import { requirementSentence } from "../words/requirement";
import { nameOf, say } from "../words/text";
import { Mark } from "./Mark";

type NeedView = Pick<PlayerView, "job" | "routes">;

/** The months the job held counts toward a need for months in a trade: all of them when it is one of the jobs, else none. */
export function tenureDone(need: Extract<Requirement, { type: "activity/tenure" }>, view: Pick<PlayerView, "job">): number {
  const held = view.job.id;
  if (held === null) return 0;
  const counts = need.activities.length === 0 || need.activities.includes(held);
  return counts ? Math.min(view.job.months, need.months) : 0;
}

/** A need for months in a trade as its progress: "2 / 18 months". */
export function tenureWords(need: Extract<Requirement, { type: "activity/tenure" }>, view: Pick<PlayerView, "job">): string {
  return say("ui.need.months", { done: tenureDone(need, view), need: need.months });
}

/** The needs of a job its entry lists that already hold: those the view does not list as still needed. Only a quality, a paper or months are told. */
export function metNeeds(job: string, needs: readonly Requirement[]): Requirement[] {
  const unmet = new Set(needs.map((need) => JSON.stringify(need)));
  const told = new Set<Requirement["type"]>(["quality/min", "document/held", "activity/tenure"]);
  return (content.activity[job as Id<"activity">]?.requires ?? []).filter((need) => told.has(need.type) && !unmet.has(JSON.stringify(need)));
}

function TenureChip({ need, view, fold }: { need: Extract<Requirement, { type: "activity/tenure" }>; view: NeedView; fold: boolean }) {
  const [open, setOpen] = useState(false);
  const jobs = need.activities.map((job) => nameOf(job));
  return (
    <li className="flex min-w-0 flex-col gap-1" data-need="tenure">
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="sticker-chip num bg-tint-study" data-need-months>
          {tenureWords(need, view)}
        </span>
        {fold && jobs.length > 0 ? (
          <button type="button" className="press text-[12px] font-bold text-text-2 underline" aria-expanded={open} onClick={() => setOpen((was) => !was)} data-need-which>
            {say("ui.need.which")}
          </button>
        ) : null}
      </span>
      {open ? (
        <ul className="flex flex-wrap gap-1 text-[12px] text-text-2" data-need-jobs>
          {jobs.map((job) => (
            <li key={job} className="rounded-[6px] bg-sheet-muted px-1.5 py-0.5">
              {job}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * The chips: each need still asked, then the needs already met with a tick. `fold` lets months in a trade unfold the
 * jobs that count; inside a button (the Bank's road) nothing unfolds, since the tap is the road's.
 */
export function NeedChips({ needs, met = [], view, fold = true }: { needs: readonly Requirement[]; met?: readonly Requirement[]; view: NeedView; fold?: boolean }) {
  const chip = (need: Requirement, state: "done" | "failed", index: number) =>
    need.type === "activity/tenure" ? (
      state === "failed" ? (
        <TenureChip key={`t-${String(index)}`} need={need} view={view} fold={fold} />
      ) : null
    ) : (
      <li key={`${state}-${String(index)}`} className="flex items-center gap-1 rounded-[6px] bg-sheet-muted px-1.5 py-1 text-[12px] font-bold leading-tight" data-need={need.type} data-need-state={state}>
        <Mark state={state} size={16} word={say(state === "done" ? "ui.need.met" : "ui.need.unmet")} />
        {requirementSentence(need, { routes: view.routes })}
      </li>
    );
  return (
    <ul className="mt-1 flex flex-wrap items-start gap-1.5" data-need-chips>
      {needs.map((need, index) => chip(need, "failed", index))}
      {met.map((need, index) => chip(need, "done", index))}
    </ul>
  );
}
