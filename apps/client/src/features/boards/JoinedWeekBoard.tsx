// The joined-the-same-week board (docs/rules/city.md R-CITY-039): kept in the
// code and switched off (`boards.joined-week`). Loaded only once the server answers it.
import { say } from "../../shared/words/text";
import BoardList from "./BoardList";
import type { BoardReply } from "./boards";

export default function JoinedWeekBoard({ reply }: { reply: BoardReply }) {
  return (
    <div className="mt-3 flex flex-col gap-2" data-joined-week>
      <h3 className="px-0.5 text-[17px] font-bold">{say("ui.boards.joined-week")}</h3>
      <p className="px-0.5 text-[14px] leading-snug text-text-2">{say("ui.boards.joined-week.about")}</p>
      <BoardList reply={reply} when="all-time" friends={false} />
    </div>
  );
}
