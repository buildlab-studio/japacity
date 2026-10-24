// The overstay's warning (status:view-shows-status, status:grace-before-overstaying, status:detection-gives-notice): over every app on
// the phone, where the status clock stands, the stage in plain words. The grace is told quietly, since nothing has gone
// wrong yet; the overstay and the notice are told as the clock is, in the warning's colour.
import { Hourglass } from "lucide-react";

import { useView } from "../../authority/GameProvider";
import { overstayWords } from "../../shared/words/overstay";

/** The stage in a banner, or nothing on a status that is not an overstay. */
export function OverstayBanner({ className = "" }: { className?: string }) {
  const view = useView();
  const said = overstayWords(view);
  if (said === null) return null;
  const quiet = said.stage === "grace";
  return (
    <div
      role={quiet ? "status" : "alert"}
      data-overstay-banner={said.stage}
      className={`flex items-start gap-3 rounded-md px-3 py-3 ${quiet ? "bg-[var(--soft)] text-[var(--soft-ink)]" : "bg-out-fill text-on-strong"} ${className}`}
    >
      <Hourglass size={22} aria-hidden className="mt-0.5 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-base leading-tight font-bold">{said.title}</p>
        <p className="text-sm leading-snug">{said.line}</p>
        {said.pending === null ? null : <p className="text-sm leading-snug font-semibold">{said.pending}</p>}
        {said.fine === null ? null : <p className="num text-sm leading-snug font-semibold">{said.fine}</p>}
      </div>
    </div>
  );
}
