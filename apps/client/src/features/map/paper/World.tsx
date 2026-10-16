// The painted map as a view sees it (docs/rules/world.md R-WORLD-015): the paper, the small pictures standing on it
// (Makoko's huts, the canoes, the danfos) and the places, each its own sticker and the sticker the pin, moved and
// zoomed together by one transform. The stickers keep their size on the screen at every zoom; the huts and boats are
// part of the paper and grow with it. One pin rule in every zoom (stops.ts): a ring only where the player stands, on the
// stop picked and on the step's place; names on those, on home and on a place never visited, and on a card on a place visited.
import type { CSSProperties } from "react";
import { memo, use, useMemo } from "react";

import { headingOf } from "../RideSheet";
import { mapWords } from "../map.words";
import type { Point } from "./fit";
import { DECOR, LANTERN_CANOE } from "./geometry";
import { type CanoeFill, LanternCanoe } from "./LanternCanoe";
import { PaperSvg, type Variant } from "./PaperSvg";
import { PlacePicture } from "./PlacePicture";
import { midway } from "./route";
import { RouteVehicle } from "./routeVehicle";
import { curve } from "./smooth";
import { type Marks, type Name, nameOf, type NameShift, placeNames, type Placed, ringOf } from "./stops";
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

/** R-WORLD-036: the lantern canoe as the open map draws it: its glow, its tap, and whether it carries a second lantern. */
export interface Canoe extends CanoeFill {
  onOpen: () => void;
  mine: boolean;
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
  /** The part of the paper this view shows, when it never moves: the grain outside it is left undrawn. */
  within?: readonly [number, number, number, number] | null;
  onPick?: (id: string) => void;
  /** R-WORLD-036: the lantern canoe, drawn on the open map alone. */
  canoe?: Canoe | null;
  /** The district names painted, by key; all when absent. */
  labels?: ReadonlySet<string> | null;
  className?: string;
  style?: CSSProperties | undefined;
}

const NAME_KEYS: Readonly<Record<Exclude<Name, "picked" | "step" | "been" | "new">, string>> = { here: "map.state.here", home: "map.state.home" };

/** The words on a name: "You are here", "Home", or the place's own name (with a chevron when it opens the ride). */
function nameWords(kind: Name, name: string): string {
  if (kind === "here" || kind === "home") return mapWords(NAME_KEYS[kind]);
  return headingOf(name);
}

/** The most never-visited names a card shows at once (the notes item 12: a few at a time). */
export const NEWEST = 3;
/** The paper drawn round a card's own view, in paper units (CardView's `within`). */
const MARGIN = 20;

/** A name moved clear of another, as its own offset in the pin's pixels. */
function shiftStyle(shift: NameShift | undefined): CSSProperties | undefined {
  if (shift === undefined || (shift[0] === 0 && shift[1] === 0)) return undefined;
  return { "--nx": `${String(shift[0])}px`, "--ny": `${String(shift[1])}px` } as CSSProperties;
}

export const World = memo(function World({ variant, frame, uid, stops = [], names = (id) => id, marks = { home: null, picked: null, step: null }, tiles, pinPx = 50, route = null, within = null, onPick, canoe = null, labels = null, className = "", style }: WorldProps) {
  const z = frame.sx;
  const routeD = useMemo(() => (route === null ? null : curve(route)), [route]);
  const danfo = useMemo(() => (route === null || route.length < 2 ? null : midway(route)), [route]);
  const vehicle = use(RouteVehicle);
  const folded = variant === "folded";
  // Which names show and where: every one that matters, moved clear of another where they meet; a never-visited
  // place's only on a card, a few at a time, the nearest the card's middle first, and only where it covers none.
  const shown = useMemo(() => {
    const boxes = stops.flatMap((stop) => {
      const kind = nameOf(stop, marks, variant === "card");
      if (kind === null) return [];
      const size = Math.round((pinPx * sizeOf(stop.id)) / 100);
      const text = nameWords(kind, names(stop.id));
      const up = kind === "picked" || kind === "step";
      return [{ id: stop.id, x: stop.at[0] * z, y: stop.at[1] * z + (up ? -size : size * 0.4), width: text.length * 7 + 22, height: up ? 30 : 22, name: kind }];
    });
    // The card draws the paper it shows and a margin of twenty units round it; the names count only on the part seen.
    const seen = within === null ? null : ([(within[0] + MARGIN) * z, (within[1] + MARGIN) * z, (within[2] - MARGIN) * z, (within[3] - MARGIN) * z] as const);
    const centre = seen === null ? null : ([(seen[0] + seen[2]) / 2, (seen[1] + seen[3]) / 2] as const);
    return placeNames(boxes, variant === "card" ? { newest: NEWEST, centre, seen } : { newest: 0 });
  }, [stops, marks, pinPx, names, z, variant, within]);

  return (
    <div
      className={`paper-world ${className}`}
      style={{ transform: `translate(${String(frame.x)}px, ${String(frame.y)}px) scale(${String(frame.sx)}, ${String(frame.sy)})`, ...({ "--z": z, "--inv": 1 / z } as CSSProperties), ...style }}
      data-world={variant}
    >
      <PaperSvg variant={variant} route={routeD} uid={uid} within={within} labels={labels} />
      {folded
        ? null
        : DECOR.map((item, index) => {
            const url = tiles(item.model);
            return url === null ? null : (
              <span key={index} className={`stk paper-chip ${item.kind === "boat" ? "boat" : ""}`} style={{ left: item.at[0], top: item.at[1], width: item.size, height: item.size, transform: `translate(-50%, -62%) rotate(${String(item.tilt)}deg)`, ...({ "--e": "0.6px" } as CSSProperties) }} data-decor={item.model}>
                <img src={url} alt="" draggable={false} />
              </span>
            );
          })}
      {variant === "open" && canoe !== null ? <LanternCanoe at={LANTERN_CANOE.at} mine={canoe.mine} fill={canoe} onOpen={canoe.onOpen} /> : null}
      {folded
        ? null
        : stops.map((stop) => {
            const ring = ringOf(stop, marks);
            const kind = nameOf(stop, marks, variant === "card");
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
                  <span className="paper-name" data-name={kind} style={shiftStyle(shown.get(stop.id))} aria-hidden>
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
            {tiles(vehicle) === null ? null : <img src={tiles(vehicle) ?? ""} alt="" draggable={false} className="block size-full object-contain" data-route-vehicle={vehicle} />}
          </span>
        </span>
      )}
    </div>
  );
});
