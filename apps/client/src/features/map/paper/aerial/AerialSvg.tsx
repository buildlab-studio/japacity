// Lagos from the air (world:map-is-painted-lagos): the paper as one SVG, drawn at once with the land, the water, the
// parks, the roads by kind, the bridges, the landmarks and the names, and the city's roofs, lanes and waves square by
// square as the idle slices lay them, each square fading in as it comes. The roofs of a square are a path per colour,
// drawn once more under themselves a hair up and to the left, from the same path, for the lit edge the sun gives them.
import type { CSSProperties } from "react";
import { memo, useEffect, useState, useSyncExternalStore } from "react";

import { mapWords } from "../../map.words";
import { outlineOf } from "../draw";
import { ROADS } from "../geometry";
import { usePaperCity } from "../lagos";
import type { PaperSvgProps } from "../PaperSvg";
import { curve } from "../smooth";
import { lagosAerial } from "./job";
import { ROOF_KINDS, type Square } from "./layout";
import { kindOf, nameStretch, type RoadKind, shiftsOf, STREET_NAMES } from "./roads";
import "./aerial.css";

/** The paper runs on past its own edges by this much, as PaperSvg's does. */
const BLEED = 500;
const n = String;

/** The roads by kind and the bridges, as path data: built the first time a view asks and kept. */
let roadPaths: { express: string; main: string; minor: string; bridges: { id: string; d: string }[] } | null = null;
function roadsOf(): NonNullable<typeof roadPaths> {
  if (roadPaths !== null) return roadPaths;
  const byKind = (kind: RoadKind): string =>
    ROADS.filter((road, at) => road.bridge === undefined && kindOf(road, at) === kind)
      .map((road) => curve(road.points))
      .join("");
  roadPaths = { express: byKind("express"), main: byKind("main"), minor: byKind("minor"), bridges: ROADS.filter((road) => road.bridge !== undefined).map((road) => ({ id: road.bridge ?? "", d: curve(road.points) })) };
  return roadPaths;
}

type Box = readonly [number, number, number, number];
const meets = (a: Box, b: Box): boolean => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

/** The squares laid so far that a view shows, and how many were laid when the view first stood, so the ones laid after it fade in. */
function useSquares(id: string, within: Box | null, weight: number, active: boolean): { shown: Square[]; since: number; fresh: (key: string) => boolean } {
  const job = lagosAerial();
  const squares = useSyncExternalStore(job.subscribe, job.squares, job.squares);
  const [since] = useState(() => job.squares().size);
  const [x0, y0, x1, y1] = within ?? [-Infinity, -Infinity, Infinity, Infinity];
  useEffect(() => {
    if (!active) return undefined;
    job.want(id, { box: [x0, y0, x1, y1], weight });
    return () => job.unwant(id);
  }, [job, id, x0, y0, x1, y1, weight, active]);
  const shown = active ? [...squares.values()].filter((square) => within === null || meets(square.box, within)) : [];
  return { shown, since, fresh: (key) => job.laidAt(key) > since };
}

/** One square's roofs: the lit edge from the same paths, then the roofs by colour, then the windows the night lights. */
const Roofs = memo(function Roofs({ square, uid, lit, fresh }: { square: Square; uid: string; lit: boolean; fresh: boolean }) {
  const id = (kind: number): string => `${uid}-r${n(square.sx)}x${n(square.sy)}-${n(kind)}`;
  return (
    <g className={fresh ? "aerial-sq fresh" : "aerial-sq"} data-square={square.key}>
      {lit ? (
        <g className="roof-lit" transform="translate(-0.4 -0.45)">
          {square.roofs.map((roofs, kind) => (roofs === "" ? null : <use key={kind} href={`#${id(kind)}`} />))}
        </g>
      ) : null}
      {square.roofs.map((roofs, kind) =>
        roofs === "" ? null : (
          <g key={kind} className={`roof-${ROOF_KINDS[kind] ?? "rust"}`}>
            <path id={id(kind)} d={roofs} />
          </g>
        ),
      )}
      {square.windows === "" ? null : <path d={square.windows} className="lit" />}
    </g>
  );
});

