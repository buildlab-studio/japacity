// The painted map itself (world:map-is-painted-lagos, world:painted-maps-abroad): one SVG of the paper, drawn the same in every
// view. The strip draws it folded (the land, the water, the main roads and the bridges, every line its own width however
// flat the fold); the open map and the cards draw it whole, the cards with a closer grain of houses. The paint's colours
// come from the role tokens in paper.css, so the night paint darkens the paper by itself. The city drawn is the one the
// map is handed (lagos.tsx's context): Lagos, or London abroad.
import type { CSSProperties } from "react";
import { memo } from "react";

import { drawingOf } from "./draw";
import { usePaperCity } from "./lagos";

export type Variant = "folded" | "open" | "card";

/** The paper runs on past its own edges by this much, so a view panned or zoomed out never sees where it stops. */
const BLEED = 500;

const n = String;

export interface PaperSvgProps {
  variant: Variant;
  /** The route's path data, when one is drawn in this view. */
  route?: string | null;
  /** A unique prefix for this view's ids (the bridge's name runs along a path of its own). */
  uid: string;
  /** The part of the paper this view shows, [x0, y0, x1, y1]: the grain outside it is not drawn. All of it when absent. */
  within?: readonly [number, number, number, number] | null;
  /** The district names this view paints, by key; all of them when absent (a card leaves off the ones it would cut). */
  labels?: ReadonlySet<string> | null;
}

/** The paper, one SVG. Memoised: a view's drawing changes only with its variant and its route. */
export const PaperSvg = memo(function PaperSvg({ variant, route = null, uid, within = null, labels = null }: PaperSvgProps) {
  const city = usePaperCity();
  const { paper } = city;
  const d = drawingOf(city.draw);
  const whole = variant !== "folded";
  const cells = within === null ? d.cells : d.cells.filter(({ box }) => box[0] < within[2] && box[2] > within[0] && box[1] < within[3] && box[3] > within[1]);
  const grain = (which: (typeof d.cells)[number]["wide"], key: string) => (
    <g key={key} className="grain">
      <path d={which.trees} className="tree" />
      <path d={which.treeLights} className="tree-light" />
      <path d={which.walls} className="wall" />
      {which.roofs.map((roofs, index) => (
        <path key={index} d={roofs} className={`roof roof-${n(index)}`} />
      ))}
      <path d={which.windows} className="window" />
    </g>
  );
  return (
    <svg
      className={`paper-svg paper-${variant}`}
      style={{ left: -BLEED, top: -BLEED }}
      width={paper.width + BLEED * 2}
      height={paper.height + BLEED * 2}
      viewBox={`${n(-BLEED)} ${n(-BLEED)} ${n(paper.width + BLEED * 2)} ${n(paper.height + BLEED * 2)}`}
      aria-hidden
      data-paper-svg={variant}
    >
      <rect x={-2000} y={-2000} width={paper.width + 4000} height={paper.height + 4000} className="water" />
      {city.seaFrom === null ? null : <rect x={-2000} y={city.seaFrom} width={paper.width + 4000} height={2000} className="sea" />}
      {whole ? cells.map((cell) => (cell.waves === "" ? null : <path key={cell.box.join()} d={cell.waves} className="wave" />)) : null}
      {whole && d.beach !== "" ? <path d={d.beach} className="beach" /> : null}
      <path d={d.coast} className="glow" />
      <path d={d.land} className="land" />
      {whole ? city.parks.map(([x, y, rx, ry], index) => <ellipse key={index} cx={x} cy={y} rx={rx} ry={ry} className="park" />) : null}
      {whole ? cells.map((cell) => grain(cell.wide, `wide-${cell.box.join()}`)) : null}
      {variant === "card" ? cells.map((cell) => grain(cell.close, `close-${cell.box.join()}`)) : null}
      {whole ? <path d={d.roadsMinor} className="road-edge minor" /> : null}
      <path d={d.roadsMain} className="road-edge main" />
      {whole ? <path d={d.roadsMinor} className="road minor" /> : null}
      <path d={d.roadsMain} className="road main" />
      {d.rails === "" ? null : (
        <g className="rail" data-rail>
          <path d={d.rails} className="rail-edge" />
          <path d={d.rails} className="rail-ties" />
        </g>
      )}
      {d.bridges.map((bridge) => (
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
