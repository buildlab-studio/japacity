// A state as a small round mark (prologue.md R-PROLOGUE-014): each state differs in its shape as well as its colour,
// never colour alone, and carries its word for a screen reader and as its title.
import { Check, Clock, TriangleAlert, X } from "lucide-react";
import type { ComponentType } from "react";

import { say } from "../words/text";

export type MarkState = "done" | "failed" | "setback" | "waiting";

/** Each state's glyph, its colours and its word. Small squares, never pills (R-WORLD-021); the setback's is turned on its point. */
const MARKS: Record<MarkState, { glyph: ComponentType<{ size?: number; strokeWidth?: number; "aria-hidden"?: boolean }>; shape: string; colour: string; word: string }> = {
  done: { glyph: Check, shape: "rounded-[4px]", colour: "bg-in text-white", word: "ui.page.mark.done" },
  failed: { glyph: X, shape: "rounded-[4px]", colour: "bg-out text-white", word: "ui.page.mark.failed" },
  setback: { glyph: TriangleAlert, shape: "rounded-[2px] rotate-45 [&>svg]:-rotate-45", colour: "bg-signal text-[#2b2208]", word: "ui.page.mark.setback" },
  waiting: { glyph: Clock, shape: "rounded-[4px]", colour: "bg-sheet-line text-text-2", word: "ui.page.mark.waiting" },
};

/** The word a state is said by. */
export function markWord(state: MarkState): string {
  return say(MARKS[state].word);
}

export function Mark({ state, size = 18 }: { state: MarkState; size?: number }) {
  const mark = MARKS[state];
  const Glyph = mark.glyph;
  return (
    <span role="img" aria-label={markWord(state)} title={markWord(state)} className={`inline-flex shrink-0 items-center justify-center ${mark.shape} ${mark.colour}`} style={{ width: size, height: size }} data-mark={state}>
      <Glyph size={size - 6} strokeWidth={3} aria-hidden />
    </span>
  );
}
