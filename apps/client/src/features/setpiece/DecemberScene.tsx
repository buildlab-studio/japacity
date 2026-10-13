// The December visit (R-RETURN-005) as a scene of its own: the whole screen,
// one question at a time, each answer with its price in the country's
// currency, the free answer first, and an answer the view does not allow
// greyed, still visible, with the words of the rejection the engine would
// give and the price it needs (R-SETPIECE-003).
// It waits for the staged wins, the report and the card, and can be set aside
// to look at the money first; the month cannot end until it is answered.
import { Dialog } from "@base-ui/react/dialog";
import { content } from "@japacity/content";
import type { Currency, Effect, Id, PlayerView, SetpieceAnswer } from "@japacity/sim";
import { Gift } from "lucide-react";
import { useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { rejectionWords } from "../../authority/store";
import { Button } from "../../shared/ui/Button";
import { FullScreen } from "../../shared/ui/FullScreen";
import { Card } from "../../shared/ui/Panel";
import { Rejection } from "../../shared/ui/Rejection";
import { useScenesTurn } from "../../shared/ui/stage";
import { formatMoney } from "../../shared/words/format";
import { nameOf, say, words } from "../../shared/words/text";

export const DECEMBER: Id<"setpiece"> = "setpiece.december";

type Money = { currency: Currency; amount: number };

/** The answer's entry in content, or undefined when content does not know it. */
function answerEntry(question: string, answer: string): SetpieceAnswer | undefined {
  return content.setpiece[DECEMBER]?.questions.find((candidate) => candidate.id === question)?.answers.find((candidate) => candidate.id === answer);
}

/** What an answer takes, by currency, from its own effects. Empty: it is free. */
export function answerPrice(question: string, answer: string): Money[] {
  const effects: Effect[] = answerEntry(question, answer)?.effects ?? [];
  const taken = new Map<Currency, number>();
  for (const effect of effects) {
    if (effect.type !== "money/take" || typeof effect.amount !== "number") continue;
    taken.set(effect.currency, (taken.get(effect.currency) ?? 0) + effect.amount);
  }
  return [...taken].map(([currency, amount]) => ({ currency, amount }));
}

/** The answers in the order the scene shows them: the free ones first, the rest as content gives them. */
export function sceneOrder(question: string, answers: readonly string[]): string[] {
  const free = answers.filter((answer) => answerPrice(question, answer).length === 0);
  return [...free, ...answers.filter((answer) => !free.includes(answer))];
}

/** The currency the scene is paid in: the first price among the question's answers, or the country's. */
function sceneCurrency(view: PlayerView, question: string, answers: readonly string[]): Currency | null {
  for (const answer of answers) {
    const price = answerPrice(question, answer)[0];
    if (price !== undefined) return price.currency;
  }
  const country = view.place.country;
  return country === null ? null : (content.country[country]?.currency ?? null);
}

function Answer({ question, answer, allowed }: { question: string; answer: string; allowed: boolean }) {
  const view = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const price = answerPrice(question, answer);
  const label = words(`${DECEMBER}.a.${question}.${answer}`);
  const first = price[0];
  const have = first === undefined ? null : formatMoney(view.pockets[first.currency].bank + view.pockets[first.currency].cash, first.currency);
  return (
    <li className="flex flex-col gap-1" data-answer={answer} data-allowed={allowed ? "true" : "false"}>
      <Button
        variant={price.length === 0 ? "secondary" : "primary"}
        className="w-full justify-between text-left"
        disabled={!allowed || busy || view.ended}
        onClick={() => void send({ type: "setpiece/answer", question, answer })}
      >
        <span className="flex-1 py-2">{label}</span>
        <span className="shrink-0 text-sm font-semibold tabular-nums">
          {price.length === 0 ? say("ui.december.free") : price.map(({ currency, amount }) => formatMoney(amount, currency)).join(" + ")}
        </span>
      </Button>
      {allowed ? null : (
        <p className="text-sm opacity-90" data-not-allowed>
          {rejectionWords("not-legal")} {have === null || first === undefined ? null : say("ui.december.short", { need: formatMoney(first.amount, first.currency), have })}
        </p>
      )}
    </li>
  );
}

function Scene({ onSetAside }: { onSetAside: () => void }) {
  const view = useView();
  const setpiece = view.setpiece;
  if (setpiece === null || setpiece.question === null) return null;
  const { question } = setpiece;
  const currency = sceneCurrency(view, question.id, question.answers);
  const held = currency === null ? null : view.pockets[currency];
  return (
    <div className="flex w-full max-w-xl flex-col gap-6" data-scene={DECEMBER}>
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold tracking-widest uppercase opacity-80">
          <Gift size={16} />
          {nameOf(DECEMBER)}
        </p>
        <p className="text-sm opacity-80">{say("ui.setpiece.question", { n: setpiece.asked + 1, total: setpiece.total })}</p>
        <Dialog.Title className="text-3xl leading-tight font-bold sm:text-4xl">{words(`${DECEMBER}.q.${question.id}`)}</Dialog.Title>
      </div>
      {currency === null || held === null ? null : (
        <p className="text-sm tabular-nums">{say("ui.december.have", { amount: formatMoney(held.bank + held.cash, currency) })}</p>
      )}
      <ul className="flex flex-col gap-3">
        {sceneOrder(question.id, question.answers).map((answer) => (
          <Answer key={answer} question={question.id} answer={answer} allowed={question.allowed.includes(answer)} />
        ))}
      </ul>
      <Rejection />
      <div className="flex flex-col gap-1 border-t border-current/30 pt-4 text-sm">
        <p className="opacity-80">{say("ui.setpiece.blocks")}</p>
        <div>
          <button type="button" className="min-h-9 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current" onClick={onSetAside}>
            {say("ui.december.set-aside")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** The tile in the month plan while the visit waits, and the scene itself when it is its turn. */
export function DecemberScene() {
  const { setpiece } = useView();
  const turn = useScenesTurn();
  const [aside, setAside] = useState<number | null>(null);
  if (setpiece === null || setpiece.entry !== DECEMBER) return null;
  // Setting it aside holds for the question on screen; the next question opens the scene again.
  const open = turn && aside !== setpiece.asked;
  return (
    <>
      <Card tone="attention" className="flex flex-wrap items-center justify-between gap-3" data-december-tile>
        <div className="flex items-start gap-3">
          <Gift size={22} className="mt-0.5 shrink-0" />
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{nameOf(DECEMBER)}</h2>
            <p className="text-sm text-text-2">{say("ui.setpiece.blocks")}</p>
          </div>
        </div>
        <Button small variant="primary" onClick={() => setAside(null)}>
          {say("ui.december.open")}
        </Button>
      </Card>
      <FullScreen open={open} onClose={() => setAside(setpiece.asked)} title={nameOf(DECEMBER)}>
        <Scene onSetAside={() => setAside(setpiece.asked)} />
      </FullScreen>
    </>
  );
}
