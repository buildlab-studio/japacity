// The joined-the-same-week board (docs/rules/city.md R-CITY-039): kept in the
// code and switched off at launch. Loaded only once the server answers it.
import { say } from "../../shared/words/text";
import BoardList from "./BoardList";
import type { BoardReply } from "./boards";

export default function JoinedWeekBoard({ reply }: { reply: BoardReply }) {
  return (
    <div className="flex flex-col gap-2" data-joined-week>
      <h3 className="font-semibold">{say("ui.boards.joined-week")}</h3>
      <p className="text-sm text-text-2">{say("ui.boards.joined-week.about")}</p>
      <BoardList reply={reply} when="all-time" friends={false} />
    </div>
  );
}
