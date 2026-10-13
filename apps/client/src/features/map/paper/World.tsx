// The painted map as a view sees it (docs/rules/world.md R-WORLD-015): the paper, the small pictures standing on it
// (Makoko's huts, the canoes, the danfos) and the places, each its own sticker and the sticker the pin, moved and
// zoomed together by one transform. The stickers keep their size on the screen at every zoom; the huts and boats are
// part of the paper and grow with it. One pin rule in every zoom (stops.ts): a ring only where the player stands, on the
// stop picked and on the step's place; names on those, on home and on a place never visited.
import type { CSSProperties } from "react";
import { memo, useMemo } from "react";

import { tileOf } from "../../../shared/tiles/tiles.data";
import { headingOf } from "../RideSheet";
import { mapWords } from "../map.words";
import type { Point } from "./fit";
import { DECOR } from "./geometry";
import { PaperSvg, type Variant } from "./PaperSvg";
import { midway } from "./route";
import { curve } from "./smooth";
import { type Marks, type Name, nameOf, namesShown, type Placed, ringOf } from "./stops";
import type { TileUrl } from "./useTiles";

/** Where a view puts the paper: moved by (x, y) screen pixels, then zoomed by sx across and sy down. */
export interface Frame {
  x: number;
  y: number;
  sx: number;
  sy: number;
}

/** How much larger than the rest a place's sticker stands: the stadium's bowl, the buildings, then the rooms' things. */
const SIZE: Readonly<Record<string, number>> = {
  "place.national-stadium": 150,
  "place.family-house": 118,
  "place.airport-lagos": 120,
  "place.ojuelegba": 112,
  "place.computer-village": 110,
  "place.tejuosho-market": 108,
  "place.bode-thomas": 106,
  "place.makoko": 104,
  "place.compound-room": 96,
};

export function sizeOf(id: string): number {
  return SIZE[id] ?? 92;
}

/** The flag over the passport office: a pole and the green, white and green, waving. */
function Flag() {
  return (
    <svg viewBox="0 0 40 64" className="absolute" style={{ width: "68%", height: "98%", right: "-16%", top: "-22%" }} aria-hidden>
      <path d="M8,4 L8,62" stroke="#8a7a60" strokeWidth="3" strokeLinecap="round" />
      <circle cx="8" cy="4" r="2.6" fill="#e0a21b" />
      <path d="M9,7 C17,4 23,10 32,7 L32,27 C23,30 17,24 9,27 Z" fill="#ffffff" stroke="#1b2a4a" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M9,7 C12,6 14,6.4 16.5,7.2 L16.5,26.2 C14,25.6 12,25.8 9,27 Z" fill="#1f8a4c" />
      <path d="M24.5,8.6 C27,8.8 29,8.2 32,7 L32,27 C29,28 27,28.6 24.5,28.4 Z" fill="#1f8a4c" />
    </svg>
  );
}

/**
 * A place whose own picture is the kit's tile with something beside it: the passport office is a counter with the flag
 * flying behind it, so it reads apart from the bank's counter (the tile table's row is the counter alone).
 */
const FLAGGED: ReadonlySet<string> = new Set(["place.passport-office"]);

/** A place's picture: its tile from the table, or the emoji standing in; the flag behind it where it has one. */
export function PlacePicture({ id, size, tiles }: { id: string; size: number; tiles: TileUrl }) {
  const picture = tileOf(id);
  if (FLAGGED.has(id) && "model" in picture) {
    const front = tiles(picture.model);
    return (
      <span className="paper-cut relative block" style={{ width: size, height: size, ...({ "--e": "2px" } as CSSProperties) }} data-picture={`${picture.model}+flag`}>
        <Flag />
        {front === null ? null : <img src={front} alt="" draggable={false} className="absolute object-contain" style={{ width: "88%", height: "88%", left: "0", bottom: "0" }} />}
      </span>
    );
  }
  if (!("model" in picture)) {
    return (
      <span className="paper-cut flex items-center justify-center" style={{ width: size, height: size, fontSize: Math.round(size * 0.7) }} aria-hidden>
        {picture.emoji}
      </span>
    );
  }
  const url = tiles(picture.model);
  return <span className="paper-cut block" style={{ width: size, height: size, ...({ "--e": "2px" } as CSSProperties) }}>{url === null ? null : <img src={url} alt="" draggable={false} className="block size-full object-contain" />}</span>;
}

