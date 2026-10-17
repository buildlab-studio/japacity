// The status clock (docs/rules/status.md R-STATUS-003): when the job is gone and the clock runs, it is the loudest
// thing on the screen, a banner in big type on the phone's home and above every app (the shell's warnings).
import { AlarmClock } from "lucide-react";

import { useView } from "../../authority/GameProvider";
import { nameOf, say, sayCount } from "../../shared/words/text";

/** The clock in big type, or nothing while no clock runs. */
export function ClockBanner({ className = "" }: { className?: string }) {
  const view = useView();
  const clock = view.status?.clock ?? null;
  if (clock === null || view.status === null) return null;
  return (
    // The figure stays big; the alarm sits small over it and the words take the rest of the row, so "2 months on the clock"
    // keeps to one line beside it on a phone at rest.
    <div role="alert" data-clock className={`flex items-center gap-3 rounded-md bg-bad px-3 py-3 text-on-strong ${className}`}>
      <div className="flex shrink-0 flex-col items-center gap-1">
        <AlarmClock size={22} aria-hidden />
        <p className="text-6xl leading-none font-bold tabular-nums" data-clock-figure>{clock}</p>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1" data-clock-words>
        <p className="text-base leading-tight font-bold">{sayCount("ui.status.clock", clock, { months: clock })}</p>
        <p className="text-sm leading-snug opacity-90">{say("ui.status.clock-why", { status: nameOf(view.status.entry) })}</p>
      </div>
    </div>
  );
}
