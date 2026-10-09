// A sheet: from the bottom on a phone, from the right on a desktop. Built on
// Base UI's dialog for the focus trap and the escape key; no animation yet.
// Base UI unmounts a closed sheet on the next animation frame. Until then the
// closed backdrop still covers the page, and a frame can be late on a busy
// phone or in a hidden tab, so a closed sheet lets clicks through at once.
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { say } from "../words/text";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}

export function Sheet({ open, onOpenChange, title, description, children }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/40 data-ending-style:pointer-events-none data-closed:pointer-events-none" />
        <Dialog.Popup className="data-ending-style:pointer-events-none data-closed:pointer-events-none fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col gap-4 overflow-y-auto rounded-t-2xl border border-sheet-line bg-sheet p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink shadow-xl outline-hidden lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:w-[28rem] lg:rounded-none lg:rounded-l-2xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
              {description === undefined ? null : <Dialog.Description className="text-text-2">{description}</Dialog.Description>}
            </div>
            <Dialog.Close
              aria-label={say("ui.report.close")}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg border border-sheet-line hover:bg-sheet-muted focus-visible:outline-2 focus-visible:outline-ink"
            >
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
