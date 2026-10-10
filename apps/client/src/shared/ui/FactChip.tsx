// A fact as an icon and two or three words, with a smaller note and a mark for its state (prologue.md R-PROLOGUE-014):
// the years before on the page are chips, never sentences.
import type { ComponentType } from "react";

import { Mark, type MarkState } from "./Mark";

export interface FactChipProps {
  icon: ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean }>;
  label: string;
  note?: string | null;
  state?: MarkState | null;
  /** A mark for tests and pictures: `data-fact` carries it. */
  id?: string;
}

export function FactChip({ icon: Icon, label, note = null, state = null, id }: FactChipProps) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-[6px] bg-sheet-muted px-2.5 py-2" data-fact={id ?? ""} data-state={state ?? ""}>
      <Icon size={20} className="shrink-0 text-strong" aria-hidden />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-[14px] font-extrabold">{label}</div>
        {note === null || note === "" ? null : <div className="truncate text-[12px] text-text-2">{note}</div>}
      </div>
      {state === null ? null : <Mark state={state} />}
    </div>
  );
}
