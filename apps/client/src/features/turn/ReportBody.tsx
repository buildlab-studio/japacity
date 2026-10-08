import type { TurnReport } from "@japacity/sim";

import { ReportLines } from "../../shared/ui/ReportLines";
import { asksAttention, tidyLines } from "../../shared/words/lines";
import { say } from "../../shared/words/text";

function percent(value: number): string {
  return `${String(value)}%`;
}

/** Japacity before and after the month, in words that never say "No route yet to 14%". */
function japacityWords(before: number | null, after: number | null): string {
  if (after === null) return say("ui.report.japacity-none");
  if (before === null) return say("ui.report.japacity-first", { after: percent(after) });
  if (before === after) return say("ui.report.japacity-same", { value: percent(after) });
  return say("ui.report.japacity", { before: percent(before), after: percent(after) });
}

/**
 * One month's report: what changed, in the simulation's order, and japacity
 * before and after. It says something needs an answer only when a line waits
 * on the player or `waiting` (a set piece open now) says so; news never does.
 */
export function ReportBody({ report, waiting = false }: { report: TurnReport; waiting?: boolean }) {
  const moved = report.japacityBefore !== report.japacityAfter;
  const needsAnswer = waiting || tidyLines(report.lines).some(asksAttention);
  return (
    <div className="flex flex-col gap-3">
      {needsAnswer ? <p className="font-medium">{say("ui.report.attention")}</p> : null}
      {report.lines.length === 0 ? <p className="text-muted">{say("ui.report.quiet")}</p> : <ReportLines lines={report.lines} />}
      <p className={moved ? "font-semibold" : "text-muted"}>{japacityWords(report.japacityBefore, report.japacityAfter)}</p>
    </div>
  );
}
