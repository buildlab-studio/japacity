// The pieces under the travel data page (prologue.md R-PROLOGUE-014): a stat box, a figure over its label, and the one
// line that says what japacity is.
import { Info } from "lucide-react";

import { say } from "../words/text";

/** A figure over its label, in a box. */
export function StatBox({ label, value, mark }: { label: string; value: string; mark: string }) {
  return (
    <div className="rounded-[5px] bg-sheet-muted py-2 text-center" data-stat={mark}>
      <div className="num text-[17px]">{value === "" ? say("prologue.page.empty") : value}</div>
      <div className="label text-[9px] text-text-2">{label}</div>
    </div>
  );
}

/** What japacity is, in one line under its figure: the first place the word is met. */
export function JapacityLine() {
  return (
    <p className="mt-1.5 flex items-start gap-1.5 text-[12px] leading-snug text-text-2" data-japacity-line>
      <Info size={14} className="mt-px shrink-0" aria-hidden />
      <span>{say("ui.page.japacity.line")}</span>
    </p>
  );
}

