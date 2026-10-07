// Report lines as a list: the month report and the outcome of a choice both
// use it, so a line reads the same wherever it shows.
import type { ReportLine } from "@japacity/sim";
import { ArrowDownRight, ArrowUpRight, Dot } from "lucide-react";

import { tidyLines } from "../words/lines";
import { say, words } from "../words/text";
import { Tag } from "./Panel";

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

/** The lines in the simulation's order, one line for each payment. */
export function ReportLines({ lines }: { lines: readonly ReportLine[] }) {
  return (
    <ol className="flex flex-col">
      {tidyLines(lines).map((line, index) => (
        <Line key={`${line.key}-${String(index)}`} line={line} />
      ))}
    </ol>
  );
}
