// The scene under the account's screens (account:start-screen-over-live-city): the live city behind the start screen, or the
// family compound with the character on a plinth at the gate, never a bare page. The front door, the prologue and the
// handover do not stand on it: they stand on the door's sky (prologue:front-door-three-screens). The figure turns slowly and a
// finger drags it round. The sheet rises over the bottom of the screen and the top
// keeps the character in view, in the player's own colours (prologue:player-colours-on-looks). Where WebGL is missing the compound's
// colours and the look's own picture stand in.
import { type PointerEvent, type ReactNode, Suspense, useMemo, useRef, useState } from "react";

import { readPerson } from "./person";
import { softLazy } from "../net/parts";
import { LOOKS, lookOf } from "./looks";
import { DRAG_TURN, type Spin } from "./spin";
import type { LookStyle } from "./style";

const FrontScene = softLazy(() => import("./FrontScene"));

/** The answer of the first ask, kept for the visit. */
let draws: boolean | null = null;

/** Lets the asking context go; where it cannot be let go, it is left for the browser. */
function letGo(context: WebGL2RenderingContext | null): void {
  try {
    context?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    // A context with no way to lose it is collected with its canvas.
  }
}

/**
 * True where WebGL 2 can draw: the scene, and the page's photo in the player's colours. Asking makes a context, and the
 * door asks on every look, colour and Begin, so it asks once a visit and lets that context go at once (a phone holds
 * only a few, and each one made costs the main thread, the more so while the GPU is busy).
 */
export function canDraw(): boolean {
  if (typeof window === "undefined" || !("WebGL2RenderingContext" in window)) return false;
  if (draws !== null) return draws;
  try {
    const context = document.createElement("canvas").getContext("webgl2");
    draws = context !== null;
    letGo(context);
  } catch {
    draws = false;
  }
  return draws;
}

/** The look shown at the gate: the one given, else the one kept beside the save, else the strip's first. */
export function gateLook(given?: string | null): string {
  return lookOf(given)?.id ?? lookOf(readPerson()?.look)?.id ?? LOOKS[0]?.id ?? "person_ada";
}

export interface GateProps {
  /** The look at the gate, `person_ada`; the kept one when left out. */
  look?: string | null;
  /** The sheet over the bottom of the scene. */
  children: ReactNode;
  /** A mark for tests and pictures: `data-gate` carries it. */
  mark?: string;
  /** What stands over the top of the scene: the run's progress, the data page. */
  over?: ReactNode;
  /** The colours the figure wears; with no look given, the kept person's own. */
  style?: LookStyle | undefined;
  /**
   * Another scene in the figure's place: the live city behind the start screen and the ways in (account:start-screen-over-live-city).
   * Not dragged. With none given, the compound and the figure stand.
   */
  scene?: ReactNode;
}

export function Gate({ look, children, mark, over, style, scene }: GateProps) {
  const drawing = useMemo(canDraw, []);
  // The look's picture stands in until the figure is in the scene, so the first screen never reads empty while the compound loads.
  const [drawn, setDrawn] = useState(false);
  const shown = lookOf(gateLook(look));
  const kept = look === undefined || look === null ? readPerson() : null;
  const worn = style ?? (kept !== null && kept.look === shown?.id ? kept.style : undefined);
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
        // The compound's own colours, the sky over the yard's wall: the 3D world keeps its colours in both themes (world:colours-are-role-tokens).
        // The figure is dragged round, so the page under the finger never scrolls.
        style={{ background: "var(--strong-2)", touchAction: "none" }}
      >
        {/* The theme's own band behind the figure (world:colours-are-role-tokens: an interface colour is a role token, never sand or cream). The compound keeps its own colours and shows through a clear sky. */}
        {/* The look's own picture stands in until the scene has loaded, so the first screen never reads empty on a slow phone, and where WebGL is missing. */}
        {scene !== undefined ? (
          // world:reach-and-read: the live city behind the start screen takes no Tab and no tap.
          <div className="pointer-events-none absolute inset-0" inert data-gate-scene>
            {scene}
          </div>
        ) : drawing ? (
          <>
            <Suspense fallback={null}>
              <FrontScene look={shown?.file ?? "shared/person/person_ada.glb"} spin={spin} style={worn} onShown={() => setDrawn(true)} />
            </Suspense>
            {drawn ? null : standIn}
          </>
        ) : (
          standIn
        )}
      </div>
      {over === undefined ? null : <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col px-3 pt-[max(10px,env(safe-area-inset-top))]" data-gate-over>{over}</div>}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex max-h-full flex-col justify-end" data-gate-foot>{children}</div>
    </div>
  );
}

/**
 * The sheet over the compound, or under the figure on its turntable: one panel rising from the bottom, at most half the
 * screen, its body scrolling inside it, and the one main button at its foot. `low` holds it to
 * about a third, where the page docks over it and the figure's head must stay in view (prologue:printed-page-hands-over).
 * `tall` lets it rise to the band across the top, for the ways back in, whose steps fit a small phone whole with the
 * keyboard closed (account:code-form-forgives).
 */
export function GateSheet({ children, foot, mark, label, low = false, tall = false }: { children: ReactNode; foot?: ReactNode; mark?: string; label?: string; low?: boolean; tall?: boolean }) {
  const cap = low ? "max-h-[34dvh]" : tall ? "max-h-[calc(100dvh-6rem-env(safe-area-inset-top))]" : "max-h-[50dvh]";
  return (
    <section aria-label={label} className={`panel rise pointer-events-auto mx-2 mb-2 flex ${cap} min-h-0 flex-col overflow-hidden pb-[max(10px,env(safe-area-inset-bottom))]`} data-gate-sheet={mark ?? ""}>
      <div className={`min-h-0 flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overflow-y-auto px-4 pt-4 ${foot === undefined ? "pb-2" : ""}`}>{children}</div>
      {foot === undefined ? null : <div className="shrink-0 px-4 pt-3">{foot}</div>}
    </section>
  );
}
