// Lagos's landmarks drawn as symbols on the painted map (docs/rules/world.md R-WORLD-015): the theatre's hat, the
// island's towers, the tower by the toll gate, the toll gate, the link bridge's pylon, the ferry and the port's cranes.
import type { Point } from "./fit";

const n = String;

/** The landmarks, each a small drawing at three fifths of its full size: the theatre's hat, the towers, the toll gate. */
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

export function Toll({ at: [x, y] }: { at: Point }) {
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

export function Pylon({ at: [x, y] }: { at: Point }) {
  return (
    <g transform={`translate(${n(x)},${n(y)}) scale(0.6)`} className="lm">
      <path d="M 0,-26 L 0,4" stroke="#F2F4F7" strokeWidth="4" />
      <path d="M 0,-26 L 0,4" stroke="#1B2A4A" strokeWidth="1" fill="none" />
      <path d="M 0,-24 L -16,-12 M 0,-24 L -10,-14 M 0,-24 L 16,12 M 0,-24 L 10,8 M 0,-20 L -19,-17 M 0,-20 L 20,15" stroke="#1B2A4A" strokeWidth=".7" />
    </g>
  );
}

export function Ferry({ at: [x, y] }: { at: Point }) {
  return (
    <g transform={`translate(${n(x)},${n(y)}) rotate(-22) scale(0.55)`} className="lm boat">
      <path d="M -22,0 L 20,0 L 14,8 L -18,8 Z" fill="#FFFFFF" className="lm-edge" />
      <rect x="-12" y="-8" width="20" height="8" rx="2" fill="#F6B800" className="lm-edge" />
      <path d="M -8,-4 h3 M -2,-4 h3 M 4,-4 h3" stroke="#1B2A4A" strokeWidth="1.6" />
      <path d="M -20,3 L 18,3" stroke="#3D7CC9" strokeWidth="2" />
    </g>
  );
}

export function Cranes({ at: [x, y] }: { at: Point }) {
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
