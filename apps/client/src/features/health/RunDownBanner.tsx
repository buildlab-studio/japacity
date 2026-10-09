// The run-down warning (R-HEALTH-001, R-HEALTH-007): while it stands, a banner
// above every tab says so, with wellbeing against the line and what helps.
// Illness comes from staying under the line, so the banner names the line.
import { content } from "@japacity/content";
import { HeartPulse } from "lucide-react";

import { useView } from "../../authority/GameProvider";
import { nameOf, say } from "../../shared/words/text";

const WELLBEING = "quality.wellbeing";

export function RunDownBanner({ className = "" }: { className?: string }) {
  const { runDown, qualities } = useView();
  if (!runDown) return null;
  const wellbeing = qualities.find((quality) => quality.id === WELLBEING)?.value ?? 0;
  return (
    <div role="alert" data-run-down className={`flex items-start gap-3 rounded-md border-2 border-bad bg-sheet-2 p-4 ${className}`}>
      <HeartPulse size={28} className="mt-0.5 shrink-0 text-bad" />
      <div className="flex flex-col gap-1">
        <p className="text-lg font-bold">{say("ui.health.run-down")}</p>
        <p className="text-sm tabular-nums">
          {say("ui.health.run-down-figure", { quality: nameOf(WELLBEING), value: wellbeing, line: content.tuning.health.runDownBelow })}
        </p>
        <p className="text-sm text-text-2">{say("ui.health.run-down-help")}</p>
      </div>
    </div>
  );
}
