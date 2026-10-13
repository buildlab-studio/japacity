// The strip (docs/rules/world.md R-WORLD-015; the second design): the whole painted map folded flat into a white card
// with a navy edge and a pull handle, under the band's place at the top. A filled dot where the player stands with the
// neighbourhood's name, a tiny house for home, a yellow dot for the step's place; the route across the city when the
// stop picked is in another neighbourhood. A tap anywhere on it, or a drag down, unfolds the map.
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useRef } from "react";

import { mapWords } from "../map.words";
import { at, type Point, PAPER } from "./fit";
import { DECOR } from "./geometry";
import type { Placed } from "./stops";
import type { TileUrl } from "./useTiles";
import { type Frame, World } from "./World";

/** The strip's inner height on the screen, in pixels. */
export const STRIP_H = 84;
/** The paper rows the strip folds: from the top of Ikeja to the beach. */
const TOP = at([6612, 3290])[1];
const BOTTOM = at([6407, 3290])[1];

/** The fold: the whole width of the paper and the rows from Ikeja to the beach, squeezed into the strip's box. */
export function stripFrame(width: number, height = STRIP_H): Frame {
  const sx = width / PAPER.width;
  const sy = height / (BOTTOM - TOP);
  return { x: 0, y: -TOP * sy, sx, sy };
}

/** A paper point on the strip, in the strip's own pixels. */
export function onStrip(frame: Frame, [x, y]: Point): Point {
  return [frame.x + x * frame.sx, frame.y + y * frame.sy];
}

/** The few pictures that stay standing on the folded paper: the stadium, Makoko's huts, two canoes. */
const MINIS: readonly { model: string; at: Point; size: number }[] = [
  ...DECOR.filter((item) => item.model.startsWith("bld_makoko") || item.model === "bld_stilt-house")
    .slice(0, 3)
    .map((item) => ({ model: item.model, at: item.at, size: 13 })),
  ...DECOR.filter((item) => item.kind === "boat")
    .slice(1, 3)
    .map((item) => ({ model: item.model, at: item.at, size: 16 })),
];

export interface StripProps {
  width: number;
  stops: readonly Placed[];
  home: string | null;
  step: string | null;
  /** The name of the neighbourhood the player stands in. */
  hereName: string | null;
  stadium: Point | null;
  route: readonly Point[] | null;
  tiles: TileUrl;
  onTap: () => void;
  onDrag: (dy: number) => void;
  onRelease: () => void;
  style?: CSSProperties;
}

export function Strip({ width, stops, home, step, hereName, stadium, route, tiles, onTap, onDrag, onRelease, style }: StripProps) {
  const inner = Math.max(1, width - 8);
  const frame = stripFrame(inner);
  const here = stops.find((stop) => stop.state === "here") ?? null;
  const homeStop = stops.find((stop) => stop.id === home) ?? null;
  const stepStop = stops.find((stop) => stop.id === step) ?? null;
  const down = useRef<{ y: number; moved: boolean } | null>(null);
  const at = (point: Point, z = 3): CSSProperties => {
    const [x, y] = onStrip(frame, point);
    return { left: x, top: y, zIndex: z };
  };
  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    down.current = { y: event.clientY, moved: false };
    if (typeof event.currentTarget.setPointerCapture === "function") event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (down.current === null) return;
    const dy = event.clientY - down.current.y;
    if (Math.abs(dy) > 6) down.current.moved = true;
    if (down.current.moved) onDrag(Math.max(0, dy));
  };
  const pointerUp = (): void => {
    const was = down.current;
    down.current = null;
    if (was === null) return;
    if (was.moved) onRelease();
    else onTap();
  };
  return (
    <button
      type="button"
      className="paper-strip"
      style={style}
      onPointerDown={pointerDown}
      onPointerMove={pointerMove}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onTap();
        }
      }}
      aria-label={mapWords("map.unfold")}
      data-strip
    >
      <span className="paper-strip-in">
        <World variant="folded" uid="strip" frame={frame} tiles={tiles} route={route} />
        {stadium === null ? null : (
          <span className="paper-mk" style={at(stadium, 2)}>
            {tiles("lm_national-stadium") === null ? null : <img src={tiles("lm_national-stadium") ?? ""} alt="" width={26} height={26} className="paper-cut" draggable={false} />}
          </span>
        )}
        {MINIS.map((mini, index) => (
          <span key={index} className="paper-mk" style={at(mini.at, 1)}>
            {tiles(mini.model) === null ? null : <img src={tiles(mini.model) ?? ""} alt="" width={mini.size} height={mini.size} className="paper-cut" draggable={false} />}
          </span>
        ))}
        {homeStop === null ? null : (
          <span className="paper-mk" style={at(homeStop.at, 5)} data-strip-home>
            <svg width="16" height="16" viewBox="-8 -9 16 16" aria-hidden>
              <path d="M -6,-1 L 0,-7 L 6,-1 L 6,6 L -6,6 Z" fill="#fff" stroke="#1B2A4A" strokeWidth="1.6" strokeLinejoin="round" />
              <rect x="-1.6" y="1.5" width="3.2" height="4.5" fill="#1B2A4A" />
            </svg>
          </span>
        )}
        {stepStop === null ? null : <span className="paper-mk" style={at(stepStop.at, 6)} data-strip-step><span className="paper-stepdot" /></span>}
        {here === null ? null : (
          <>
            <span className="paper-mk" style={at(here.at, 7)} data-strip-here>
              <span className="paper-youdot" />
            </span>
            {hereName === null ? null : (
              <span className="paper-mk" style={{ ...at(here.at, 7), marginTop: -15 }}>
                <span className="paper-stripname">{hereName}</span>
              </span>
            )}
          </>
        )}
      </span>
      <span className="paper-pull" aria-hidden />
    </button>
  );
}
