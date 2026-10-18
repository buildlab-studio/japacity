// A sheet: from the bottom on a phone, from the right on a desktop. Built on
// Base UI's dialog for the focus trap and the escape key. It rises in and goes
// back the way it came by a short transition on transform and opacity
// (index.css .motion-sheet and .motion-scrim, world:motions-under-half-second), and Base UI
// unmounts it once that ends. Until then the closing backdrop still covers the
// page, so a closing sheet lets clicks through at once.
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { say } from "../words/text";

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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="motion-scrim fixed inset-0 z-40 bg-black/40 data-ending-style:pointer-events-none data-closed:pointer-events-none" />
        <Dialog.Popup className="motion-sheet data-ending-style:pointer-events-none data-closed:pointer-events-none fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col gap-4 overflow-y-auto rounded-t-md border border-sheet-line bg-sheet p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-ink shadow-xl outline-hidden lg:inset-y-0 lg:right-0 lg:left-auto lg:max-h-none lg:w-[28rem] lg:rounded-none lg:rounded-l-md">
          {top === undefined ? null : <div className="pt-2 pb-1">{top}</div>}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
              {description === undefined ? null : <Dialog.Description className="text-text-2">{description}</Dialog.Description>}
            </div>
            <Dialog.Close
              aria-label={say("ui.report.close")}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-sheet-line hover:bg-sheet-muted focus-visible:outline-2 focus-visible:outline-ink"
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
