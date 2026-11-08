// A short fact with its state (text:show-then-tell): a mark that differs in shape and colour, then two or
// three words, as a tag that sits in a row of others. The mark carries its word for a screen reader.
import type { ReactNode } from "react";

import { Mark, type MarkState } from "./Mark";

/** `wrap`: the words wrap inside the tag rather than cut, for a need that cannot be two or three words. */
export function StateTag({ state, children, id, wrap = false }: { state: MarkState; children: ReactNode; id?: string; wrap?: boolean }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-[4px] bg-sheet-muted py-1 pr-2 pl-1 text-[12px] leading-none font-bold text-text" data-state-tag={id ?? state}>
      <Mark state={state} size={16} />
      <span className={wrap ? "min-w-0 leading-snug" : "truncate"}>{children}</span>
    </span>
  );
}
