// The head of the month plan, the last report, and the report sheet that
// opens when a month ends.
import { useGame, useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Panel";
import { Sheet } from "../../shared/ui/Sheet";
import { say } from "../../shared/words/text";
import { ReportBody } from "./ReportBody";

export function TurnView() {
  const view = useView();
  const reportOpen = useGame((state) => state.reportOpen);
  const setReportOpen = useGame((state) => state.setReportOpen);
  const report = view.report;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-bold">{say("ui.month.planning", { month: view.month + 1 })}</h2>
        <span className="text-muted">{say("ui.month.banked", { banked: view.turns.banked, cap: view.turns.cap })}</span>
      </div>

      {view.ended ? <Card tone="attention">{say("ui.month.over")}</Card> : null}

      <Card>
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="font-semibold">
            {report === null ? say("ui.report.last") : say("ui.report.title", { month: report.month })}
          </h3>
          {report === null ? null : (
            <Button variant="quiet" small onClick={() => setReportOpen(true)}>
              {say("ui.report.open")}
            </Button>
          )}
        </div>
        {report === null ? (
          <p className="mt-2 text-muted">{say("ui.report.none")}</p>
        ) : (
          <div className="mt-2 max-h-48 overflow-y-auto">
            <ReportBody report={report} />
          </div>
        )}
      </Card>

      {report === null ? null : (
        <Sheet open={reportOpen} onOpenChange={setReportOpen} title={say("ui.report.title", { month: report.month })}>
          <ReportBody report={report} />
        </Sheet>
      )}
    </div>
  );
}
