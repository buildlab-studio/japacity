// The hunt's jobs as a list (docs/rules/world.md R-WORLD-006): each job the hunt can
// ask for is a row with its pay a month and its chance in words, and the jobs at home still out of reach are listed
// apart with what each still needs. A row is picked by a tap; the list replaces the bare select. The rows sit straight
// on the sheet, divided by hairlines; the chosen row fills with the pick colour (R-WORLD-021), and the chance is a
// small three-step gauge beside its word.
import { content } from "@japacity/content";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import type { ActivityEntry, Id, PlayerView, Requirement } from "@japacity/sim";

import { requirementSentence } from "../../shared/words/requirement";
import { Tile } from "../../shared/tiles/Tile";
import { nameOf } from "../../shared/words/text";
import { type ChanceBand, chanceBand, chanceOf, huntBand, jobCardLine, jobCardWords, jobChanceBp, jobsWords, payWords } from "../../shared/words/jobs";

// The figures and words moved to shared/words/jobs.ts so the city can read them; the list's tests keep these names.
export { type ChanceBand, chanceBand, chanceOf, huntBand, jobCardLine, jobCardWords, jobChanceBp };
import { payAMonth } from "../../shared/words/pay";
import { liftWords } from "../../shared/words/profile";

/** A job's pay a month in its own currency, for ordering; pay in another currency than naira goes first, as the best paid. */
function payRank(id: string): number {
  const pay = payAMonth(id);
  if (pay === null) return 0;
  return pay.currency === "NGN" ? pay.amount : Number.MAX_SAFE_INTEGER;
}

// As good as certain orders with the likely, so the racks lead only where the character lives by them (R-ACTIVITY-017).
const BAND_RANK: Record<ChanceBand, number> = { certain: 0, likely: 0, fair: 1, long: 2 };

/** The fish racks at Makoko: work at hand for a life living there (R-ACTIVITY-017). */
const RACKS = "activity.job-fish-racks";

/**
 * The jobs in the order the list shows them: the likely first, then the fair chances, then the long shots, the best paid
 * first in each. While the character lives in Makoko the racks lead the list, as the nudge names them (R-ACTIVITY-017).
 */
export function huntOrder(view: PlayerView, jobs: readonly string[]): string[] {
  const atHand = view.home.place === "place.makoko" ? RACKS : null;
  return [...jobs].sort((a, b) => Number(b === atHand) - Number(a === atHand) || BAND_RANK[huntBand(chanceOf(view, a))] - BAND_RANK[huntBand(chanceOf(view, b))] || payRank(b) - payRank(a));
}

/** Schooling: what any school leaver's job asks for, so it marks no trade. */
const SCHOOLING = "quality.edu-level";

/**
 * A job of a trade: a main job that asks for something the life learned or earned
 * beyond schooling, a skill (code, care), a good degree's grade, a paper of its own, or months in a job before it.
 */
export function ofATrade(id: string): boolean {
  const entry = content.activity[id as Id<"activity">];
  if (entry === undefined || entry.slot !== "main") return false;
  return entry.requires.some((requirement) => (requirement.type === "quality/min" && requirement.quality !== SCHOOLING) || requirement.type === "document/held" || (requirement.type === "activity/tenure" && requirement.activities.length > 0));
}

/**
 * The job the board opens on (R-ACTIVITY-005 as amended 11 Oct 2026): the life's own trade
 * first, the first job of a trade in the board's order, before a job any school leaver may ask for; with a job held, the
 * first of them that pays more than it. While the racks lead the board in Makoko, they are the
 * pick (R-ACTIVITY-017). Null when nothing listed pays more than the job held.
 */
export function firstJob(view: PlayerView, ordered: readonly string[]): string | null {
  if (ordered[0] === RACKS && view.home.place === "place.makoko") return RACKS;
  const heldPay = view.job.id === null ? 0 : (payAMonth(view.job.id)?.amount ?? 0);
  const better = ordered.filter((id) => (payAMonth(id)?.amount ?? 0) > heldPay);
  return better.find(ofATrade) ?? better[0] ?? null;
}

function qualityOf(view: PlayerView, id: string): number {
  return view.qualities.find((quality) => quality.id === id)?.value ?? 0;
}

/** Whether the view shows a requirement met; one the view cannot judge counts as unmet, so it is named. */
function metNow(view: PlayerView, requirement: Requirement): boolean {
  if (requirement.type === "quality/min") return qualityOf(view, requirement.quality) >= requirement.value;
  if (requirement.type === "quality/max") return qualityOf(view, requirement.quality) <= requirement.value;
  return false;
}

/** Whether a job can be held where the character is: the hunt's own reading of R-PLACE-003. */
function appliesHere(entry: ActivityEntry, view: PlayerView): boolean {
  const where = entry.where ?? "home";
  if (where === "any") return true;
  if (where !== view.place.where) return false;
  return where !== "abroad" || entry.country === undefined || entry.country === null || entry.country === view.place.country;
}

export interface OutOfReach {
  id: string;
  /** What is still missing, as sentences. */
  needs: string[];
}

/** Jobs here that a hunt could land one day but cannot ask for now, each with what it still needs. A job with nothing to name is left out. */
export function jobsOutOfReach(view: PlayerView, open: readonly string[]): OutOfReach[] {
  const held = new Set([view.job.id, view.job.side]);
  return Object.values(content.activity)
    .filter((entry) => (entry.slot === "main" || entry.slot === "side") && entry.hireBp !== null && !held.has(entry.id) && !open.includes(entry.id) && appliesHere(entry, view))
    .map((entry) => ({ id: entry.id, needs: entry.requires.filter((requirement) => !metNow(view, requirement)).map((requirement) => requirementSentence(requirement, { routes: view.routes })) }))
    .filter((job) => job.needs.length > 0);
}

