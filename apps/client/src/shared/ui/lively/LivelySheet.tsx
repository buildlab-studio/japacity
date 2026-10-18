// A lively sheet (docs/design/09-the-lively-layer.md, section 2): the sheet colour, rising from the foot with its handle,
// a picture, a title of a few words and one line under it, then what it holds. On a laptop it rises in the centred
// column. Built on Base UI's dialog for the focus trap and the escape key; it rises and sinks by a short transition on
// transform (index.css .motion-rise, world:motions-under-half-second), and Base UI unmounts it once that ends.
import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode, RefObject } from "react";

import { say } from "../../words/text";

export interface LivelySheetProps {
  open: boolean;
  onOpenChange: (open: boolean, details: Dialog.Root.ChangeEventDetails) => void;
  /** A title of at most four words; the dialog's name. */
  title: string;
  /** One line under it, in the speaker's voice. */
  line?: string;
  /** The thing's picture, a sticker. */
  picture?: ReactNode;
  /**
   * Where the sheet is drawn: over the page by default, modal; or in a box of its own, which holds it as its containing
   * block, and then it is not modal over the rest of the page (a preview stands two paints side by side).
   */
  container?: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
}

export function LivelySheet({ open, onOpenChange, title, line, picture, container, className = "", children }: LivelySheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={container === undefined}>
      <Dialog.Portal {...(container === undefined ? {} : { container })}>
        <Dialog.Backdrop className="motion-scrim fixed inset-0 z-40 bg-scrim data-ending-style:pointer-events-none data-closed:pointer-events-none" />
        <Dialog.Popup
          className={`motion-rise fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] w-full max-w-[430px] flex-col overflow-y-auto rounded-t-[26px] border-t-[length:var(--edge-width)] border-edge bg-sheet px-4 pt-1 pb-[max(22px,env(safe-area-inset-bottom))] text-text shadow-[0_-10px_30px_rgba(0,0,0,0.18)] outline-hidden data-ending-style:pointer-events-none data-closed:pointer-events-none ${className}`}
          // A sheet in a box of its own leaves the page's focus where it was.
          {...(container === undefined ? {} : { initialFocus: false })}
          data-lively-sheet
        >
          <Dialog.Close aria-label={say("ui.report.close")} className="mx-auto flex h-7 w-20 shrink-0 items-center justify-center rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-text/40" data-lively-handle>
            <span className="h-[5px] w-10 rounded-[3px] bg-text/25" />
          </Dialog.Close>
          <div className="mt-1 mb-3.5 flex items-center gap-3.5">
            {picture}
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-title font-bold">{title}</Dialog.Title>
              {line === undefined ? null : <Dialog.Description className="truncate text-body text-text-2">{line}</Dialog.Description>}
            </div>
          </div>
          {children}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
