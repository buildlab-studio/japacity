// The lantern canoe (docs/rules/world.md R-WORLD-036; the decision of 15 Oct 2026, pictures `preview/dedication-2/01`,
// `02` and `07`): on the open map of Lagos, one canoe moored on the open lagoon north-east of the bridge with a lantern
// at its prow. By day one more canoe of the water with a warm dot; at night the one light on that water, its glow drawn
// over the night's paint so it never goes out. Once the account's own light is lit (account.md R-ACCOUNT-033) a second
// lantern hangs at its stern. A tap opens the dedication page and folds nothing; a screen reader hears "A canoe with a
// lantern". It is not a stop: no board, no name, no ride.
//
// It stands on the paper like a sticker, the same size on the screen at every zoom, so its hit area stays 44 px. The
// glow is the fill the shell hands in (the two lights' one glow, R-WORLD-021), on a layer that breathes by opacity
// alone in CSS (paper.css `paper-canoe-breath`), still under reduced motion (R-WORLD-023).
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

import { say } from "../../../shared/words/text";
import type { Point } from "./fit";

/** R-WORLD-036: the hit area, in screen pixels: at least 44 each way. */
export const CANOE_HIT = 44;

/** The canoe as the design draws it, in its own units (56 by 34), shown at 38 by 23 screen pixels, a little low in the hit area. */
const DRAWN = { width: 38, height: 23, left: (CANOE_HIT - 38) / 2, top: (CANOE_HIT - 23) / 2 + 3 } as const;
/** A point of the drawing's own units on the hit area. */
function shown(x: number, y: number): { x: number; y: number } {
  return { x: DRAWN.left + (x * DRAWN.width) / 56, y: DRAWN.top + (y * DRAWN.height) / 34 };
}
/** Where each lantern's glass sits: the prow's at (44, 4.5) of the drawing, the stern's at (12.75, 5.75). */
const PROW = shown(44, 4.5);
const STERN = shown(12.75, 5.75);

/** How wide each glow reaches round its lantern, in screen pixels, by day and at night. */
const DAY_GLOW = 22;
const NIGHT_GLOW = 65;
const NIGHT_HEART = 28;

export interface CanoeFill {
  /** The glow's fill at `alpha`: the shell's, the two lights' one glow. */
  glow: (alpha: number) => string;
}

function Glow({ at, radius, alpha, fill, kind }: { at: { x: number; y: number }; radius: number; alpha: number; fill: CanoeFill["glow"]; kind: string }) {
  const style: CSSProperties = { left: at.x - radius, top: at.y - radius, width: 2 * radius, height: 2 * radius, background: fill(alpha) };
  return <span className="paper-canoe-breath" style={style} data-canoe-glow={kind} aria-hidden />;
}

/** The pointer stays with the canoe: the open map under it neither pans nor reads a tap on a district. */
function keep(event: ReactPointerEvent): void {
  event.stopPropagation();
}

export function LanternCanoe({ at, mine, fill, onOpen }: { at: Point; mine: boolean; fill: CanoeFill; onOpen: () => void }) {
  const lanterns = mine ? [PROW, STERN] : [PROW];
  return (
    <button
      type="button"
      className="paper-canoe"
      style={{ left: at[0], top: at[1] }}
      aria-label={say("ui.dedication.canoe")}
      onPointerDown={keep}
      onPointerUp={keep}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      data-canoe
      data-lanterns={lanterns.length}
    >
      {/* By day a warm dot's small glow; at night the light on the water (paper.css shows it under the night paint). */}
      {lanterns.map((lantern, index) => (
        <Glow key={`day-${String(index)}`} at={lantern} radius={DAY_GLOW} alpha={0.55} fill={fill.glow} kind="day" />
      ))}
      <span className="paper-canoe-night" aria-hidden>
        <Glow at={mine ? { x: (PROW.x + STERN.x) / 2, y: PROW.y } : PROW} radius={NIGHT_GLOW} alpha={0.85} fill={fill.glow} kind="night" />
        {lanterns.map((lantern, index) => (
          <Glow key={`heart-${String(index)}`} at={lantern} radius={NIGHT_HEART} alpha={0.85} fill={fill.glow} kind="heart" />
        ))}
      </span>
      <svg className="paper-canoe-boat" width={DRAWN.width} height={DRAWN.height} viewBox="0 0 56 34" style={{ left: DRAWN.left, top: DRAWN.top }} aria-hidden>
        <path d="M4 18 C 10 30, 46 30, 52 18 L 48 14 C 40 20, 16 20, 8 14 Z" fill="#7a4a1e" stroke="#4a2c10" strokeWidth="1.2" />
        <path d="M8 14 C 16 20, 40 20, 48 14" fill="none" stroke="#a9772f" strokeWidth="1.2" />
        <rect x="43" y="4" width="1.6" height="12" fill="#4a2c10" />
        <rect x="41" y="1.5" width="6" height="6" rx="1.5" fill="#fff3c4" stroke="#c98a1a" strokeWidth="1" data-lantern="prow" />
        {mine ? (
          <>
            <rect x="12" y="6" width="1.4" height="10" fill="#4a2c10" />
            <rect x="10.5" y="3.5" width="4.5" height="4.5" rx="1.2" fill="#fff3c4" stroke="#c98a1a" strokeWidth="0.9" data-lantern="stern" />
          </>
        ) : null}
      </svg>
    </button>
  );
}
