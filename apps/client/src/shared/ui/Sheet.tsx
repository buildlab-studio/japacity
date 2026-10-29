// A sheet: the account's and the support pages'. It stands in the one sheet frame (world:sheets-one-frame): it rises from
// the foot with its handle on a phone and in the centre at a phone's width on a laptop, the close at its top right. Built
// on Base UI's dialog for the focus trap and the escape key. It rises in and goes back the way it came by a short
// transition on transform and opacity (index.css .motion-sheet and .motion-scrim, world:motions-under-half-second), and Base UI
// unmounts it once that ends. Until then the closing backdrop still covers the page, so a closing sheet lets clicks through at once.
// As in WorldSheet, the handle, the title and the close stand in a head that never scrolls, and a foot, where a sheet has
// one, holds its main button under the body; only the body between them scrolls, so on a small phone neither the close nor
// the main button leaves the view (world:sheets-one-frame, world:reach-and-read).
import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";

import { say } from "../words/text";
import { SheetCloseButton, SheetFrame, SheetHandle } from "./SheetFrame";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** The line under the title, at the top of the body. */
  description?: string;
  /** The sheet's foot, under the body and never scrolled away: its main button. */
  foot?: ReactNode;
  children: ReactNode;
}

const SAFE_FOOT = "pb-[max(1.25rem,env(safe-area-inset-bottom))]";

export function Sheet({ open, onOpenChange, title, description, foot, children }: SheetProps) {
  return (
    <SheetFrame
      open={open}
      onClose={() => onOpenChange(false)}
      scrim="bg-black/40"
      className="motion-sheet flex max-h-[88dvh] flex-col overflow-hidden rounded-t-md border border-sheet-line bg-sheet text-ink shadow-xl"
    >
      <div className="relative shrink-0 px-5 pt-1 pb-2" data-sheet-head>
        <SheetHandle className="-mb-1" />
        <SheetCloseButton label={say("ui.report.close")} className="top-6 right-3 border border-sheet-line text-ink hover:bg-sheet-muted focus-visible:outline-2 focus-visible:outline-ink" />
        <Dialog.Title className="pt-1 pr-12 text-lg font-semibold">{title}</Dialog.Title>
      </div>
      <div className={`flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 pt-2 ${foot === undefined ? SAFE_FOOT : "pb-4"}`} data-sheet-body>
        {description === undefined ? null : <Dialog.Description className="text-text-2">{description}</Dialog.Description>}
        {children}
      </div>
      {foot === undefined ? null : (
        <div className={`shrink-0 border-t border-sheet-line px-5 pt-3 ${SAFE_FOOT}`} data-sheet-foot>
          {foot}
        </div>
      )}
    </SheetFrame>
  );
}
