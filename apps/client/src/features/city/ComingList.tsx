// The Coming up list from the band's chip (docs/rules/world.md R-WORLD-002, text.md R-TEXT-008): each row a box with
// how many months away and the months label once, the thing, and a note of two or three words where it adds one.
// The box says the months, so the line beside it never says them again.
import type { PlayerView } from "@japacity/sim";

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

export function ComingList({ view }: { view: Parameters<typeof comingOf>[0] & Pick<PlayerView, "month"> }) {
  return (
    <ul className="flex flex-col" data-coming-list>
      {comingOf(view).map((item, index) => {
        const away = Math.max(0, item.month - view.month);
        const note = NOTES[item.kind];
        return (
          <li key={`${item.kind}-${String(index)}`} className="flex items-center gap-3 border-b border-sheet-line py-2.5 last:border-b-0" data-coming-row={item.kind}>
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
                  {say(note)}
                </span>
              )}
              <span className="sr-only">{inMonths(item.month, view.month)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
