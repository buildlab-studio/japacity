// The boards (docs/rules/city.md R-CITY-039, R-CITY-040): two pickers, when
// and who, over four boards that each have their own switch on the server.
// A board's lines are loaded only after the server answers with one; a board
// switched off is a quiet note, and its screen is never fetched.
import { lazy, Suspense, useCallback, useEffect, useState } from "react";

import { Button } from "../../shared/ui/Button";
import { Card, Panel } from "../../shared/ui/Panel";
import { say } from "../../shared/words/text";
import { boardOf, useBoardsApi, WHENS, WHOS, type BoardAnswer, type BoardName, type BoardsApi, type When, type Who } from "./boards";

const BoardList = lazy(() => import("./BoardList"));
const JoinedWeekBoard = lazy(() => import("./JoinedWeekBoard"));

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

function Picker<T extends string>({ legend, options, chosen, words, onChoose }: { legend: string; options: readonly T[]; chosen: T; words: (option: T) => string; onChoose: (option: T) => void }) {
  return (
    <div role="radiogroup" aria-label={legend} className="grid grid-cols-2 gap-1 rounded-xl border border-sheet-line bg-sheet-muted p-1">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === chosen}
          data-pick={option}
          onClick={() => onChoose(option)}
          className={`min-h-11 rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${option === chosen ? "bg-sheet-2 text-ink shadow-sm" : "text-text-2"}`}
        >
          {words(option)}
        </button>
      ))}
    </div>
  );
}

function Note({ children, action }: { children: string; action?: { label: string; run: () => void } }) {
  return (
    <div className="flex flex-col items-start gap-2" data-board-note>
      <p className="text-sm">{children}</p>
      {action === undefined ? null : (
        <Button small onClick={action.run}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

/** What a refusal says on the screen: a pause, the ask to secure, or a retry. */
function Refused({ answer, again }: { answer: Exclude<BoardAnswer, { ok: true }>; again: () => void }) {
  if (answer.code === "switched-off") return <Note>{say("ui.boards.paused")}</Note>;
  // a guest is refused `guest-only` once the accounts work adds it; `not-legal` stands in on the server until then.
  if (answer.code === "not-legal") return <Note>{say("ui.boards.secure")}</Note>;
  return <Note action={{ label: say("ui.boards.retry"), run: again }}>{say("ui.boards.failed")}</Note>;
}

function Lines({ api, when, who }: { api: BoardsApi; when: When; who: Who }) {
  const { asked, again } = useBoard(api, boardOf(when, who));
  if (asked.state === "loading") return <p className="text-sm text-text-2" aria-live="polite">{say("ui.boards.loading")}</p>;
  if (asked.state === "failed") return <Note action={{ label: say("ui.boards.retry"), run: again }}>{say("ui.boards.failed")}</Note>;
  const { answer } = asked;
  if (!answer.ok) return <Refused answer={answer} again={again} />;
  return (
    <Suspense fallback={<p className="text-sm text-text-2">{say("ui.boards.loading")}</p>}>
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

export function Boards({ api }: { api: BoardsApi }) {
  const [when, setWhen] = useState<When>("this-week");
  const [who, setWho] = useState<Who>("everyone");
  return (
    <Panel title={say("ui.boards.title")}>
      <Card className="flex flex-col gap-3" data-boards>
        <Picker legend={say("ui.boards.when")} options={WHENS} chosen={when} words={(option) => say(`ui.boards.when.${option}`)} onChoose={setWhen} />
        <Picker legend={say("ui.boards.who")} options={WHOS} chosen={who} words={(option) => say(`ui.boards.who.${option}`)} onChoose={setWho} />
        <p className="text-sm text-text-2">{say(who === "friends" ? "ui.boards.about.friends" : `ui.boards.about.${when}`)}</p>
        <Lines api={api} when={when} who={who} />
      </Card>
      <JoinedWeek api={api} />
    </Panel>
  );
}

/** The boards when the build plays online; nothing offline, where there are no other players. */
export function BoardsView() {
  const api = useBoardsApi();
  return api === null ? null : <Boards api={api} />;
}
