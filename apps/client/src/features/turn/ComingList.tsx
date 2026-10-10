// The Coming up list, in the Calendar app (docs/rules/world.md R-WORLD-002, text.md R-TEXT-008): each row a box with
// how many months away and the months label once, the thing, and a note of two or three words where it adds one.
// The box says the months, so the line beside it never says them again.
import type { PlayerView } from "@japacity/sim";
import { ChevronRight } from "lucide-react";

import { type Coming, comingOf } from "../../shared/words/coming";
import { inMonths, say, sayCount } from "../../shared/words/text";

/** The note a kind carries; the birthday and an age limit say it all in their own words. */
const NOTES: Readonly<Record<Coming["kind"], string | null>> = {
  offer: "ui.world.coming.note.offer",
  paper: "ui.world.coming.note.paper",
  visa: "ui.world.coming.note.visa",
  plan: "ui.world.coming.note.plan",
  rent: "ui.world.coming.note.rent",
  birthday: null,
  "age-limit": null,
};

export interface ComingListProps {
  view: Parameters<typeof comingOf>[0] & Pick<PlayerView, "month">;
  /** What a tap on a row does, or null for a row that opens nothing (R-WORLD-002: each item tappable in the Calendar). */
  onPick?: (item: Coming) => (() => void) | null;
  /** A row's own note in place of its kind's: where a dated thing is answered. */
  noteOf?: (item: Coming) => string | null;
}

export function ComingList({ view, onPick, noteOf }: ComingListProps) {
  return (
    <ul className="flex flex-col" data-coming-list>
      {comingOf(view).map((item, index) => {
        const away = Math.max(0, item.month - view.month);
        const kindNote = NOTES[item.kind];
        const note = noteOf?.(item) ?? (kindNote === null ? null : say(kindNote));
        const tap = onPick?.(item) ?? null;
        const body = (
          <>
            <span className="flex w-[56px] shrink-0 flex-col items-center rounded-[5px] bg-sheet-muted py-1.5 leading-none" aria-hidden data-coming-box={away}>
              {away === 0 ? (
                <span className="py-1 text-[15px] font-extrabold">{say("ui.world.coming.now")}</span>
              ) : (
                <>
                  <span className="num text-[20px]">{away}</span>
                  <span className="mt-0.5 text-[12px] font-semibold text-text-2">{sayCount("ui.world.coming.months", away)}</span>
                </>
              )}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-[15px] font-bold">{item.what}</span>
              {note === null ? null : (
                <span className="block text-[12px] text-text-2" data-coming-note>
                  {note}
                </span>
              )}
              <span className="sr-only">{inMonths(item.month, view.month)}</span>
            </span>
          </>
        );
        return (
          <li key={`${item.kind}-${String(index)}`} className="border-b border-sheet-line last:border-b-0" data-coming-row={item.kind}>
            {tap === null ? (
              <div className="flex items-center gap-3 py-2.5">{body}</div>
            ) : (
              <button type="button" className="press flex w-full items-center gap-3 py-2.5 text-left" onClick={tap} data-coming-open={item.kind}>
                {body}
                <ChevronRight size={18} className="shrink-0 text-text-2" aria-hidden />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
