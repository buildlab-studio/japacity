// A chance said as a word with a small three-step gauge beside it (activity:job-hunt-lands-offer): the bars carry the
// shape, so the band never rests on colour alone, and the word is always there with them.
import type { ChanceBand } from "../words/jobs";

const STEPS: Record<ChanceBand, 1 | 2 | 3> = { long: 1, fair: 2, likely: 3, certain: 3 };

/** The gauge alone, hidden from a screen reader: the chance's word beside it is what is read. `chosen` draws it on the pick colour. */
export function Gauge({ chance, chosen = false }: { chance: ChanceBand; chosen?: boolean }) {
  const steps = STEPS[chance];
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

/** The tint a chance's chip takes: the likely on study blue, a fair chance on the soft yellow, a long shot on lilac. */
export function chanceTint(chance: ChanceBand): string {
  return chance === "long" ? "bg-tint-body" : chance === "fair" ? "bg-[var(--soft)]" : "bg-tint-study";
}
