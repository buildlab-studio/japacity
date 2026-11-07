// A check against a target as a card (world:month-end-results-sheet): its title, a bar of what was shown against what is
// needed, both figures under the bar, and a stamp with the verdict. The stamp's words carry the verdict, so its colour
// never says it alone; the bar is a progress bar a screen reader reads with its title.
import type { CSSProperties } from "react";

export interface CheckMeterProps {
  title: string;
  value: number;
  max: number;
  /** The two figures under the bar, in full: what was shown, what is needed. */
  shown: string;
  needed: string;
  met: boolean;
  /** The verdict's words, on the stamp. */
  stamp: string;
  /** A short line under the figures, such as how many months it has held. */
  note?: string | null;
}

export function CheckMeter({ title, value, max, shown, needed, met, stamp, note = null }: CheckMeterProps) {
  const share = max <= 0 ? 0 : Math.min(1, Math.max(0, value / max));
  return (
    <div className="look-card relative flex flex-col gap-2 p-3 pt-3.5" data-check-meter={met ? "met" : "short"}>
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 flex-1 text-[14px] leading-snug font-semibold" data-check-title>
          {title}
        </span>
        <span className={`check-stamp shrink-0 rounded-[6px] px-1.5 py-0.5 text-[13px] leading-none font-extrabold ${met ? "check-stamp-met" : ""}`} style={{ "--r": met ? "-4deg" : "-6deg" } as CSSProperties} data-check-stamp>
          {stamp}
        </span>
      </div>
      <div role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)} className="h-3 w-full overflow-hidden rounded-[6px] bg-sheet-muted">
        <div className={`h-full rounded-[6px] ${met ? "bg-in-fill" : "bg-ink"}`} style={{ width: `${String(share * 100)}%` }} />
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[14px]">
        <span className="num font-bold" data-check-shown>
          {shown}
        </span>
        <span className="num text-text-2" data-check-needed>
          {needed}
        </span>
      </div>
      {note === null ? null : <span className="text-[13px] text-text-2" data-check-note>{note}</span>}
    </div>
  );
}
