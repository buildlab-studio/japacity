// The boards (city:boards-switch-when-and-who, city:board-line-and-ranking): two pickers, when
// and who, over four boards that each have their own switch on the server.
// A board's lines are loaded only after the server answers with one; a board
// switched off is a quiet note, and its screen is never fetched. Dressed as
// the phone's apps (docs/design/09-the-games-look.md section 2): the pickers
// as segmented pills, each line a card, a note in a card with its one button.
import type { BoardName } from "@japacity/api";
import { Suspense, useCallback, useEffect, useState } from "react";

import { softLazy } from "../../shared/net/parts";
import { LookCard } from "../../shared/ui/look/LookCard";
import { say } from "../../shared/words/text";
import { boardOf, useBoardsApi, WHENS, WHOS, type BoardAnswer, type BoardsApi, type When, type Who } from "./boards";

const BoardList = softLazy(() => import("./BoardList"));
const JoinedWeekBoard = softLazy(() => import("./JoinedWeekBoard"));

type Asked = { state: "loading" } | { state: "answered"; answer: BoardAnswer } | { state: "failed" };

/** The server's answer for one board, asked again when the board changes or on `again`. */
function useBoard(api: BoardsApi, board: BoardName): { asked: Asked; again: () => void } {
  const [asked, setAsked] = useState<Asked>({ state: "loading" });
  const [round, setRound] = useState(0);
  useEffect(() => {
    let live = true;
    setAsked({ state: "loading" });
    api.board(board).then(
      (answer) => {
        if (live) setAsked({ state: "answered", answer });
      },
      () => {
        if (live) setAsked({ state: "failed" });
      },
    );
    return () => {
      live = false;
    };
  }, [api, board, round]);
  const again = useCallback(() => setRound((value) => value + 1), []);
  return { asked, again };
}

/** A choice of two as one segmented pill, as the phone's Settings draws its choices. */
function Picker<T extends string>({ legend, options, chosen, words, onChoose }: { legend: string; options: readonly T[]; chosen: T; words: (option: T) => string; onChoose: (option: T) => void }) {
  return (
    <div role="radiogroup" aria-label={legend} className="phone-segment flex items-center gap-1 p-1" data-board-picker>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === chosen}
          data-pick={option}
          onClick={() => onChoose(option)}
          className={`press min-h-10 flex-auto px-3 text-[14px] font-bold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${option === chosen ? "phone-segment-on" : "text-text-2"}`}
        >
          {words(option)}
        </button>
      ))}
    </div>
  );
}

function Note({ children, action }: { children: string; action?: { label: string; run: () => void } }) {
  return (
    <LookCard className="flex flex-col items-start gap-2.5 p-3" data-board-note>
      <p className="text-[15px] leading-snug">{children}</p>
      {action === undefined ? null : (
        <button type="button" className="phone-ghost" onClick={action.run}>
          {action.label}
        </button>
      )}
    </LookCard>
  );
}

/** What a refusal says on the screen: a pause, the ask to secure, or a retry. */
function Refused({ answer, again }: { answer: Exclude<BoardAnswer, { ok: true }>; again: () => void }) {
  if (answer.code === "switched-off") return <Note>{say("ui.boards.paused")}</Note>;
  // account:social-needs-secured-account: a guest is refused `guest-only`, and the screen asks for the life to be secured, never a dead end.
  if (answer.code === "guest-only") return <Note>{say("ui.boards.secure")}</Note>;
  return <Note action={{ label: say("ui.boards.retry"), run: again }}>{say("ui.boards.failed")}</Note>;
}

function Lines({ api, when, who }: { api: BoardsApi; when: When; who: Who }) {
  const { asked, again } = useBoard(api, boardOf(when, who));
  if (asked.state === "loading") return <p className="px-0.5 text-[14px] text-text-2" aria-live="polite">{say("ui.boards.loading")}</p>;
  if (asked.state === "failed") return <Note action={{ label: say("ui.boards.retry"), run: again }}>{say("ui.boards.failed")}</Note>;
  const { answer } = asked;
  if (!answer.ok) return <Refused answer={answer} again={again} />;
  return (
    <Suspense fallback={<p className="px-0.5 text-[14px] text-text-2">{say("ui.boards.loading")}</p>}>
      <BoardList reply={answer} when={when} friends={who === "friends"} />
    </Suspense>
  );
}

/** The joined-week board shows only while the server answers it; switched off, nothing of it is loaded or shown. */
function JoinedWeek({ api }: { api: BoardsApi }) {
  const { asked } = useBoard(api, "joined-week");
  if (asked.state !== "answered" || !asked.answer.ok) return null;
  return (
    <Suspense fallback={null}>
      <JoinedWeekBoard reply={asked.answer} />
    </Suspense>
  );
}

function Boards({ api }: { api: BoardsApi }) {
  const [when, setWhen] = useState<When>("this-week");
  const [who, setWho] = useState<Who>("everyone");
  return (
    <section aria-labelledby="boards-title" className="mt-5 flex flex-col gap-2.5" data-boards>
      <h3 id="boards-title" className="px-0.5 text-[20px] font-bold">
        {say("ui.boards.title")}
      </h3>
      <Picker legend={say("ui.boards.when")} options={WHENS} chosen={when} words={(option) => say(`ui.boards.when.${option}`)} onChoose={setWhen} />
      <Picker legend={say("ui.boards.who")} options={WHOS} chosen={who} words={(option) => say(`ui.boards.who.${option}`)} onChoose={setWho} />
      <p className="px-0.5 text-[14px] leading-snug text-text-2">{say(who === "friends" ? "ui.boards.about.friends" : `ui.boards.about.${when}`)}</p>
      <Lines api={api} when={when} who={who} />
      <JoinedWeek api={api} />
    </section>
  );
}

/** The boards when the build plays online; nothing offline, where there are no other players. */
export function BoardsView() {
  const api = useBoardsApi();
  return api === null ? null : <Boards api={api} />;
}
