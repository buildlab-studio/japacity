// A gain or a cost said as a short tag (prologue:printed-page-hands-over): up is green with an arrow up, down red with an
// arrow down, plain has neither; the arrow carries the way, so colour never says it alone.
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ReactNode } from "react";

import { say } from "../words/text";

export type Tone = "up" | "down" | "plain";

/** `wrap`: the words wrap inside the tag rather than cut, for a gain that cannot be two or three words ("₦90,000 once your tech is good"). */
export function ToneTag({ tone, children, wrap = false }: { tone: Tone; children: ReactNode; wrap?: boolean }) {
  return (
    <span className={`inline-flex max-w-full items-center gap-1 rounded-[4px] bg-sheet-muted px-1.5 py-0.5 text-[12px] font-bold text-text ${wrap ? "text-left" : ""}`} data-tone={tone}>
      {tone === "up" ? (
        <ArrowUp size={12} strokeWidth={3} className="shrink-0 text-in" role="img" aria-label={say("ui.page.tone.up")} />
      ) : tone === "down" ? (
        <ArrowDown size={12} strokeWidth={3} className="shrink-0 text-out" role="img" aria-label={say("ui.page.tone.down")} />
      ) : null}
      <span className={wrap ? "min-w-0 leading-snug" : "truncate"}>{children}</span>
    </span>
  );
}
