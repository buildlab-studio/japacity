// The genuineness interview as a set piece for two (docs/rules/interview.md):
// one question at a time with its options, never a truth or a score; while a
// question waits the month cannot end. Once this side has answered it waits
// for the other, and the player carries on. After scoring: the result and how
// many answers agreed, never which (R-INTERVIEW-004, 005, 011).
import type { PlayerView } from "@japacity/sim";
import { Hourglass, MessagesSquare } from "lucide-react";

import { useGame, useView } from "../../authority/GameProvider";
import { optionWords } from "../../shared/sim/people";
import { Button } from "../../shared/ui/Button";
import { Card, Tag } from "../../shared/ui/Panel";
import { nameOf, runningName, say, words } from "../../shared/words/text";

const ENTRY = "interview.genuineness";

type Interview = NonNullable<PlayerView["interview"]>;

function Question({ interview }: { interview: Interview }) {
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const ended = useView().ended;
  const { question } = interview;
  if (question === null) return null;
  return (
    <>
      <p className="text-sm font-medium text-muted">{say("ui.interview.question", { n: interview.asked + 1, total: interview.total })}</p>
      <p className="text-xl font-semibold">{words(`${ENTRY}.q.${question.id}`)}</p>
      <ul className="flex flex-col gap-2">
        {question.options.map((option) => (
          <li key={option}>
            <Button className="w-full justify-start text-left" disabled={busy || ended} onClick={() => void send({ type: "interview/answer", question: question.id, option })}>
              <span className="flex-1 py-2">{optionWords(question.id, option)}</span>
            </Button>
          </li>
        ))}
      </ul>
    </>
  );
}

const RESULT_TONE = { pass: "good", doubt: "plain", fail: "bad", caught: "bad" } as const;

/** The result card: shown while the application it is for waits on its decision. */
function Result({ interview }: { interview: Interview }) {
  const view = useView();
  const { result, matched } = interview;
  if (result === null || matched === null) return null;
  const waiting = view.routes.find((route) => route.id === interview.route)?.state === "applying";
  if (!waiting) return null;
  return (
    <section aria-label={say("ui.interview.result", { route: runningName(interview.route) })}>
      <Card className="flex flex-col gap-2" data-interview-result={result}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="font-semibold">{say("ui.interview.result", { route: runningName(interview.route) })}</h2>
          <Tag tone={RESULT_TONE[result]}>{say(`ui.interview.result.${result}`)}</Tag>
        </div>
        <p>{say("ui.interview.matched", { matched, asked: interview.total })}</p>
      </Card>
    </section>
  );
}

export function InterviewView() {
  const { interview } = useView();
  if (interview === null) return null;
  if (interview.result !== null) return <Result interview={interview} />;
  return (
    <section aria-label={nameOf(ENTRY)}>
      <Card tone={interview.question === null ? "plain" : "attention"} className="flex flex-col gap-4" data-interview={interview.waiting ? "waiting" : "open"}>
        <div className="flex items-start gap-3">
          {interview.waiting ? <Hourglass size={22} className="mt-0.5 shrink-0" /> : <MessagesSquare size={22} className="mt-0.5 shrink-0" />}
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{nameOf(ENTRY)}</h2>
            <p className="text-sm text-muted">{say("ui.interview.for", { route: runningName(interview.route) })}</p>
            {interview.question === null ? null : <p className="text-sm text-muted">{say("ui.interview.blocks")}</p>}
          </div>
        </div>
        <Question interview={interview} />
        {interview.waiting ? <p>{say("ui.interview.waiting")}</p> : null}
        {interview.standIn ? <p className="text-sm text-muted">{say("ui.interview.stand-in")}</p> : null}
      </Card>
    </section>
  );
}