const GAUGE: Record<ChanceBand, 1 | 2 | 3> = { long: 1, fair: 2, likely: 3, certain: 3 };

/** The chance as a small three-step gauge, so it reads at a glance beside its word. */
function Gauge({ chance, chosen }: { chance: ChanceBand; chosen: boolean }) {
  const steps = GAUGE[chance];
  return (
    <span aria-hidden className="flex items-end gap-[3px]" data-gauge={steps}>
      {([1, 2, 3] as const).map((step) => (
        <span
          key={step}
          className={`w-[4px] rounded-[1px] ${step === 1 ? "h-1.5" : step === 2 ? "h-2.5" : "h-3.5"} ${step <= steps ? (chosen ? "bg-pick-mark" : "bg-text") : chosen ? "bg-on-pick/25" : "bg-sheet-line"}`}
        />
      ))}
    </span>
  );
}

/**
 * A job to hunt as a card: its picture, its name, the pay as a green chip and the chance as a
 * word in a pill with its gauge; the job picked ringed in yellow.
 */
function JobRow({ view, id, chance, chosen, onPick }: { view: PlayerView; id: string; chance: ChanceBand; chosen: boolean; onPick: (id: string) => void }) {
  const pay = payWords(id, view);
  const lift = liftWords(view, id);
  return (
    <li>
      <button type="button" role="radio" aria-checked={chosen} data-job={id} onClick={onPick.bind(null, id)} className="press block w-full text-left">
        <span className={`lively-card flex items-center gap-3 p-2.5 ${chosen ? "phone-picked" : ""}`} data-picked={chosen ? "true" : undefined}>
          <span className="flex size-14 shrink-0 items-center justify-center rounded-[14px] bg-tint-money">
            <span className="sticker-cut" style={{ rotate: "-5deg" }}>
              <Tile of={id} size={40} />
            </span>
          </span>
          <span className="flex w-0 min-w-0 flex-1 flex-col gap-1">
            <span className="text-[16px] leading-tight font-bold">{nameOf(id)}</span>
            {lift === null ? null : (
              <span className="num text-[12px] text-text-2" data-lift>
                {lift}
              </span>
            )}
            <span className="flex flex-wrap items-center gap-1.5">
              {pay === null ? null : (
                <span className="sticker-chip num bg-tint-money chip-wrap" style={{ rotate: "-2deg", color: "var(--money-ink)" }}>
                  {pay}
                </span>
              )}
              <span className={`sticker-chip ${chance === "long" ? "bg-tint-body" : chance === "fair" ? "bg-[var(--soft)]" : "bg-tint-study"}`} style={{ rotate: "1.5deg" }}>
                <Gauge chance={chance} chosen={false} />
                <span data-chance={chance}>{jobsWords(`jobs.chance.${chance}`)}</span>
              </span>
            </span>
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * A job out of reach as one row: its name and its pay on one line that never wraps, and what it still needs folded
 * behind a tap, so the list is read at a glance and the words come only when asked.
 */
function OutRow({ job, pay }: { job: OutOfReach; pay: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-sheet-line last:border-b-0" data-job={job.id}>
      <button type="button" className="press flex w-full items-center gap-2 px-3 py-2.5 text-left text-text-2" aria-expanded={open} onClick={() => setOpen((was) => !was)} data-job-needs={job.needs.length}>
        <span className="flex w-0 min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{nameOf(job.id)}</span>
          <span className="text-[12px]">{jobsWords(job.needs.length === 1 ? "jobs.needs-count.one" : "jobs.needs-count", { count: job.needs.length })}</span>
        </span>
        {pay === null ? null : <span className="num shrink-0 whitespace-nowrap text-[13px]">{pay}</span>}
        <ChevronDown size={16} aria-hidden className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <ul className="flex flex-col gap-1 px-3 pb-3 text-[13px] text-text-2" data-job-needs-list>
          {job.needs.map((need) => (
            <li key={need} className="flex gap-2">
              <span aria-hidden>·</span>
              <span>{need}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/** The main button's words when it applies for the picked job: the act, then the job, so the button repeats the pick. */
export function ApplyFor({ id }: { id: string }) {
  return (
    <>
      <span>{jobsWords("jobs.apply")}</span>
      <span className="min-w-0 truncate text-[13px] font-semibold opacity-80" data-apply-for={id}>
        {nameOf(id)}
      </span>
    </>
  );
}

/** The hunt's jobs as rows on the sheet, in `huntOrder`, and the jobs out of reach apart. */
export function JobList({ view, jobs, chosen, onPick }: { view: PlayerView; jobs: readonly string[]; chosen: string; onPick: (id: string) => void }) {
  const out = jobsOutOfReach(view, jobs);
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-col gap-1">
        <span className="font-medium" id="jobs-pick">
          {jobsWords("jobs.pick")}
        </span>
        <ul role="radiogroup" aria-labelledby="jobs-pick" className="flex flex-col gap-2" data-jobs>
          {jobs.map((id) => (
            <JobRow key={id} view={view} id={id} chance={huntBand(chanceOf(view, id))} chosen={id === chosen} onPick={onPick} />
          ))}
        </ul>
      </div>
      {out.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-text-2" id="jobs-out">
            {jobsWords("jobs.out-of-reach")}
          </span>
          <ul aria-labelledby="jobs-out" className="flex flex-col" data-jobs-out>
            {out.map((job) => (
              <OutRow key={job.id} job={job} pay={payWords(job.id, view)} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
