// One board's lines (docs/rules/city.md R-CITY-040): rank, name and figure for
// the top lines, then the player's own line wherever it ranks. Loaded only
// after the server has answered with a board, so a switched-off board's
// screen is never fetched.
import { formatNumber } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import type { BoardReply, BoardRow, When } from "./boards";

function figureWords(row: BoardRow, when: When): string {
  const figure = formatNumber(row.figure);
  if (when === "all-time") return say("ui.boards.figure.all-time", { figure });
  return say(row.figure > 0 ? "ui.boards.figure.this-week.up" : "ui.boards.figure.this-week.down", { figure });
}

function Line({ row, when }: { row: BoardRow; when: When }) {
  return (
    <li
      data-board-line={row.rank}
      data-me={row.me ? "true" : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 ${row.me ? "bg-accent/15 font-semibold ring-1 ring-accent" : "odd:bg-sunk/60"}`}
    >
      <span className="w-10 shrink-0 text-right font-semibold tabular-nums" aria-label={say("ui.boards.rank", { rank: row.rank })}>
        {row.rank}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{row.name ?? row.firstName}</span>
        {row.name === null ? null : <span className="truncate text-xs font-normal text-muted">{row.firstName}</span>}
      </span>
      {row.me ? <span className="text-xs font-medium text-muted uppercase">{say("ui.boards.you")}</span> : null}
      <span className="shrink-0 tabular-nums">{figureWords(row, when)}</span>
    </li>
  );
}

export default function BoardList({ reply, when, friends }: { reply: BoardReply; when: When; friends: boolean }) {
  const own = reply.own;
  const ownShown = own !== null && reply.rows.some((row) => row.me);
  // Above the list, so a player far down a long board sees their place without scrolling.
  const ownLine = ownShown ? null : (
    <div className="flex flex-col gap-1" data-board-own>
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{say("ui.boards.your-place")}</p>
      {own === null ? (
        <p className="text-sm">{say("ui.boards.no-route")}</p>
      ) : (
        <ol>
          <Line row={own} when={when} />
        </ol>
      )}
    </div>
  );
  return (
    <div className="flex flex-col gap-3" data-board={reply.board}>
      {ownLine}
      {reply.rows.length === 0 ? (
        <p className="text-muted">{say(friends ? "ui.boards.empty.friends" : "ui.boards.empty")}</p>
      ) : (
        <ol className="flex flex-col gap-1" data-board-lines>
          {reply.rows.map((row) => (
            <Line key={row.rank} row={row} when={when} />
          ))}
        </ol>
      )}
    </div>
  );
}
