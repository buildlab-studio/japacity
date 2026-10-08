// The interview: one question at a time. While it is open the month cannot
// end, so it sits at the top of the month plan. The December visit has a
// scene of its own.
import { MessageCircleQuestion } from "lucide-react";

import { useGame, useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Card, Tag } from "../../shared/ui/Panel";
import { nameOf, say, words } from "../../shared/words/text";
import { DECEMBER, DecemberScene } from "./DecemberScene";

export function SetpieceView() {
  const { setpiece, ended } = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  if (setpiece === null) return null;
  if (setpiece.entry === DECEMBER) return <DecemberScene />;
  const { question } = setpiece;

  return (
    <section aria-label={nameOf(setpiece.entry)}>
      <Card tone="attention" className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <MessageCircleQuestion size={22} className="mt-0.5 shrink-0" />
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{nameOf(setpiece.entry)}</h2>
            <p className="text-sm text-muted">{say("ui.setpiece.blocks")}</p>
          </div>
        </div>
        {question === null ? null : (
          <>
            <p className="text-sm font-medium text-muted">{say("ui.setpiece.question", { n: setpiece.asked + 1, total: setpiece.total })}</p>
            <p className="text-xl font-semibold">{words(`${setpiece.entry}.q.${question.id}`)}</p>
            <ul className="flex flex-col gap-2">
              {question.answers.map((answer) => {
                const weak = question.weak.includes(answer);
                return (
                  <li key={answer}>
                    <Button
                      className="w-full justify-start text-left"
                      disabled={busy || ended || !question.allowed.includes(answer)}
                      onClick={() => void send({ type: "setpiece/answer", question: question.id, answer })}
                    >
                      <span className="flex-1 py-2">{words(`${setpiece.entry}.a.${question.id}.${answer}`)}</span>
                      {weak ? <Tag tone="bad">{say("ui.setpiece.weak")}</Tag> : null}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </section>
  );
}
