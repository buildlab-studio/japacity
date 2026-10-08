// The nudge line (docs/rules/world.md R-WORLD-003): one sentence under the band saying the next
// thing to notice. It hides while a sheet, the phone or the map is open.
import { say } from "../words/text";
import type { Nudge as NudgeWords } from "./contract";

export function Nudge({ nudge, hidden = false }: { nudge: NudgeWords | null; hidden?: boolean }) {
  if (nudge === null || hidden) return null;
  const words = say(nudge.key, nudge.params ?? {});
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(max(10px,env(safe-area-inset-top))+82px)] z-[38] px-3" data-nudge>
      <div key={words} className="drop inline-flex max-w-full items-center gap-2 rounded-[4px] bg-sheet/95 py-1.5 pr-3 pl-2 text-[13px] font-semibold text-text shadow">
        <span className="size-2 shrink-0 rounded-full bg-signal" aria-hidden />
        <span className="truncate">{words}</span>
      </div>
    </div>
  );
}
