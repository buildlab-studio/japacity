// A sheet over the world (docs/rules/world.md R-WORLD-001, 006, 023) for what is not one ask: the
// Month sheet, the results, the set piece's question. The same frame as AskSheet's card: a panel that
// rises from the bottom under a band head with a small label and a title, the scene still in view
// above it. Its body scrolls inside the sheet; its foot holds the one main button.
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { createContext, type ReactNode, useSyncExternalStore } from "react";

import { useGameStoreIfAny } from "../../authority/GameProvider";
import { say } from "../words/text";

/** The sheet's own close, for a sheet inside it (the parcel's slip) whose Not now lowers the whole sheet (R-WORLD-006). */
export const SheetClose = createContext<() => void>(() => undefined);

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

const NOTHING = (): void => undefined;

/**
 * True while a moment card stands over the sheets (moments.md R-MOMENT-006): over the results once they are up, over
 * the world once the corner's staged lines have passed. Outside a game, never.
 */
function useMomentStanding(): boolean {
  const store = useGameStoreIfAny();
  return useSyncExternalStore(
    (listener) => store?.subscribe(listener) ?? NOTHING,
    () => {
      const state = store?.getState();
      return state !== undefined && state.momentCards.length > 0 && (state.reportOpen || state.moments.length === 0);
    },
  );
}

export function WorldSheet({ open, onClose, label, title, children, foot, mark }: WorldSheetProps) {
  // Under a moment card the sheet's head steps back, its title and its close, so one close is in view.
  const covered = useMomentStanding();
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="motion-scrim fixed inset-0 z-40 bg-scrim/60 data-closed:pointer-events-none data-ending-style:pointer-events-none" />
        <Dialog.Popup className="motion-sink fixed inset-x-0 bottom-0 z-50 outline-hidden data-closed:pointer-events-none data-ending-style:pointer-events-none" data-world-sheet={mark}>
          <SheetClose.Provider value={onClose}>
          {/* The lively sheet (docs/design/13-the-lively-layer.md section 2): the sheet's pale sky, a 26 px top, the handle,
              a title of a few words over a small line, in the centred column on a laptop; navy at night. */}
          <div className="rise mx-auto flex max-h-[min(86dvh,700px)] w-full max-w-[430px] flex-col overflow-hidden rounded-t-[26px] bg-sheet text-text shadow-[0_-10px_30px_rgba(0,0,0,0.22)]" data-lively-frame>
            <div className={`relative shrink-0 px-4 pt-2 pr-12 pb-1 transition-opacity duration-200 ease-out ${covered ? "pointer-events-none opacity-0" : ""}`} aria-hidden={covered || undefined} data-world-sheet-head={covered ? "covered" : "shown"}>
              <span aria-hidden className="mx-auto mb-2 block h-[5px] w-10 rounded-[3px] bg-text/25" />
              <Dialog.Description className="truncate text-[13px] font-medium text-text-2">{label}</Dialog.Description>
              <Dialog.Title className="text-title font-bold">{title}</Dialog.Title>
              <Dialog.Close aria-label={say("ui.world.close")} className="press absolute top-3 right-3 flex size-9 items-center justify-center rounded-[12px] text-text-2">
                <X size={18} />
              </Dialog.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4">{children}</div>
            {foot === undefined ? null : <div className="shrink-0 px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]">{foot}</div>}
          </div>
          </SheetClose.Provider>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
