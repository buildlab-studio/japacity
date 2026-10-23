// A sheet: the account's and the support pages'. It stands in the one sheet frame (world:sheets-one-frame): it rises from
// the foot with its handle on a phone and in the centre at a phone's width on a laptop, the close at its top right. Built
// on Base UI's dialog for the focus trap and the escape key. It rises in and goes back the way it came by a short
// transition on transform and opacity (index.css .motion-sheet and .motion-scrim, world:motions-under-half-second), and Base UI
// unmounts it once that ends. Until then the closing backdrop still covers the page, so a closing sheet lets clicks through at once.
import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";

import { say } from "../words/text";
import { SheetCloseButton, SheetFrame, SheetHandle } from "./SheetFrame";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** What stands above the title, with air around it: the wordmark on an account sheet. */
  top?: ReactNode;
  children: ReactNode;
}

export function Sheet({ open, onOpenChange, title, description, top, children }: SheetProps) {
  return (
    <SheetFrame
      open={open}
      onClose={() => onOpenChange(false)}
      scrim="bg-black/40"
      className="motion-sheet flex max-h-[88dvh] flex-col gap-4 overflow-y-auto rounded-t-md border border-sheet-line bg-sheet px-5 pt-1 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink shadow-xl"
    >
      <SheetHandle className="-mb-3" />
      <SheetCloseButton label={say("ui.report.close")} className="top-6 right-3 border border-sheet-line text-ink hover:bg-sheet-muted focus-visible:outline-2 focus-visible:outline-ink" />
      {top === undefined ? null : <div className="pt-2 pr-12 pb-1">{top}</div>}
      <div className="flex flex-col gap-1 pr-12">
        <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
        {description === undefined ? null : <Dialog.Description className="text-text-2">{description}</Dialog.Description>}
      </div>
      {children}
    </SheetFrame>
  );
}
