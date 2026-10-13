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
    <div role="alert" data-clock className={`flex items-center gap-4 rounded-md bg-bad p-4 text-on-strong ${className}`}>
      <AlarmClock size={36} className="shrink-0" />
      <p className="text-6xl leading-none font-bold tabular-nums" data-clock-figure>{clock}</p>
      <div className="flex flex-col">
        <p className="text-lg font-bold">{sayCount("ui.status.clock", clock, { months: clock })}</p>
        <p className="text-sm opacity-90">{say("ui.status.clock-why", { status: nameOf(view.status.entry) })}</p>
      </div>
    </div>
  );
}
