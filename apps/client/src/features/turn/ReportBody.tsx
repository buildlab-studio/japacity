import type { ReportLine, TurnReport } from "@japacity/sim";
import { ArrowDownRight, ArrowUpRight, Dot } from "lucide-react";

import { Tag } from "../../shared/ui/Panel";
import { say, words } from "../../shared/words/text";

function percent(value: number | null): string {
  return value === null ? say("ui.japacity.none") : `${String(value)}%`;
}

function Line({ line }: { line: ReportLine }) {
  const Icon = line.tone === "good" ? ArrowUpRight : line.tone === "bad" ? ArrowDownRight : Dot;
  const toneClass = line.tone === "good" ? "text-good" : line.tone === "bad" ? "text-bad" : "text-muted";
  return (
    <li
      data-attention={line.attention ? "true" : undefined}
      className={`flex items-start gap-2 rounded-lg py-2 ${line.attention ? "border-l-4 border-l-accent bg-surface pl-3" : ""}`}
    >
      <Icon size={18} className={`mt-0.5 shrink-0 ${toneClass}`} />
      <div className="flex flex-1 flex-col gap-1">
        {line.attention ? (
          <span>
            <Tag tone="accent">{say("ui.report.needs-you")}</Tag>
          </span>
        ) : null}
        <span>{words(line.key, line.params)}</span>
      </div>
    </li>
  );
}

/** One month's report: what changed, in the simulation's order, and japacity before and after. */
export function ReportBody({ report }: { report: TurnReport }) {
  const moved = report.japacityBefore !== report.japacityAfter;
  return (
    <div className="flex flex-col gap-3">
      {report.attention ? <p className="font-medium">{say("ui.report.attention")}</p> : null}
      {report.lines.length === 0 ? (
        <p className="text-muted">{say("ui.report.quiet")}</p>
      ) : (
        <ol className="flex flex-col">
          {report.lines.map((line, index) => (
            <Line key={`${line.key}-${String(index)}`} line={line} />
          ))}
        </ol>
      )}
      <p className={moved ? "font-semibold" : "text-muted"}>
        {moved
          ? say("ui.report.japacity", { before: percent(report.japacityBefore), after: percent(report.japacityAfter) })
          : say("ui.report.japacity-same", { value: percent(report.japacityAfter) })}
      </p>
    </div>
  );
}
