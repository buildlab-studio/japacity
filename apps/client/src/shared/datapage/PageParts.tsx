// The pieces under the travel data page, as the design draws them (prologue.md R-PROLOGUE-014; the design's brief,
// section 2): the family card, the same height face down and turned over; a stat box, a figure over its label; the one
// line that says what japacity is; and the small links back to a screen of the door.
import { Dices, Info, Pencil } from "lucide-react";
import type { ReactNode } from "react";

import { ToneTag, type Tone } from "../ui/ToneTag";
import { say } from "../words/text";

/** The family the game drew: face down until it is turned over once, the same height before and after. */
export function FamilyFace({ card, label }: { card: { title: string; tags: readonly { tone: Tone; words: string }[] } | null; label: string }) {
  return (
    <div
      className={`flex min-h-[62px] items-center gap-2.5 rounded-[6px] px-3 py-2 ${card === null ? "band adire" : "border-2 border-strong bg-sheet"}`}
      data-family={card === null ? "face-down" : "turned"}
    >
      {card === null ? (
        <>
          <Dices size={24} className="shrink-0" aria-hidden />
          <span className="label label-strong">{label}</span>
        </>
      ) : (
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[15px] font-extrabold" data-family-title>
              {card.title}
            </span>
            <span className="label ml-auto shrink-0 text-[9px] text-text-2">{say("ui.page.family")}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1" data-family-tags>
            {card.tags.map((tag) => (
              <ToneTag key={tag.words} tone={tag.tone}>
                {tag.words}
              </ToneTag>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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

/** A small link back to a screen of the door, with its pencil. */
export function EditLink({ onClick, children, mark }: { onClick: () => void; children: ReactNode; mark: string }) {
  return (
    <button type="button" className="press flex items-center gap-1 rounded-[5px] bg-sheet-muted px-2.5 py-1.5 text-[12px] font-bold" onClick={onClick} data-door-edit={mark}>
      <Pencil size={13} aria-hidden />
      {children}
    </button>
  );
}
