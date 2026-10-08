// The credit file abroad (R-CREDIT-007): the mark as a meter with every entry
// that needs credit marked on it, the counts, a judgment and when it clears,
// and what the next ten points buy.
import { Gauge } from "lucide-react";

import { useView } from "../../authority/GameProvider";
import { Card, Panel } from "../../shared/ui/Panel";
import { nameOf, say, sayCount } from "../../shared/words/text";

const MARK_MAX = 100;
const STEP = 10;
/** A judgment keeps every need above this out of reach (R-CREDIT-006). */
const JUDGMENT_CAP = 20;

type File = NonNullable<ReturnType<typeof useView>["credit"]>;

function MarkMeter({ file }: { file: File }) {
  const label = say("ui.credit.mark", { mark: file.mark });
  return (
    <div className="flex flex-col gap-1">
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={MARK_MAX}
        aria-valuenow={file.mark}
        className="relative h-4 w-full rounded-full bg-sunk"
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${String(file.mark)}%` }} />
        {file.needs.map((need) => (
          <span
            key={need.id}
            aria-hidden="true"
            className={`absolute -top-1 h-6 w-0.5 ${need.creditMin <= file.mark ? "bg-good" : "bg-ink"}`}
            style={{ left: `${String(need.creditMin)}%` }}
          />
        ))}
      </div>
      <div className="relative h-5 text-xs text-muted" aria-hidden="true">
        {file.needs.map((need) => (
          <span key={need.id} className="absolute -translate-x-1/2 tabular-nums" style={{ left: `${String(need.creditMin)}%` }}>
            {need.creditMin}
          </span>
        ))}
      </div>
    </div>
  );
}

export function CreditView() {
  const view = useView();
  const file = view.credit;
  if (file === null) return null;
  const capped = file.judgmentUntil !== null;
  const reachable = (min: number) => !capped || min <= JUDGMENT_CAP;
  const open = file.needs.filter((need) => need.creditMin <= file.mark && reachable(need.creditMin));
  const next = file.needs.filter((need) => need.creditMin > file.mark && need.creditMin <= file.mark + STEP && reachable(need.creditMin));
  const later = file.needs.filter((need) => need.creditMin > file.mark + STEP || !reachable(need.creditMin));
  return (
    <Panel title={say("ui.credit.title")}>
      <Card className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <Gauge size={22} className="mt-0.5 shrink-0 text-muted" />
          <p className="flex items-baseline gap-2">
            <span className="font-display text-4xl leading-none tabular-nums">{file.mark}</span>
            <span className="text-muted">{say("ui.credit.of", { max: MARK_MAX })}</span>
          </p>
        </div>
        <MarkMeter file={file} />
        <p className="text-sm text-muted">
          {sayCount("ui.credit.on-time", file.onTime, { count: file.onTime })} {sayCount("ui.credit.missed", file.missed, { count: file.missed })}
        </p>
        {capped ? <p className="text-sm font-medium text-bad">{say("ui.credit.judgment", { month: file.judgmentUntil ?? 0, cap: JUDGMENT_CAP })}</p> : null}
        <div className="flex flex-col gap-1 text-sm" data-next-ten>
          <h3 className="font-semibold">{say("ui.credit.next-ten", { mark: Math.min(MARK_MAX, file.mark + STEP) })}</h3>
          {next.length === 0 ? (
            <p className="text-muted">{say("ui.credit.next-none")}</p>
          ) : (
            <ul className="list-disc pl-5">
              {next.map((need) => (
                <li key={need.id}>{say("ui.credit.need", { name: nameOf(need.id), min: need.creditMin })}</li>
              ))}
            </ul>
          )}
        </div>
        {open.length === 0 ? null : (
          <p className="text-sm">
            <span className="font-medium">{say("ui.credit.open")} </span>
            {open.map((need) => nameOf(need.id)).join(", ")}
          </p>
        )}
        {later.length === 0 ? null : (
          <p className="text-sm text-muted">
            <span className="font-medium">{say("ui.credit.later")} </span>
            {later.map((need) => say("ui.credit.need", { name: nameOf(need.id), min: need.creditMin })).join(", ")}
          </p>
        )}
      </Card>
    </Panel>
  );
}
