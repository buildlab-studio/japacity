// world:sheets-one-frame: the one frame every sheet stands in (the lively sheet, the world sheet, the account sheet and the
// ask's card): built on Base UI's dialog for the focus trap; a handle that closes the sheet when dragged down past a third of
// its height or flicked down, and does nothing on a tap; one close at the top right with a 44 px hit area; on a laptop the
// sheet rises in the centre at a phone's width, as on a phone. world:back-closes-topmost: an open sheet is a layer Back closes.
// world:reach-and-read: the scene behind it is inert.
//
// The drag moves the popup by an inline transform with no transition, so it follows the finger; let go, the inline style is
// dropped and the popup's own motion class carries it home or, closing, down and away (world:motions-under-half-second).
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { createContext, type HTMLAttributes, type PointerEvent, type ReactNode, type RefObject, use, useRef } from "react";

import { LEVEL, useBackLayer } from "../back/back";

/** The share of the sheet's height a drag must pass to close it. */
const CLOSE_SHARE = 3;
/** A flick: a drag down at least this fast, in pixels a millisecond, over at least `FLICK_MIN_PX`. */
const FLICK_SPEED = 0.6;
const FLICK_MIN_PX = 24;

interface FrameParts {
  popup: RefObject<HTMLDivElement | null>;
  close: () => void;
}

const Frame = createContext<FrameParts | null>(null);

/** The frame's popup classes: at the foot, centred at a phone's width on every screen. */
export const FRAME_CLASS = "fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-[430px] outline-hidden data-closed:pointer-events-none data-ending-style:pointer-events-none";

export interface SheetFrameProps {
  open: boolean;
  /** Closes the sheet: its close, the handle, the scrim, Escape and Back all end here; Base UI's own closes tell how. */
  onClose: (details?: Dialog.Root.ChangeEventDetails) => void;
  /** The popup's motion class (index.css), and its other classes. */
  className: string;
  /** The scrim's colour. */
  scrim?: string;
  /** Drawn in a box of its own, not modal over the page (a preview): no Back, no inert scene. */
  container?: RefObject<HTMLElement | null>;
  /** The popup's own attributes: the marks tests and pictures look for. */
  attributes?: HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string | undefined>;
  children: ReactNode;
}

export function SheetFrame({ open, onClose, className, scrim = "bg-scrim/60", container, attributes, children }: SheetFrameProps) {
  const popup = useRef<HTMLDivElement | null>(null);
  const modal = container === undefined;
  useBackLayer(open && modal, () => onClose(), { level: LEVEL.sheet, cover: true });
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next, details) => {
        if (!next) onClose(details);
      }}
      modal={modal}
    >
      <Dialog.Portal {...(container === undefined ? {} : { container })}>
        <Dialog.Backdrop className={`motion-scrim fixed inset-0 z-40 ${scrim} data-closed:pointer-events-none data-ending-style:pointer-events-none`} />
        <Dialog.Popup ref={popup} className={`${FRAME_CLASS} ${className}`} {...(modal ? {} : { initialFocus: false })} {...attributes} data-sheet-frame>
          <Frame.Provider value={{ popup, close: () => onClose() }}>{children}</Frame.Provider>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Where a drag stands: its start, and the last two points for the speed of a flick. */
interface Drag {
  id: number;
  from: number;
  at: number;
  y: number;
  speed: number;
}

/** The handle: a grip the finger drags the sheet down by. Not a button: a tap on it does nothing. */
export function SheetHandle({ className = "" }: { className?: string }) {
  const parts = use(Frame);
  const drag = useRef<Drag | null>(null);
  const move = (frame: HTMLElement, by: number): void => {
    frame.style.transition = "none";
    frame.style.transform = `translateY(${String(by)}px)`;
  };
  const release = (frame: HTMLElement): void => {
    frame.style.transition = "";
    frame.style.transform = "";
  };
  const down = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { id: event.pointerId, from: event.clientY, at: performance.now(), y: event.clientY, speed: 0 };
  };
  const moved = (event: PointerEvent<HTMLDivElement>): void => {
    const held = drag.current;
    const frame = parts?.popup.current;
    if (held === null || held.id !== event.pointerId || frame === null || frame === undefined) return;
    const time = performance.now();
    const elapsed = Math.max(1, time - held.at);
    held.speed = (event.clientY - held.y) / elapsed;
    held.at = time;
    held.y = event.clientY;
    move(frame, Math.max(0, event.clientY - held.from));
  };
  const up = (event: PointerEvent<HTMLDivElement>): void => {
    const held = drag.current;
    drag.current = null;
    const frame = parts?.popup.current;
    if (held === null || held.id !== event.pointerId || frame === null || frame === undefined) return;
    const by = Math.max(0, event.clientY - held.from);
    const height = frame.getBoundingClientRect().height;
    const flicked = held.speed >= FLICK_SPEED && by >= FLICK_MIN_PX;
    release(frame);
    if (by * CLOSE_SHARE > height || flicked) parts?.close();
  };
  const cancel = (): void => {
    drag.current = null;
    const frame = parts?.popup.current;
    if (frame !== null && frame !== undefined) release(frame);
  };
  return (
    <div
      aria-hidden
      className={`mx-auto flex h-7 w-24 shrink-0 cursor-grab touch-none items-center justify-center ${className}`}
      onPointerDown={down}
      onPointerMove={moved}
      onPointerUp={up}
      onPointerCancel={cancel}
      data-sheet-handle
    >
      <span className="h-[5px] w-10 rounded-[3px] bg-text/25" />
    </div>
  );
}

/** The one close, at the sheet's top right, a 44 px hit area round its mark. */
export function SheetCloseButton({ label, className = "" }: { label: string; className?: string }) {
  return (
    <Dialog.Close aria-label={label} className={`press absolute top-1.5 right-1.5 z-[1] flex size-11 items-center justify-center rounded-[12px] text-text-2 ${className}`} data-sheet-close>
      <X size={20} aria-hidden />
    </Dialog.Close>
  );
}
