// The hunt's jobs as a list (docs/rules/world.md R-WORLD-006): each job the hunt can
// ask for is a row with its pay a month and its chance in words, and the jobs at home still out of reach are listed
// apart with what each still needs. A row is picked by a tap; the list replaces the bare select.
import { content } from "@japacity/content";
import type { ActivityEntry, Id, PlayerView, Requirement } from "@japacity/sim";

import { formatMoney } from "../../shared/words/format";
import { requirementSentence } from "../../shared/words/requirement";
import { nameOf } from "../../shared/words/text";
import { type ChanceBand, chanceBand, chanceOf, jobCardWords, jobChanceBp, jobsWords, payWords } from "../../shared/words/jobs";

// The figures and words moved to shared/words/jobs.ts so the city can read them; the list's tests keep these names.
export { type ChanceBand, chanceBand, jobCardWords, jobChanceBp };
import { payAMonth } from "../../shared/words/pay";

/** A job's pay a month in its own currency, for ordering; pay in another currency than naira goes first, as the best paid. */
function payRank(id: string): number {
  const pay = payAMonth(id);
  if (pay === null) return 0;
  return pay.currency === "NGN" ? pay.amount : Number.MAX_SAFE_INTEGER;
}

const BAND_RANK: Record<ChanceBand, number> = { likely: 0, fair: 1, long: 2 };

/** The jobs in the order the list shows them: the likely first, then the fair chances, then the long shots, the best paid first in each. */
export function huntOrder(view: PlayerView, jobs: readonly string[]): string[] {
  return [...jobs].sort((a, b) => BAND_RANK[chanceBand(chanceOf(view, a))] - BAND_RANK[chanceBand(chanceOf(view, b))] || payRank(b) - payRank(a));
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

function JobRow({ id, chance, chosen, onPick }: { id: string; chance: ChanceBand; chosen: boolean; onPick: (id: string) => void }) {
  const pay = payWords(id);
  return (
    <li>
      <button
        type="button"
        role="radio"
        aria-checked={chosen}
        data-job={id}
        onClick={() => onPick(id)}
        className={`flex min-h-12 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left ${chosen ? "border-ink bg-sunk" : "border-line bg-paper"}`}
      >
        <span aria-hidden className={`size-4 shrink-0 rounded-full border-2 ${chosen ? "border-ink bg-ink" : "border-line"}`} />
        <span className="flex flex-1 flex-col">
          <span className="font-medium">{nameOf(id)}</span>
          {pay === null ? null : <span className="text-sm tabular-nums">{pay}</span>}
        </span>
        <span className={`text-xs font-semibold ${chance === "likely" ? "text-good" : chance === "long" ? "text-muted" : ""}`} data-chance={chance}>
          {jobsWords(`jobs.chance.${chance}`)}
        </span>
      </button>
    </li>
  );
}

/** The hunt's jobs as rows to tap, in `huntOrder`, and the jobs out of reach apart. */
export function JobList({ view, jobs, chosen, onPick }: { view: PlayerView; jobs: readonly string[]; chosen: string; onPick: (id: string) => void }) {
  const out = jobsOutOfReach(view, jobs);
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-col gap-1">
        <span className="font-medium" id="jobs-pick">
          {jobsWords("jobs.pick")}
        </span>
        <ul role="radiogroup" aria-labelledby="jobs-pick" className="flex flex-col gap-1.5" data-jobs>
          {jobs.map((id) => (
            <JobRow key={id} id={id} chance={chanceBand(chanceOf(view, id))} chosen={id === chosen} onPick={onPick} />
          ))}
        </ul>
      </div>
      {out.length === 0 ? null : (
        <div className="flex flex-col gap-1">
          <span className="font-medium text-muted" id="jobs-out">
            {jobsWords("jobs.out-of-reach")}
          </span>
          <ul aria-labelledby="jobs-out" className="flex flex-col gap-1.5" data-jobs-out>
            {out.map((job) => (
              <li key={job.id} className="flex flex-col rounded-lg border border-dashed border-line px-3 py-2 text-muted" data-job={job.id}>
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{nameOf(job.id)}</span>
                  <span className="tabular-nums">{payWords(job.id)}</span>
                </span>
                <span>{jobsWords("jobs.needs", { needs: job.needs.join("; ") })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
