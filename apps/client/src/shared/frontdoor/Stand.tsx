// The first two screens of the front door as the design draws them (prologue.md R-PROLOGUE-009, 013): the theme's
// own band from edge to edge, the header at the top, the name over the figure and the path and age beneath the name,
// the figure alone on its turntable filling the space between them and the sheet, whole from hair to shoes, "Drag to turn" at its foot, and the sheet under it. No compound
// behind the figure here; the compound and its plinth stand behind the page and the world. Where WebGL is missing,
// or until the figure stands, the look's own picture stands in.
import { lazy, type PointerEvent, type ReactNode, Suspense, useMemo, useRef, useState } from "react";

import { say } from "../words/text";
import { canDraw } from "./Gate";
import { lookOf } from "./looks";
import { DRAG_TURN, type Spin } from "./spin";
import type { LookStyle } from "./style";

const Turntable = lazy(() => import("./Turntable"));

export interface StandProps {
  /** The look on the turntable, `chr_ada`. */
  look: string;
  style?: LookStyle | undefined;
  /** A mark for tests and pictures: `data-gate` carries it, as the gate's does. */
  mark: string;
  /** The row over the figure: the way back, where the run is, and the ways to go faster. */
  head: ReactNode;
  /** The name over the figure, bold, and the path and age small beneath it. */
  name: string;
  caption: string;
  /** The sheet under the figure. */
  children: ReactNode;
}

export function Stand({ look, style, mark, head, name, caption, children }: StandProps) {
  const drawing = useMemo(canDraw, []);
  const [drawn, setDrawn] = useState(false);
  const shown = lookOf(look);
  const spin = useRef<Spin>({ dragging: false, pending: 0, last: 0 }).current;
  const grab = (event: PointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    spin.dragging = true;
    spin.last = event.clientX;
  };
  const drag = (event: PointerEvent<HTMLDivElement>): void => {
    if (!spin.dragging) return;
    spin.pending += (event.clientX - spin.last) * DRAG_TURN;
    spin.last = event.clientX;
  };
  const drop = (): void => {
    spin.dragging = false;
  };
  const standIn =
    shown === null || shown.picture === "" ? null : (
      <img src={shown.picture} alt="" draggable={false} data-gate-standin className="pointer-events-none absolute top-[16%] left-1/2 h-[74%] -translate-x-1/2 object-contain" />
    );
  return (
    <div className="band-2 fixed inset-0 flex flex-col overflow-hidden" data-gate={mark} data-look={shown?.id} data-stand>
      <div className="shrink-0 px-3 pt-[max(12px,env(safe-area-inset-top))]">{head}</div>
      {/* The name and the path and age stand over the figure, never on it: the figure fills the space under them. */}
      <div className="pointer-events-none shrink-0 pt-1.5 text-center leading-tight" data-stand-name>
        <div className="truncate px-4 text-[15px] font-extrabold">{name === "" ? say("prologue.page.empty") : name}</div>
        <div className="num truncate px-4 text-[12px] opacity-75">{caption}</div>
      </div>
      <div
        className="relative min-h-0 flex-1"
        data-turntable
        aria-hidden
        onPointerDown={grab}
        onPointerMove={drag}
        onPointerUp={drop}
        onPointerCancel={drop}
        // The figure is dragged round, so the page under the finger never scrolls.
        style={{ touchAction: "none", cursor: "grab" }}
      >
        {drawing ? (
          <>
            <Suspense fallback={null}>
              <Turntable look={shown?.file ?? "shared/chr/chr_ada.glb"} spin={spin} style={style} onShown={() => setDrawn(true)} />
            </Suspense>
            {drawn ? null : standIn}
          </>
        ) : (
          standIn
        )}
        <div className="label pointer-events-none absolute inset-x-0 bottom-1.5 text-center text-[10px] opacity-55" data-stand-drag>
          {say("prologue.door.drag")}
        </div>
      </div>
      <div className="flex max-h-[50%] min-h-0 shrink-0 flex-col">{children}</div>
    </div>
  );
}