export interface AerialSvgProps extends PaperSvgProps {
  /** How much this view's squares matter: the card in front and the open map before the cards beside. */
  weight?: number;
}

/** Lagos's paper from the air. Memoised as PaperSvg is: its drawing changes with its variant, its route and the squares laid. */
export const AerialSvg = memo(function AerialSvg({ variant, route = null, uid, within = null, labels = null, weight = 1 }: AerialSvgProps) {
  const city = usePaperCity();
  const { paper } = city;
  const d = outlineOf(city.draw);
  const roads = roadsOf();
  const whole = variant !== "folded";
  const { shown, fresh } = useSquares(uid, within, weight, whole);
  // The lit edge is a hair across; on a card it shows as a rim on every roof, on the open map it would be lost in a pixel.
  const lit = variant === "card";
  return (
    <svg
      className={`paper-svg aerial paper-${variant}`}
      style={{ left: -BLEED, top: -BLEED }}
      width={paper.width + BLEED * 2}
      height={paper.height + BLEED * 2}
      viewBox={`${n(-BLEED)} ${n(-BLEED)} ${n(paper.width + BLEED * 2)} ${n(paper.height + BLEED * 2)}`}
      aria-hidden
      data-paper-svg={variant}
      data-aerial={shown.length}
    >
      <rect x={-2000} y={-2000} width={paper.width + 4000} height={paper.height + 4000} className="water" />
      {city.seaFrom === null ? null : <rect x={-2000} y={city.seaFrom} width={paper.width + 4000} height={2000} className="sea" />}
      {whole ? shown.map((square) => (square.waves === "" ? null : <path key={square.key} d={square.waves} className={fresh(square.key) ? "wave fresh" : "wave"} />)) : null}
      {whole && d.beach !== "" ? <path d={d.beach} className="beach" /> : null}
      <path d={d.land} className="land" />
      {whole ? city.parks.map(([x, y, rx, ry], index) => <ellipse key={index} cx={x} cy={y} rx={rx} ry={ry} className="park" />) : null}
      {whole ? (
        <g className="roofs">
          {shown.map((square) => (
            <Roofs key={square.key} square={square} uid={uid} lit={lit} fresh={fresh(square.key)} />
          ))}
        </g>
      ) : null}
      {whole ? (
        <g className="streets">
          {shown.map((square) => (square.lanes === "" ? null : <path key={square.key} d={square.lanes} className={fresh(square.key) ? "lane fresh" : "lane"} />))}
          <path d={roads.minor} className="st-edge minor" />
          <path d={roads.minor} className="st minor" />
        </g>
      ) : null}
      <path d={roads.main} className="st-edge main" />
      <path d={roads.main} className="st main" />
      <path d={roads.express} className="st-edge express" />
      <path d={roads.express} className="st express" />
      {roads.bridges.map((bridge) => (
        <g key={bridge.id} className="bridge" data-bridge={bridge.id}>
          {whole ? <path d={bridge.d} className="bridge-shadow" /> : null}
          {whole ? <path d={bridge.d} className="bridge-piers" /> : null}
          <path d={bridge.d} className="bridge-edge" />
          <path d={bridge.d} className="bridge-deck" />
          <path d={bridge.d} className="bridge-lamps" />
        </g>
      ))}
      {whole ? (
        <g className="deco">
          {city.under(uid, d)}
          {city.waterLabels.map((label) => (
            <text key={label.key} className="water-name" x={label.at[0]} y={label.at[1]} transform={`rotate(${n(label.tilt)} ${n(label.at[0])} ${n(label.at[1])})`} style={{ "--s": label.size } as CSSProperties}>
              {city.words(label.key)}
            </text>
          ))}
          {city.over(d)}
          {city.labels
            .filter((label) => labels === null || labels.has(label.key))
            .map((label) => (
              <text key={label.key} className="district" x={label.at[0]} y={label.at[1]} transform={`rotate(${n(label.tilt)} ${n(label.at[0])} ${n(label.at[1])})`} style={{ "--s": label.size } as CSSProperties} data-district={label.key}>
                {city.words(label.key)}
              </text>
            ))}
        </g>
      ) : null}
      {route === null ? null : (
        <g data-route-line>
          <path d={route} className="route-edge" />
          <path d={route} className="route" />
        </g>
      )}
    </svg>
  );
});

