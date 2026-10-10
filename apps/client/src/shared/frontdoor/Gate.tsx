// The scene under the front door, the prologue and the handover (prologue.md R-PROLOGUE-009): the
// family compound with the character on a plinth at the gate, never a bare page. The figure turns slowly and a
// finger drags it round (the design's onboarding). The sheet rises over the bottom of the screen and the top
// keeps the character in view. Where WebGL is missing the compound's colours and the look's own picture stand in.
import { paletteCss } from "@japacity/assets";
import { lazy, type PointerEvent, type ReactNode, Suspense, useMemo, useRef } from "react";

import { readPerson } from "../../authority/person";
import { LOOKS, lookOf } from "./looks";
import { DRAG_TURN, type Spin } from "./spin";

const FrontScene = lazy(() => import("./FrontScene"));

function canDraw(): boolean {
  if (typeof window === "undefined" || !("WebGL2RenderingContext" in window)) return false;
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return false;
  }
}

/** The look shown at the gate: the one given, else the one kept beside the save, else the strip's first. */
export function gateLook(given?: string | null): string {
  return lookOf(given)?.id ?? lookOf(readPerson()?.look)?.id ?? LOOKS[0]?.id ?? "chr_ada";
}

export interface GateProps {
  /** The look at the gate, `chr_ada`; the kept one when left out. */
  look?: string | null;
  /** The sheet over the bottom of the scene. */
  children: ReactNode;
  /** A mark for tests and pictures: `data-gate` carries it. */
  mark?: string;
  /** What stands over the top of the scene: the run's progress, the data page. */
  over?: ReactNode;
}

export function Gate({ look, children, mark, over }: GateProps) {
  const drawing = useMemo(canDraw, []);
  const shown = lookOf(gateLook(look));
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
    shown === undefined || shown === null || shown.picture === "" ? null : (
      <img src={shown.picture} alt="" data-gate-standin className="absolute top-[12%] left-1/2 h-[34%] -translate-x-1/2" />
    );
  return (
    <div className="fixed inset-0 overflow-hidden" data-gate={mark ?? ""} data-look={shown?.id}>
      <div
        className="absolute inset-0"
        data-front-scene
        aria-hidden
        onPointerDown={grab}
        onPointerMove={drag}
        onPointerUp={drop}
        onPointerCancel={drop}
        // The compound's own colours, the sky over the yard's wall: the 3D world keeps its colours in both themes (R-WORLD-021).
        // The figure is dragged round, so the page under the finger never scrolls.
        style={{ background: paletteCss("laterite"), touchAction: "none" }}
      >
        {/* Three flat bands, the sky, the wall and the ground: no gradient (R-WORLD-021). */}
        <div aria-hidden className="absolute inset-x-0 top-0 h-[30%]" style={{ background: paletteCss("sky") }} />
        <div aria-hidden className="absolute inset-x-0 top-[30%] h-[14%]" style={{ background: paletteCss("wallCream") }} />
        {/* The look's own picture stands in until the scene has loaded, and where WebGL is missing. */}
        {drawing ? (
          <Suspense fallback={standIn}>
            <FrontScene look={shown?.file ?? "shared/chr/chr_ada.glb"} spin={spin} />
          </Suspense>
        ) : (
          standIn
        )}
      </div>
      {over === undefined ? null : <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col px-3 pt-[max(10px,env(safe-area-inset-top))]">{over}</div>}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex max-h-full flex-col justify-end">{children}</div>
    </div>
  );
}

/** The sheet over the compound: one panel rising from the bottom, its body scrolling inside it, under at most half the screen. */
export function GateSheet({ children, foot, mark, label }: { children: ReactNode; foot?: ReactNode; mark?: string; label?: string }) {
  return (
    <section aria-label={label} className="panel rise pointer-events-auto mx-2 mb-2 flex max-h-[min(58dvh,540px)] flex-col overflow-hidden" data-gate-sheet={mark ?? ""}>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      {foot === undefined ? null : <div className="shrink-0 border-t border-sheet-line px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))]">{foot}</div>}
    </section>
  );
}
