// The plane cut (world:plane-cut-at-send-off; chapter:send-off-scene-in-beats beat 4): the painted map of Lagos at night,
// folded out with the lagoon under, one layer over it with a small plane lifting off from the airport along a dashed line
// toward the top of the screen in the route's direction, and the city's name arriving on a sticker card. The plane moves
// by transform alone for about three seconds; under reduced motion the map, the plane at the line's end and the sticker
// stand still for the same time. It draws nothing the map does not already have but the plane and the line: the same
// paper (World), no new tiles, no three.js scene, and it costs the map nothing when it is not mounted.
import "./paper.css";

import { content } from "@japacity/content";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef } from "react";

import { motionOn } from "../../../shared/ui/motion";
import type { PlaneCutSlot } from "../../../shared/world/sendOff";
import { type Point, toPaper } from "./fit";
import { useTiles } from "./useTiles";
import { World } from "./World";

/** The cut's stage, the phone size the design is drawn for; the scene scales it to the screen. */
const STAGE = { width: 390, height: 844 } as const;
/** How many screen pixels a paper unit takes: the paper fills the screen above the airport, Ikeja's streets under it. */
const ZOOM = 1.5;
/** Where the airport stands on the stage, down from the top. */
const AIRPORT_Y = 620;
/** The bearing from Lagos to each country's arrival, in degrees from north: the line leans that way. */
const BEARING: Readonly<Record<string, number>> = { "country.uk": -6, "country.canada": -32, "country.uae": 58, "country.italy": 8 };

export type PlaneCutProps = PlaneCutSlot;

/** The plane's path on the stage: from the airport up and over the top edge, leaning with the bearing. */
export function planePath(country: string): { from: Point; control: Point; to: Point } {
  const bearing = ((BEARING[country] ?? 0) * Math.PI) / 180;
  const lean = Math.max(-420, Math.min(420, Math.tan(bearing) * (AIRPORT_Y + 60)));
  const fromX = Math.max(60, Math.min(STAGE.width - 60, STAGE.width / 2 - lean / 2));
  const from: Point = [fromX, AIRPORT_Y];
  const to: Point = [fromX + lean, -60];
  const control: Point = [fromX + lean * 0.25, AIRPORT_Y * 0.42];
  return { from, control, to };
}

/** A point along the quadratic path at `t`, and the heading there in degrees (0: pointing right). */
export function along(path: ReturnType<typeof planePath>, t: number): { at: Point; heading: number } {
  const { from, control, to } = path;
  const u = 1 - t;
  const at: Point = [u * u * from[0] + 2 * u * t * control[0] + t * t * to[0], u * u * from[1] + 2 * u * t * control[1] + t * t * to[1]];
  const dx = 2 * u * (control[0] - from[0]) + 2 * t * (to[0] - control[0]);
  const dy = 2 * u * (control[1] - from[1]) + 2 * t * (to[1] - control[1]);
  return { at, heading: (Math.atan2(dy, dx) * 180) / Math.PI };
}

/** Where the plane stands still under reduced motion: at the line's visible end, high on the screen. */
export const STILL_AT = 0.58;

/** The plane's transform at `t` along the path; the sticker is drawn pointing right, centred on its box. */
function planeTransform(path: ReturnType<typeof planePath>, t: number): string {
  const { at, heading } = along(path, t);
  return `translate(${String(Math.round(at[0] - 60))}px, ${String(Math.round(at[1] - 36))}px) rotate(${String(Math.round(heading))}deg)`;
}

/** The plane sticker: a small cream plane, the same drawing the gate's window shows. */
function PlaneSticker({ className = "", style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 100 60" width={120} height={72} aria-hidden data-plane>
      <g fill="#f3efe6" stroke="#1c2a5e" strokeWidth="1.2">
        <path d="M4 30 Q4 26 10 26 L86 26 Q98 27 98 30 Q98 33 86 34 L10 34 Q4 34 4 30 Z" />
        <path d="M50 27 L30 2 L40 2 L64 27 Z" />
        <path d="M50 33 L30 58 L40 58 L64 33 Z" />
        <path d="M12 27 L2 14 L9 14 L22 27 Z" />
        <path d="M12 33 L2 46 L9 46 L22 33 Z" />
      </g>
    </svg>
  );
}

export function PlaneCut({ country, city, small, line, ms }: PlaneCutProps) {
  const tiles = useTiles();
  const plane = useRef<HTMLDivElement>(null);
  const path = useMemo(() => planePath(country), [country]);
  const moving = useMemo(() => motionOn(), []);
  const position = content.place["place.airport-lagos"]?.position ?? { latE3: 6574, lonE3: 3321 };
  const airport = toPaper(position);
  const frame = { x: path.from[0] - ZOOM * airport[0], y: path.from[1] - ZOOM * airport[1], sx: ZOOM, sy: ZOOM };
  const within = [Math.floor(-frame.x / ZOOM) - 20, Math.floor(-frame.y / ZOOM) - 20, Math.ceil((STAGE.width - frame.x) / ZOOM) + 20, Math.ceil((STAGE.height - frame.y) / ZOOM) + 20] as const;
  // The lift, by transform alone: the plane's keyframes along the line, played once by the compositor.
  useEffect(() => {
    const element = plane.current;
    if (!moving || element === null || typeof element.animate !== "function") return;
    const frames = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => ({ transform: planeTransform(path, t) }));
    const lift = element.animate(frames, { duration: ms, easing: "cubic-bezier(0.45, 0, 0.6, 1)", fill: "forwards" });
    return () => lift.cancel();
  }, [moving, path, ms]);
  const d = `M ${String(path.from[0])} ${String(path.from[1])} Q ${String(path.control[0])} ${String(path.control[1])} ${String(path.to[0])} ${String(path.to[1])}`;
  return (
    <div className="absolute inset-0 overflow-hidden" data-plane-cut={moving ? "moving" : "still"}>
      <div className="paper absolute inset-0 overflow-hidden" data-paint="night">
        <World variant="open" uid="plane-cut" frame={frame} within={within} tiles={tiles} />
      </div>
      <svg className="absolute top-0 left-0" width={STAGE.width} height={STAGE.height} viewBox={`0 0 ${String(STAGE.width)} ${String(STAGE.height)}`} aria-hidden data-plane-line>
        <circle cx={path.from[0]} cy={path.from[1]} r="9" fill="#f3efe6" opacity="0.95" />
        <path d={d} stroke="#f3efe6" strokeWidth="5" strokeDasharray="14 12" strokeLinecap="round" fill="none" opacity="0.85" />
      </svg>
      <div ref={plane} className="absolute top-0 left-0" style={{ transform: planeTransform(path, moving ? 0 : STILL_AT), filter: "drop-shadow(0 16px 10px rgba(0,0,0,0.45))" }} data-plane-at={moving ? "lifting" : "still"}>
        <PlaneSticker />
      </div>
      <div className="so-city" data-plane-city>
        <span className="so-city-tile" aria-hidden>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1c2a5e" strokeWidth="2">
            <path d="M4 20h16M6 20V9l6-5 6 5v11M10 20v-5h4v5" />
          </svg>
        </span>
        <span>
          <b>{city}</b>
          <small>{small}</small>
        </span>
      </div>
      <p className="so-cut-line">{line}</p>
    </div>
  );
}

export default PlaneCut;
