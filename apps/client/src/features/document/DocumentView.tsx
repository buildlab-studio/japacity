// Papers: held, on the way, expired.
import { FileCheck, FileClock, FileX } from "lucide-react";

import { useView } from "../../authority/GameProvider";
import { Card, Empty, Panel } from "../../shared/ui/Panel";
import { formatBand } from "../../shared/words/format";
import { nameOf, say } from "../../shared/words/text";

const ENGLISH_RESULT = "document.english-test";

export function DocumentView() {
  const { documents } = useView();
  return (
    <Panel title={say("ui.document.title")}>
      {documents.length === 0 ? (
        <Empty>{say("ui.document.none")}</Empty>
      ) : (
        <Card>
          <ul className="flex flex-col gap-3">
            {documents.map((paper) => {
              const Icon = paper.state === "held" ? FileCheck : paper.state === "pending" ? FileClock : FileX;
              return (
                <li key={paper.id} data-state={paper.state} className="flex items-start gap-3">
                  <Icon size={20} className={`mt-0.5 shrink-0 ${paper.state === "held" ? "text-good" : paper.state === "expired" ? "text-bad" : "text-muted"}`} />
                  <div className="flex flex-col">
                    <span className={`font-medium ${paper.state === "expired" ? "line-through" : ""}`}>{nameOf(paper.id)}</span>
                    <span className="text-sm text-muted">
                      {paper.state === "pending" && paper.readyMonth !== null
                        ? say("ui.document.pending", { month: paper.readyMonth })
                        : paper.state === "expired"
                          ? say("ui.document.expired")
                          : paper.expiresMonth === null
                            ? say("ui.document.held")
                            : say("ui.document.expires", { month: paper.expiresMonth })}
                    </span>
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
