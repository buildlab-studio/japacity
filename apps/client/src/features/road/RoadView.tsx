// On the road there is one panel: the chain's card and the exit, and nothing
// else (road.md, the rule on what the chain earns and shows). No japacity, no
// share card, no tabs, no advert slot. The months pass while you wait, so the
// one control besides the card is waiting a month.
import { DoorOpen, Hourglass } from "lucide-react";
import type { ReactNode } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Panel";
import { Rejection } from "../../shared/ui/Rejection";
import { ReportLines } from "../../shared/ui/ReportLines";
import { nameOf, say, words } from "../../shared/words/text";

/** Answers that leave the chain: turning back before the truth, the exit after it (R-ROAD-004, 007). */
const EXITS = new Set(["exit", "turn-back"]);

function ChainCard() {
  const { setpiece, ended } = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  if (setpiece === null || setpiece.question === null) return null;
  const { question } = setpiece;
  return (
    <Card className="flex flex-col gap-4" data-chain-card>
      <h2 className="text-lg font-semibold">{nameOf(setpiece.entry)}</h2>
      <p className="text-xl">{words(`${setpiece.entry}.q.${question.id}`)}</p>
      <ul className="flex flex-col gap-2">
        {question.answers.map((answer) => {
          const exit = EXITS.has(answer);
          return (
            <li key={answer}>
              <Button
                variant={exit ? "primary" : "secondary"}
                className="w-full justify-start text-left"
                disabled={busy || ended || !question.allowed.includes(answer)}
                data-exit={exit ? "true" : undefined}
                onClick={() => void send({ type: "setpiece/answer", question: question.id, answer })}
              >
                {exit ? <DoorOpen size={18} className="shrink-0" /> : null}
                <span className="flex-1 py-2">{words(`${setpiece.entry}.a.${question.id}.${answer}`)}</span>
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Exit() {
  return (
    <Card tone="attention" className="flex items-start gap-3" data-road-exit>
      <DoorOpen size={22} className="mt-0.5 shrink-0" />
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold">{say("ui.road.exit-title")}</h2>
        <p className="text-sm">{say("ui.road.exit-help")}</p>
      </div>
    </Card>
  );
}

function Wait() {
  const view = useView();
  const busy = useGame((state) => state.busy);
  const endMonth = useGame((state) => state.endMonth);
  const blocked = view.ended || view.turns.banked < 1;
  return (
    <div className="flex flex-col gap-2">
      <Rejection />
      <Button onClick={() => void endMonth()} disabled={busy || blocked || view.setpiece !== null}>
        <Hourglass size={18} />
        {say("ui.road.wait")}
      </Button>
    </div>
  );
}

/** `offers` is the offer panel, given by the shell: a ransom call is part of the chain. */
export function RoadView({ offers = null }: { offers?: ReactNode }) {
  const view = useView();
  const report = view.report;
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-4 px-4 py-6" data-road>
      <p className="text-sm font-semibold tracking-wide text-muted uppercase">{say("ui.road.title")}</p>
      <ChainCard />
      {view.offers.length === 0 ? null : offers}
      {report === null || report.lines.length === 0 ? null : (
        <Card className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted">{say("ui.report.title", { month: report.month })}</h2>
          <ReportLines lines={report.lines} />
        </Card>
      )}
      <Exit />
      <Wait />
    </main>
  );
}
