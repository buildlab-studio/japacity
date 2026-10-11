// The month's acts telling of themselves on the phone (docs/rules/world.md R-WORLD-030): on the
// wallpaper, as notifications, once the character is home (the house or the room), newest first,
// and told as soon as they show; away from home only that something waits, never the lines. The
// lines stay on the phone for the rest of the month. A paper that landed or moved is told above
// them wherever the phone is opened, a message from the office, and a tap opens Papers; it waits
// there until Papers is opened, and nothing opens by itself. Nothing here sends a command.
import { FolderOpen } from "lucide-react";
import { use, useEffect, useState } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { dueSignals, waitingSignals } from "../../shared/days/days";
import { tellSignals, useMonthDays } from "../../shared/days/days.store";
import { atHome } from "../../shared/days/standing";
import { PhoneNav } from "../../shared/phone/nav";
import { say } from "../../shared/words/text";
import { paperNotices, paperNoticeWords, papersMarkOf } from "./papers";
import { phoneWords } from "./phone.words";
import { useSeen } from "./seen";

/** The lines due and those still waiting, from the days kept, the view and the plan. */
export function useSignals(): { due: ReturnType<typeof dueSignals>; waiting: ReturnType<typeof waitingSignals> } {
  const view = useView();
  const plan = useGame((state) => state.plan);
  const days = useMonthDays();
  if (days === null || days.month !== view.month || days.scenario !== view.scenario) return { due: [], waiting: [] };
  return { due: dueSignals(days, view, plan), waiting: waitingSignals(days, view, plan) };
}

/** True while a line of the month waits to be told: part of the Phone button's dot. */
export function useSignalsWaiting(): boolean {
  return useSignals().waiting.length > 0;
}

/** The month's papers that landed or moved, while Papers has not been opened since (R-WORLD-030): each a tap into Papers. */
function PaperNotices() {
  const view = useView();
  const seen = useSeen();
  const nav = use(PhoneNav);
  const mark = papersMarkOf(view);
  if (mark === "" || seen.papers === mark) return null;
  return (
    <ul className="mt-4 flex flex-col gap-2 px-4" aria-label={phoneWords("phone.papers.notices")} data-paper-notices>
      {paperNotices(view).map((notice) => (
        <li key={`${notice.kind}.${notice.document}`}>
          <button
            type="button"
            onClick={() => nav.openApp("papers")}
            className="press pop flex w-full items-start gap-2 rounded-[12px] bg-sheet/90 px-3 py-2 text-left text-[14px] leading-snug text-text shadow-[0_4px_10px_rgba(10,14,30,0.25)]"
            data-paper-notice={`${notice.kind}.${notice.document}`}
          >
            <FolderOpen size={16} aria-hidden className="mt-0.5 shrink-0 text-text-2" />
            <span className="min-w-0 flex-1">{paperNoticeWords(notice, view.month)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Notices() {
  return (
    <>
      <PaperNotices />
      <MonthNotices />
    </>
  );
}

function MonthNotices() {
  const view = useView();
  const { due, waiting } = useSignals();
  // Where the character stands is read once as the phone opens: the phone is put away to move.
  const [home] = useState(() => atHome(view));
  const keys = waiting.map((signal) => signal.key).join("|");
  useEffect(() => {
    if (home && keys !== "") tellSignals(keys.split("|"));
  }, [home, keys]);
  if (!home) {
    if (waiting.length === 0) return null;
    return (
      <p className="mx-4 mt-4 self-start rounded-[12px] bg-sheet/85 px-3 py-2 text-[13px] font-semibold text-text-2" data-phone-away>
        {waiting.length === 1 ? say("ui.days.away.one") : say("ui.days.away.many", { count: waiting.length })}
      </p>
    );
  }
  if (due.length === 0) return null;
  return (
    <ul className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4" aria-label={say("ui.days.notices")} data-phone-notices>
      {[...due].reverse().map((signal) => (
        <li key={signal.key} className="pop rounded-[12px] bg-sheet/90 px-3 py-2 text-[14px] leading-snug text-text shadow-[0_4px_10px_rgba(10,14,30,0.25)]" data-notice={signal.key}>
          {say(signal.key)}
        </li>
      ))}
    </ul>
  );
}
