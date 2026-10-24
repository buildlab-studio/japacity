// The genuineness interview as a set piece for two (docs/rules/interview.md):
// one question at a time with its options, never a truth or a score; while a
// question waits the month cannot end. Once this side has answered it waits
// for the other, and the player carries on. After scoring: the result and how
// many answers agreed, never which (interview:answers-taken-in-order, interview:one-question-at-a-time, interview:players-answer-at-own-pace). Dressed as
// the ask (design page 09 section 4): the officer's pill and the desk's tile
// at the head, the question as the title, the options as the ask's replies.
import type { PlayerView } from "@japacity/sim";
import { useEffect, useRef, type ReactNode } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { optionWords } from "../../shared/view/person";
import { Tile } from "../../shared/tiles/Tile";
import { Face } from "../../shared/ui/look/Face";
import { StickerChip } from "../../shared/ui/look/StickerChip";
import { nameOf, runningName, say, words } from "../../shared/words/text";

const ENTRY = "interview.genuineness";

/** The desk the officer sits at, as the toast at the close shows it (interview:answers-taken-in-order). */
export const INTERVIEW_DESK = "activity.interview-prep";

type Interview = NonNullable<PlayerView["interview"]>;

/**
 * The ask's head (design page 09 section 4): the desk's tile on its soft tile, the
 * officer's name pill with the flat mark, and the title of the moment in the officer's plain English.
 */
function Head({ title }: { title: ReactNode }) {
  return (
    <div className="flex items-center gap-3" data-interview-head>
      <span className="flex size-[64px] shrink-0 items-center justify-center rounded-[18px] bg-tint-study" aria-hidden>
        <span className="sticker-cut" style={{ rotate: "-5deg" }}>
          <Tile of={INTERVIEW_DESK} size={46} />
        </span>
      </span>
      <div className="min-w-0">
        <Face name={say("ui.interview.in.who")} className="text-[13px]" />
        <h3 className="mt-1 text-[22px] leading-tight font-bold" data-interview-title>
          {title}
        </h3>
      </div>
    </div>
  );
}

function Question({ interview }: { interview: Interview }) {
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  const ended = useView().ended;
  const { question } = interview;
  if (question === null) return null;
  return (
    // One question at a time (interview:one-question-at-a-time): its options as the ask's replies, none of them the main one, since no answer is right.
    <div className="flex flex-col gap-2.5" data-interview-options>
      {question.options.map((option) => (
        <button
          key={option}
          type="button"
          className="ask-reply press flex min-h-[56px] w-full items-center px-4 py-2.5 text-left text-[17px] leading-tight font-bold disabled:opacity-50"
          disabled={busy || ended}
          onClick={() => void send({ type: "interview/answer", question: question.id, option })}
          data-interview-option={option}
        >
          {optionWords(question.id, option)}
        </button>
      ))}
    </div>
  );
}

const RESULT_TINT = { pass: "money", doubt: "plain", fail: "body", caught: "body" } as const;

/** The result card: shown while the application it is for waits on its decision. */
function Result({ interview }: { interview: Interview }) {
  const view = useView();
  const { result, matched } = interview;
  if (result === null || matched === null) return null;
  const waiting = view.routes.find((route) => route.id === interview.route)?.state === "applying";
  if (!waiting) return null;
  return (
    <section aria-label={say("ui.interview.result", { piece: nameOf(ENTRY), route: runningName(interview.route) })} className="flex flex-col gap-3" data-interview-result={result}>
      <Head title={say(`ui.interview.result.${result}`)} />
      <p className="text-[16px] leading-snug">{say("ui.interview.matched", { matched, asked: interview.total })}</p>
      <div className="flex flex-wrap gap-2">
        <StickerChip tint={RESULT_TINT[result]}>{say("ui.interview.for", { route: runningName(interview.route) })}</StickerChip>
      </div>
    </section>
  );
}

export function InterviewView() {
  const { interview } = useView();
  const card = useRef<HTMLElement>(null);
  const asking = interview?.result === null && interview.question !== null ? interview.question.id : null;
  // A question waiting blocks the month, so it is brought into view.
  useEffect(() => {
    if (asking !== null) card.current?.scrollIntoView?.({ block: "start" });
  }, [asking]);
  if (interview === null) return null;
  if (interview.result !== null) return <Result interview={interview} />;
  const { question } = interview;
  return (
    // The region keeps the interview's name from content for a screen reader; on screen, the officer asks.
    <section ref={card} aria-label={nameOf(ENTRY)} className="flex scroll-mt-20 flex-col gap-3" data-interview={interview.waiting ? "waiting" : "open"}>
      <Head title={question === null ? say("ui.interview.in") : words(`${ENTRY}.q.${question.id}`)} />
      {question === null ? null : <p className="text-[16px] leading-snug" data-interview-line>{words(`${ENTRY}.blurb`)}</p>}
      <div className="flex flex-wrap gap-2">
        <StickerChip tint="study" tilt={-2}>
          {say("ui.interview.for", { route: runningName(interview.route) })}
        </StickerChip>
        {question === null ? null : (
          <StickerChip tilt={2}>
            <span data-interview-count>{say("ui.interview.question", { n: interview.asked + 1, total: interview.total })}</span>
          </StickerChip>
        )}
      </div>
      <Question interview={interview} />
      {question === null ? null : <p className="text-[14px] leading-snug text-text-2">{say("ui.interview.blocks")}</p>}
      {interview.waiting ? <p className="text-[16px] leading-snug">{say("ui.interview.waiting")}</p> : null}
      {interview.standIn ? <p className="text-[14px] leading-snug text-text-2">{say("ui.interview.stand-in")}</p> : null}
    </section>
  );
}