export interface WorldProps {
  variant: Variant;
  frame: Frame;
  /** A unique name for this view, for the ids inside its drawing. */
  uid: string;
  /** The places standing on the paper (none when folded). */
  stops?: readonly Placed[];
  names?: (id: string) => string;
  marks?: Marks;
  tiles: TileUrl;
  /** A place's sticker's size on the screen, in pixels, before its own share. */
  pinPx?: number;
  route?: readonly Point[] | null;
  onPick?: (id: string) => void;
  className?: string;
  style?: CSSProperties | undefined;
}

const NAME_KEYS: Readonly<Record<Exclude<Name, "picked" | "step" | "new">, string>> = { here: "map.state.here", home: "map.state.home" };

/** The words on a name: "You are here", "Home", or the place's own name (with a chevron when it opens the ride). */
function nameWords(kind: Name, name: string): string {
  if (kind === "here" || kind === "home") return mapWords(NAME_KEYS[kind]);
  return headingOf(name);
}

export const World = memo(function World({ variant, frame, uid, stops = [], names = (id) => id, marks = { home: null, picked: null, step: null }, tiles, pinPx = 50, route = null, onPick, className = "", style }: WorldProps) {
  const z = frame.sx;
  const routeD = useMemo(() => (route === null ? null : curve(route)), [route]);
  const danfo = useMemo(() => (route === null || route.length < 2 ? null : midway(route)), [route]);
  const folded = variant === "folded";
  // Which names show: every one that matters, and a never-visited place's only where it covers none of those.
  const shown = useMemo(() => {
    const boxes = stops.flatMap((stop) => {
      const kind = nameOf(stop, marks);
      if (kind === null) return [];
      const size = Math.round((pinPx * sizeOf(stop.id)) / 100);
      const text = nameWords(kind, names(stop.id));
      const up = kind === "picked" || kind === "step";
      return [{ id: stop.id, x: stop.at[0] * z, y: stop.at[1] * z + (up ? -size : size * 0.4), width: text.length * 7 + 22, height: up ? 30 : 22, name: kind }];
    });
    return namesShown(boxes);
  }, [stops, marks, pinPx, names, z]);

  return (
    <div
      className={`paper-world ${className}`}
      style={{ transform: `translate(${String(frame.x)}px, ${String(frame.y)}px) scale(${String(frame.sx)}, ${String(frame.sy)})`, ...({ "--z": z, "--inv": 1 / z } as CSSProperties), ...style }}
      data-world={variant}
    >
      <PaperSvg variant={variant} route={routeD} uid={uid} />
      {folded
        ? null
        : DECOR.map((item, index) => {
            const url = tiles(item.model);
            return url === null ? null : (
              <span key={index} className={`stk paper-cut ${item.kind === "boat" ? "boat" : ""}`} style={{ left: item.at[0], top: item.at[1], width: item.size, height: item.size, transform: `translate(-50%, -62%) rotate(${String(item.tilt)}deg)`, ...({ "--e": "0.6px" } as CSSProperties) }} data-decor={item.model}>
                <img src={url} alt="" draggable={false} />
              </span>
            );
          })}
      {folded
        ? null
        : stops.map((stop) => {
            const ring = ringOf(stop, marks);
            const kind = nameOf(stop, marks);
            const size = Math.round((pinPx * sizeOf(stop.id)) / 100);
            const name = names(stop.id);
            return (
              <button
                key={stop.id}
                type="button"
                className="paper-pin"
                style={{ left: stop.at[0], top: stop.at[1], zIndex: ring === null ? (kind === "home" ? 3 : 2) : 4 }}
                onClick={(event) => {
                  event.stopPropagation();
                  onPick?.(stop.id);
                }}
                aria-label={headingOf(name)}
                data-pin={stop.id}
                data-state={stop.state}
                data-ring={ring ?? undefined}
              >
                {ring === null ? null : <span className="paper-ring" data-ring={ring} aria-hidden />}
                <PlacePicture id={stop.id} size={size} tiles={tiles} />
                {kind === null || !shown.has(stop.id) ? null : (
                  <span className="paper-name" data-name={kind} aria-hidden>
                    {nameWords(kind, name)}
                    {kind === "picked" || kind === "step" ? <b className="ml-1">›</b> : null}
                  </span>
                )}
              </button>
            );
          })}
      {folded || danfo === null ? null : (
        <span className="paper-danfo" style={{ left: danfo.at[0], top: danfo.at[1] }} data-route-danfo aria-hidden>
          <span className="paper-cut block" style={{ width: 30, height: 30, scale: Math.abs(danfo.heading) > 90 ? "-1 1" : undefined }}>
            {tiles("veh_danfo") === null ? null : <img src={tiles("veh_danfo") ?? ""} alt="" draggable={false} className="block size-full object-contain" />}
          </span>
        </span>
      )}
    </div>
  );
});
