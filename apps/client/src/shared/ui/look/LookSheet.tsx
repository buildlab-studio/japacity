// A sheet of the game's look (docs/design/09-the-games-look.md, section 2): the sheet colour, rising from the foot with its handle,
// a picture, a title of a few words and one line under it, then what it holds. It stands in the one sheet frame
// (world:sheets-one-frame): the handle drags it down, the close stands at the top right, and on a laptop it rises in the
// centred column. The handle, the picture, the title and the close stand in a head that never scrolls, and a foot, where
// the sheet has one, holds its main button under the body; only the body between them scrolls, so a long list never
// takes the close or the main button out of view. It rises and sinks by a short transition on transform (index.css
// .motion-rise, world:motions-under-half-second), and Base UI unmounts it once that ends.
import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode, RefObject } from "react";

import { say } from "../../words/text";
import { SheetCloseButton, SheetFrame, SheetHandle } from "../SheetFrame";

export interface LookSheetProps {
  open: boolean;
  /** Closing by the close or the scrim tells how; by the handle or Back, there is nothing more to tell. */
  onOpenChange: (open: boolean, details?: Dialog.Root.ChangeEventDetails) => void;
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
  /** The sheet's foot, under the body and never scrolled away: its main button. */
  foot?: ReactNode;
  children: ReactNode;
}

const SAFE_FOOT = "pb-[max(22px,env(safe-area-inset-bottom))]";

export function LookSheet({ open, onOpenChange, title, line, picture, container, className = "", foot, children }: LookSheetProps) {
  return (
    <SheetFrame
      open={open}
      onClose={(details) => onOpenChange(false, details)}
      scrim="bg-scrim"
      {...(container === undefined ? {} : { container })}
      className={`motion-rise flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[26px] border-t-[length:var(--edge-width)] border-edge bg-sheet text-text shadow-[0_-10px_30px_rgba(0,0,0,0.18)] ${className}`}
      attributes={{ "data-look-sheet": "" }}
    >
      <div className="relative shrink-0 px-4 pt-1" data-sheet-head>
        <SheetHandle />
        <SheetCloseButton label={say("ui.report.close")} />
        <div className="mt-1 mb-3.5 flex items-center gap-3.5 pr-10">
          {picture}
          <div className="min-w-0 flex-1">
            <Dialog.Title className="text-title font-bold">{title}</Dialog.Title>
            {line === undefined ? null : <Dialog.Description className="truncate text-body text-text-2">{line}</Dialog.Description>}
          </div>
        </div>
      </div>
      <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 ${foot === undefined ? SAFE_FOOT : "pb-3"}`} data-sheet-body>
        {children}
      </div>
      {foot === undefined ? null : (
        <div className={`shrink-0 px-4 pt-3 ${SAFE_FOOT}`} data-sheet-foot>
          {foot}
        </div>
      )}
    </SheetFrame>
  );
}
