// A sheet over the world (docs/rules/world.md R-WORLD-001, 006, 023) for what is not one ask: the
// Month sheet, the results, the set piece's question. The same frame as AskSheet's card: a panel that
// rises from the bottom under a band head with a small label and a title, the scene still in view
// above it. Its body scrolls inside the sheet; its foot holds the one main button.
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { say } from "../words/text";

export interface WorldSheetProps {
  open: boolean;
  onClose: () => void;
  /** The small line over the title. */
  label: string;
  title: string;
  children: ReactNode;
  /** The sheet's foot, under the body: the one main button. */
  foot?: ReactNode;
  /** A mark for tests and pictures: `data-world-sheet` carries it. */
  mark?: string;
}

export function WorldSheet({ open, onClose, label, title, children, foot, mark }: WorldSheetProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fade fixed inset-0 z-40 bg-gradient-to-t from-scrim to-transparent data-closed:pointer-events-none data-ending-style:pointer-events-none" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 outline-hidden data-closed:pointer-events-none data-ending-style:pointer-events-none" data-world-sheet={mark}>
          <div className="panel rise mx-2 mb-2 flex max-h-[min(78dvh,640px)] flex-col overflow-hidden">
            <div className="band relative shrink-0 px-4 pt-4 pb-3 pr-12">
              <Dialog.Description className="label label-strong truncate">{label}</Dialog.Description>
              <Dialog.Title className="title text-[24px] leading-tight">{title}</Dialog.Title>
              <Dialog.Close aria-label={say("ui.world.close")} className="absolute top-2 right-2 flex size-9 items-center justify-center rounded-full text-on-strong/80">
                <X size={18} />
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
            {foot === undefined ? null : <div className="shrink-0 border-t border-sheet-line p-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">{foot}</div>}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
