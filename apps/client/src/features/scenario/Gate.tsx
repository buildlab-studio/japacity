// The scene under the front door, the prologue and the handover (prologue.md R-PROLOGUE-009): the
// family compound with the character at the gate, never a bare page. The sheet rises over the bottom of
// the screen and the top keeps the character in view. Where WebGL is missing the compound's colours and
// the look's own picture stand in for the scene.
import { paletteCss } from "@japacity/assets";
import { lazy, type ReactNode, Suspense, useMemo } from "react";

import { readPerson } from "../../authority/person";
import { LOOKS, lookOf } from "./looks";

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
  /** True while the sheet is up: the character turns to face it. */
  facingSheet?: boolean;
  /** The sheet over the bottom of the scene. */
  children: ReactNode;
  /** A mark for tests and pictures: `data-gate` carries it. */
  mark?: string;
}

export function Gate({ look, facingSheet = true, children, mark }: GateProps) {
  const drawing = useMemo(canDraw, []);
  const shown = lookOf(gateLook(look));
  return (
    <div className="fixed inset-0 overflow-hidden" data-gate={mark ?? ""} data-look={shown?.id}>
      <div
        className="absolute inset-0"
        data-front-scene
        aria-hidden
        // The compound's own colours, the sky over the yard's wall: the 3D world keeps its colours in both themes (R-WORLD-021).
        style={{ background: `linear-gradient(${paletteCss("sky")} 0 30%, ${paletteCss("wallCream")} 30% 44%, ${paletteCss("laterite")} 44%)` }}
      >
        {drawing ? (
          <Suspense fallback={null}>
            <FrontScene look={shown?.file ?? "shared/chr/chr_ada.glb"} facingSheet={facingSheet} />
          </Suspense>
        ) : shown === undefined || shown === null || shown.picture === "" ? null : (
          <img src={shown.picture} alt="" className="absolute top-[12%] left-1/2 h-[34%] -translate-x-1/2" />
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex max-h-full flex-col justify-end">{children}</div>
    </div>
  );
}

/** The sheet over the compound: one panel rising from the bottom, its body scrolling inside it, under at most half the screen. */
export function GateSheet({ children, foot, mark, label }: { children: ReactNode; foot?: ReactNode; mark?: string; label?: string }) {
  return (
    <section aria-label={label} className="panel rise pointer-events-auto mx-2 mb-2 flex max-h-[min(54dvh,520px)] flex-col overflow-hidden" data-gate-sheet={mark ?? ""}>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      {foot === undefined ? null : <div className="shrink-0 border-t border-sheet-line px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))]">{foot}</div>}
    </section>
  );
}
