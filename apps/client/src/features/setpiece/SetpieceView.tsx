// A set piece, such as an interview: one question at a time. While it is open the month cannot
// end, so it sits at the top of the month plan. The December visit has a scene of its own, and
// the visa interview is spoken in a room of its own (InterviewRoom.tsx).
import { MessageCircleQuestion } from "lucide-react";
import { useEffect } from "react";
import { useStore } from "zustand";

import { useGame, useView } from "../../authority/GameProvider";
import { Button } from "../../shared/ui/Button";
import { Card, Tag } from "../../shared/ui/Panel";
import { nameOf, say, words } from "../../shared/words/text";
import { DECEMBER, DecemberScene } from "./DecemberScene";
import { ClosingLine, InterviewRoom } from "./InterviewRoom";
import { leaveRoomView, roomStore, VOICED } from "./room.store";

// Section 7, limit 1 of docs/design/06-audio.md: the first tap anywhere in the game wakes sound.
// installed here, where the game first loads a scene that speaks; main.tsx is kept apart.

function Plain() {
  const { setpiece, ended } = useView();
  const send = useGame((state) => state.send);
  const busy = useGame((state) => state.busy);
  if (setpiece === null) return null;
  const { question } = setpiece;
  return (
    <section aria-label={nameOf(setpiece.entry)}>
      <Card tone="attention" className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <MessageCircleQuestion size={22} className="mt-0.5 shrink-0" />
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{nameOf(setpiece.entry)}</h2>
            <p className="text-sm text-text-2">{say("ui.setpiece.blocks")}</p>
          </div>
        </div>
        {question === null ? null : (
          <>
            <p className="text-sm font-medium text-text-2">{say("ui.setpiece.question", { n: setpiece.asked + 1, total: setpiece.total })}</p>
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

function Scene() {
  const { setpiece } = useView();
  const closing = useStore(roomStore, (state) => state.closing);
  const open = setpiece?.entry ?? null;
  useEffect(() => {
    if (open !== VOICED) leaveRoomView();
  }, [open]);
  if (setpiece === null) return closing === null ? null : <ClosingLine reaction={closing} />;
  if (setpiece.entry === DECEMBER) return <DecemberScene />;
  if (setpiece.entry === VOICED) return <InterviewRoom setpiece={setpiece} />;
  return <Plain />;
}

/**
 * True while the officer's closing line is still to show, or shows, after the interview has closed (the
 * : from an answer given in the room until the one button, Leave the room, is tapped. The
 * sheet that holds the set piece keeps it while this holds, so the close is said before the sheet goes.
 */
export function useClosingOpen(): boolean {
  return useStore(roomStore, (state) => state.closing !== null || (state.inRoom && state.answered));
}

export function SetpieceView() {
  return (
    <>
      <Scene />
      {/* the game's one notice belongs at the root of the app; it is mounted here until someone adds it. */}
    </>
  );
}
