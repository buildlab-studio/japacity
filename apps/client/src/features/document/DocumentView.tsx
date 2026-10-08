// Papers: held, on the way, expired.
import { FileCheck, FileClock, FileX } from "lucide-react";

import { useView } from "../../authority/GameProvider";
import { Card, Empty, Panel } from "../../shared/ui/Panel";
import { formatBand, monthEnding } from "../../shared/words/format";
import { monthsLeft, SOON } from "../../shared/words/expiry";
import { nameOf, say, sayCount } from "../../shared/words/text";

const ENGLISH_RESULT = "document.english-test";

export function DocumentView() {
  const { documents, month } = useView();
  return (
    <Panel title={say("ui.document.title")}>
      {documents.length === 0 ? (
        <Empty>{say("ui.document.none")}</Empty>
      ) : (
        <Card>
          <ul className="flex flex-col gap-3">
            {documents.map((paper) => {
              const left = monthsLeft(paper, month);
              const soon = left !== null && left <= SOON;
              const Icon = paper.state === "held" ? FileCheck : paper.state === "pending" ? FileClock : FileX;
              return (
                <li key={paper.id} data-state={paper.state} className="flex items-start gap-3">
                  <Icon size={20} className={`mt-0.5 shrink-0 ${paper.state === "held" ? "text-good" : paper.state === "expired" ? "text-bad" : "text-muted"}`} />
                  <div className="flex flex-col">
                    <span className={`font-medium ${paper.state === "expired" ? "line-through" : ""}`}>{nameOf(paper.id)}</span>
                    <span className="text-sm text-muted">
                      {paper.state === "pending" && paper.readyMonth !== null
                        ? say("ui.document.pending", { month: monthEnding(paper.readyMonth) })
                        : paper.state === "expired"
                          ? say("ui.document.expired")
                          : paper.expiresMonth === null
                            ? say("ui.document.held")
                            : say("ui.document.expires", { month: monthEnding(paper.expiresMonth) })}
                    </span>
                    {soon && left !== null ? (
                      <span className="text-sm font-medium text-bad">
                        {sayCount("ui.document.expires-soon", left, { months: left, month: monthEnding(paper.expiresMonth ?? 0) })}
                      </span>
                    ) : null}
                    {paper.id === ENGLISH_RESULT && paper.value !== null ? (
                      <span className="text-sm font-semibold">{say("ui.document.band", { band: formatBand(paper.value) })}</span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </Panel>
  );
}
