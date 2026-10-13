// The painted map itself (docs/rules/world.md R-WORLD-015): one SVG of the paper, drawn the same in every view. The
// strip draws it folded (the land, the water, the main roads and the bridges, every line its own width however flat the
// fold); the open map and the cards draw it whole, the cards with a closer grain of houses. The paint's colours come
// from the role tokens in paper.css, so the night paint darkens the paper by itself.
import type { CSSProperties } from "react";
import { memo } from "react";

import { mapWords } from "../map.words";
import { PAPER, type Point } from "./fit";
import { drawing } from "./draw";
import { LABELS, LANDMARKS, PARKS, SEA_FROM, WATER_LABELS } from "./geometry";

export type Variant = "folded" | "open" | "card";

/** The paper runs on past its own edges by this much, so a view panned or zoomed out never sees where it stops. */
export const BLEED = 500;

const n = String;

/** The landmarks, each a small drawing at three fifths of the round's size: the theatre's hat, the towers, the toll gate. */
export function Theatre({ at: [x, y] }: { at: Point }) {
  return (
    <g transform={`translate(${n(x)},${n(y)}) scale(0.6)`} className="lm">
      <ellipse cx="0" cy="8" rx="30" ry="10" className="lm-park" />
      <ellipse cx="0" cy="4" rx="25" ry="8" fill="#E9EEF2" className="lm-edge" />
      <path d="M -17,3 C -18,-10 -9,-17 0,-17 C 9,-17 18,-10 17,3 Z" fill="#F8F9FA" className="lm-edge" />
      <path d="M -17,-1 C -6,3 6,3 17,-1" fill="none" stroke="#6B4E3D" strokeWidth="3" />
      <path d="M -10,-12 L -11,1 M -4,-16 L -4,2 M 3,-16 L 3,2 M 10,-12 L 11,1" stroke="#9AA6B2" strokeWidth="1" />
      <path d="M -6,-17 C -2,-21 2,-21 6,-17" fill="#6B4E3D" className="lm-edge" />
    </g>
  );
}

export function Towers({ at: [x, y], size = 60 }: { at: Point; size?: number }) {
  return (
    <g transform={`translate(${n(x)},${n(y)}) scale(${n(size / 100)})`} className="lm">
      <rect x="-22" y="-30" width="14" height="40" rx="1.5" fill="#9FCBE3" className="lm-edge" />
      <rect x="-7" y="-46" width="15" height="56" rx="1.5" fill="#EEF3F7" className="lm-edge" />
      <path d="M -7,-46 L 0.5,-54 L 8,-46" fill="#5FA8A0" className="lm-edge" />
      <rect x="9" y="-24" width="14" height="34" rx="1.5" fill="#7FB8A8" className="lm-edge" />
      <g className="lm-win">
        <path d="M -19,-24 h8 M -19,-17 h8 M -19,-10 h8 M -19,-3 h8" />
        <path d="M -4,-38 h9 M -4,-30 h9 M -4,-22 h9 M -4,-14 h9 M -4,-6 h9" />
        <path d="M 12,-18 h8 M 12,-11 h8 M 12,-4 h8" />
      </g>
    </g>
  );
}

export function Tower({ at: [x, y] }: { at: Point }) {
  return (
    <g transform={`translate(${n(x)},${n(y)}) scale(0.55)`} className="lm">
      <rect x="-11" y="-40" width="22" height="48" rx="2" fill="#A9D7EE" className="lm-edge" />
      <path d="M -11,-40 L 11,-48 L 11,-40 Z" fill="#7DB9DA" className="lm-edge" />
      <g className="lm-win">
        <path d="M -7,-32 h14 M -7,-25 h14 M -7,-18 h14 M -7,-11 h14 M -7,-4 h14" />
      </g>
      <rect x="-5" y="1" width="10" height="7" fill="#1B2A4A" />
    </g>
  );
}

function Toll({ at: [x, y] }: { at: Point }) {
  return (
    <g transform={`translate(${n(x)},${n(y)}) scale(0.55)`} className="lm">
      <path d="M -34,-4 Q 0,-26 34,-4 L 34,0 Q 0,-20 -34,0 Z" fill="#FFFFFF" className="lm-edge" />
      <path d="M -26,-6 L -26,8 M 26,-6 L 26,8 M -9,-14 L -9,8 M 9,-14 L 9,8" stroke="#1B2A4A" strokeWidth="2.4" />
      <rect x="-20" y="1" width="7" height="7" rx="1" fill="#3D7CC9" className="lm-edge" />
      <rect x="-3.5" y="1" width="7" height="7" rx="1" fill="#3D7CC9" className="lm-edge" />
      <rect x="13" y="1" width="7" height="7" rx="1" fill="#3D7CC9" className="lm-edge" />
      <circle cx="-16" cy="-6" r="1.8" fill="#2DBE6C" />
      <circle cx="0" cy="-10" r="1.8" fill="#2DBE6C" />
      <circle cx="16" cy="-6" r="1.8" fill="#E5484D" />
    </g>
  );
}

function Pylon({ at: [x, y] }: { at: Point }) {
  return (
    <g transform={`translate(${n(x)},${n(y)}) scale(0.6)`} className="lm">
      <path d="M 0,-26 L 0,4" stroke="#F2F4F7" strokeWidth="4" />
      <path d="M 0,-26 L 0,4" stroke="#1B2A4A" strokeWidth="1" fill="none" />
      <path d="M 0,-24 L -16,-12 M 0,-24 L -10,-14 M 0,-24 L 16,12 M 0,-24 L 10,8 M 0,-20 L -19,-17 M 0,-20 L 20,15" stroke="#1B2A4A" strokeWidth=".7" />
    </g>
  );
}