/** How wide a street's name of this many letters stands on the screen at 12 px in the heavier weight, in pixels. */
const nameWidth = (letters: number): number => letters * 7.3 + 12;

/** A sticker the names keep clear of: its point on the paper and its size on the screen, in pixels. */
export interface Keep {
  at: readonly [number, number];
  px: number;
}

/** Whether a name's stretch lies whole inside the part of the paper seen and clear of every sticker and its name. */
function fitsName(points: readonly (readonly [number, number])[], z: number, within: Box | null, keeps: readonly Keep[]): boolean {
  const tall = 9 / z;
  return points.every(([x, y]) => {
    // A card's `within` is the part seen with twenty units drawn round it.
    const edge = 20 + 8 / z;
    if (within !== null && (x - tall < within[0] + edge || x + tall > within[2] - edge || y - tall < within[1] + edge || y + tall > within[3] - edge)) return false;
    return keeps.every(({ at, px }) => {
      // The sticker stands mostly above its point, its name pill below it: one circle round both.
      const radius = (px * 0.62 + 16) / z + tall;
      const dx = x - at[0];
      const dy = y - (at[1] - (px * 0.05) / z);
      return dx * dx + dy * dy >= radius * radius;
    });
  });
}

const line = (points: readonly (readonly [number, number])[]): string => `M${points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L")}`;

/**
 * The street names, a layer of their own over the paper and under the stickers: each set along its road at 12 px on
 * the screen whatever the zoom, bending with it, and shown only where the road runs long enough on the screen to hold
 * it, whole on the part seen and clear of the stickers, moved a little along its road to find such a place.
 */
export const StreetNames = memo(function StreetNames({ uid, z, within = null, keeps = [] }: { uid: string; z: number; within?: Box | null; keeps?: readonly Keep[] }) {
  const { paper } = usePaperCity();
  const names = STREET_NAMES.flatMap((name) => {
    const words = mapWords(name.key);
    const width = nameWidth(words.length);
    for (const shift of shiftsOf(name)) {
      const points = nameStretch(name, name.at + shift, width / 2 / z + 4 / z);
      if (points !== null && fitsName(points, z, within, keeps)) return [{ key: name.key, words, d: line(points) }];
    }
    return [];
  });
  return (
    <svg className="paper-svg street-names" style={{ left: -BLEED, top: -BLEED }} width={paper.width + BLEED * 2} height={paper.height + BLEED * 2} viewBox={`${n(-BLEED)} ${n(-BLEED)} ${n(paper.width + BLEED * 2)} ${n(paper.height + BLEED * 2)}`} aria-hidden>
      {names.map((name) => (
        <g key={name.key} data-street-name={name.key}>
          <path id={`${uid}-${name.key}`} d={name.d} fill="none" />
          {/* The halo is a text of its own under the letters: along a curve each letter is drawn alone, and its own halo would cover the one before. */}
          <text className="street-name halo" dy="0.35em" aria-hidden>
            <textPath href={`#${uid}-${name.key}`} startOffset="50%">
              {name.words}
            </textPath>
          </text>
          <text className="street-name" dy="0.35em">
            <textPath href={`#${uid}-${name.key}`} startOffset="50%">
              {name.words}
            </textPath>
          </text>
        </g>
      ))}
    </svg>
  );
});
