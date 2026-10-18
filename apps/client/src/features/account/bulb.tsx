// A warm light of the dedication (account:dedication-page-and-its-doors, account:name-a-light-for-yours): the bulb as the two lights draw
// it, at any size, and its glow. The glow is the two lights' own fill (TwoLights.tsx `glowFill`) on one small layer that
// breathes by opacity alone, about every four seconds, run by the browser's compositor with no render loop; reduced
// motion holds it still (world:motions-under-half-second). Nothing here reads the paint of the hour, so the light never goes out
// at night.
import { useEffect, useRef, useState } from "react";

import { motionReduced } from "../../shared/ui/motion";
import { glowFill } from "./TwoLights";

/** account:dedication-page-and-its-doors: one breath, in or out, about four seconds, as the design's own `breathe` runs. */
const BREATH_MS = 4_000;

/** The breath: from a little under its light to its full light and back; opacity alone. */
const BREATH: Keyframe[] = [{ opacity: 0.78 }, { opacity: 1 }];

/** Where the wire meets a bulb of radius `r` hanging at (x, y): the top of its cap. */
export function capTop(y: number, r: number): number {
  return y - r - capSize(r).h + 1;
}

function capSize(r: number): { w: number; h: number } {
  const w = Math.max(7, Math.round(r * 0.68 * 2) / 2);
  return { w, h: Math.round(w * 0.92 * 2) / 2 };
}

/** The bulb: its cap, the glass and the filament, as the two lights draw theirs, scaled to `r`. Part of a still SVG. */
export function Bulb({ x, y, r }: { x: number; y: number; r: number }) {
  const { w, h } = capSize(r);
  const top = capTop(y, r);
  const f = (n: number) => (Math.round(n * 100) / 100).toString();
  return (
    <g>
      <rect x={f(x - w / 2)} y={f(top)} width={f(w)} height={f(h)} rx={f(w / 6)} fill="#3a3a3a" />
      <path d={`M${f(x - w / 2)} ${f(top + h / 3)}h${f(w)}M${f(x - w / 2)} ${f(top + (2 * h) / 3)}h${f(w)}`} stroke="#6a6a6a" strokeWidth={f(Math.max(0.8, r / 28))} />
      <circle cx={f(x)} cy={f(y)} r={f(r)} fill="#fff3c4" stroke="#ffffff" strokeOpacity="0.7" strokeWidth={f(Math.max(1, r / 26))} />
      <path d={`M${f(x - 0.28 * r)} ${f(y + 0.22 * r)}q${f(0.28 * r)} ${f(-0.6 * r)} ${f(0.56 * r)} 0`} fill="none" stroke="#c98a1a" strokeWidth={f(Math.max(1.2, r / 15))} strokeLinecap="round" />
    </g>
  );
}

/**
 * The glow round a light at (x, y) in its stage, `radius` wide each way: the two lights' fill at `alpha`, breathing.
 * `offsetMs` sets a second light's breath out of step with the first.
 */
export function Glow({ x, y, radius, alpha, offsetMs = 0, name }: { x: number; y: number; radius: number; alpha: number; offsetMs?: number; name: string }) {
  const layer = useRef<HTMLDivElement>(null);
  const [still] = useState(motionReduced);
  useEffect(() => {
    const node = layer.current;
    if (still || node === null || typeof node.animate !== "function") return;
    const breath = node.animate(BREATH, { duration: BREATH_MS, iterations: Infinity, direction: "alternate", easing: "ease-in-out", delay: -offsetMs });
    return () => breath.cancel();
  }, [still, offsetMs]);
  return (
    <div
      ref={layer}
      aria-hidden
      className="pointer-events-none absolute"
      style={{ left: x - radius, top: y - radius, width: 2 * radius, height: 2 * radius, background: glowFill(alpha) }}
      data-dedication-glow={name}
      data-still={still ? "" : undefined}
    />
  );
}