function Ferry({ at: [x, y] }: { at: Point }) {
  return (
    <g transform={`translate(${n(x)},${n(y)}) rotate(-22) scale(0.55)`} className="lm boat">
      <path d="M -22,0 L 20,0 L 14,8 L -18,8 Z" fill="#FFFFFF" className="lm-edge" />
      <rect x="-12" y="-8" width="20" height="8" rx="2" fill="#F6B800" className="lm-edge" />
      <path d="M -8,-4 h3 M -2,-4 h3 M 4,-4 h3" stroke="#1B2A4A" strokeWidth="1.6" />
      <path d="M -20,3 L 18,3" stroke="#3D7CC9" strokeWidth="2" />
    </g>
  );
}

function Cranes({ at: [x, y] }: { at: Point }) {
  return (
    <g transform={`translate(${n(x - 14)},${n(y)}) scale(0.5)`} className="lm">
      <path d="M 0,10 L 0,-30 L 26,-30 M 0,-22 L 18,-30" fill="none" stroke="#E5484D" strokeWidth="2.5" />
      <path d="M 30,10 L 30,-24 L 52,-24" fill="none" stroke="#E5484D" strokeWidth="2.5" />
      <rect x="-6" y="10" width="14" height="7" fill="#3D7CC9" className="lm-edge" />
      <rect x="8" y="10" width="14" height="7" fill="#F6B800" className="lm-edge" />
      <rect x="22" y="10" width="14" height="7" fill="#2DBE6C" className="lm-edge" />
      <rect x="2" y="3" width="14" height="7" fill="#E5484D" className="lm-edge" />
    </g>
  );
}

export interface PaperSvgProps {
  variant: Variant;
  /** The route's path data, when one is drawn in this view. */
  route?: string | null;
  /** A unique prefix for this view's ids (the bridge's name runs along a path of its own). */
  uid: string;
  /** The part of the paper this view shows, [x0, y0, x1, y1]: the grain outside it is not drawn. All of it when absent. */
  within?: readonly [number, number, number, number] | null;
}

/** The paper, one SVG. Memoised: a view's drawing changes only with its variant and its route. */
export const PaperSvg = memo(function PaperSvg({ variant, route = null, uid, within = null }: PaperSvgProps) {
  const d = drawing();
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
      width={PAPER.width + BLEED * 2}
      height={PAPER.height + BLEED * 2}
      viewBox={`${n(-BLEED)} ${n(-BLEED)} ${n(PAPER.width + BLEED * 2)} ${n(PAPER.height + BLEED * 2)}`}
      aria-hidden
      data-paper-svg={variant}
    >
      <rect x={-2000} y={-2000} width={PAPER.width + 4000} height={PAPER.height + 4000} className="water" />
      <rect x={-2000} y={SEA_FROM} width={PAPER.width + 4000} height={2000} className="sea" />
      {whole ? cells.map((cell) => (cell.waves === "" ? null : <path key={cell.box.join()} d={cell.waves} className="wave" />)) : null}
      {whole ? <path d={d.beach} className="beach" /> : null}
      <path d={d.coast} className="glow" />
      <path d={d.land} className="land" />
      {whole ? PARKS.map(([x, y, rx, ry], index) => <ellipse key={index} cx={x} cy={y} rx={rx} ry={ry} className="park" />) : null}
      {whole ? cells.map((cell) => grain(cell.wide, `wide-${cell.box.join()}`)) : null}
      {variant === "card" ? cells.map((cell) => grain(cell.close, `close-${cell.box.join()}`)) : null}
      {whole ? <path d={d.roadsMinor} className="road-edge minor" /> : null}
      <path d={d.roadsMain} className="road-edge main" />
      {whole ? <path d={d.roadsMinor} className="road minor" /> : null}
      <path d={d.roadsMain} className="road main" />
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
          <path d={d.ferry} className="ferry-line" />
          <path id={`${uid}-tmb`} d={d.bridgeName} fill="none" />
          <text className="bridge-name">
            <textPath href={`#${uid}-tmb`} startOffset="50%">
              {mapWords("map.bridge.third-mainland")}
            </textPath>
          </text>
          {WATER_LABELS.map((label) => (
            <text key={label.key} className="water-name" x={label.at[0]} y={label.at[1]} transform={`rotate(${n(label.tilt)} ${n(label.at[0])} ${n(label.at[1])})`} style={{ "--s": label.size } as CSSProperties}>
              {mapWords(label.key)}
            </text>
          ))}
          <path d={d.palmTrunks} className="palm-trunk" />
          <path d={d.palmFronds} className="palm" />
          <Pylon at={LANDMARKS.pylon} />
          <Theatre at={LANDMARKS.theatre} />
          <Towers at={LANDMARKS.towers} />
          <Towers at={LANDMARKS.towersVi} size={50} />
          <Tower at={LANDMARKS.tower} />
          <Toll at={LANDMARKS.toll} />
          <Ferry at={LANDMARKS.ferry} />
          <Cranes at={LANDMARKS.cranes} />
          {LABELS.map((label) => (
            <text key={label.key} className="district" x={label.at[0]} y={label.at[1]} transform={`rotate(${n(label.tilt)} ${n(label.at[0])} ${n(label.at[1])})`} style={{ "--s": label.size } as CSSProperties} data-district={label.key}>
              {mapWords(label.key)}
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
