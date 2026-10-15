// The two lights (docs/rules/account.md R-ACCOUNT-031), as the design draws them:
// one bulb for the lives at home, one for the lives abroad, on one wire hanging from the top edge over the scene. Each
// glows with its share; sparks run along the wire toward abroad, and now and then one comes back. Home never goes
// dark. It is a picture of everyone, never a task: nothing to tap, nothing to switch, no reward, so a line about the
// light is a caption to it, never an errand.
//
// Drawn to stay light on a phone: the wire, the bulbs and the words are one still SVG; the glows and the sparks are
// small layers moved only by transform and opacity, which the browser's compositor runs off the page's own thread.
// The glows breathe slowly, and each flickers as a spark reaches it; there is no render loop. Reduced motion holds
// everything still and draws no sparks (world.md R-WORLD-023). The caption under the counts is 12 px where the design has
// 11, as text.md R-TEXT-008 asks of a line that is not a label over a value.
import { useEffect, useRef, useState } from "react";

import { formatNumber } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { type LightsShown, sharesOf } from "./lights";

/** The stage, in the design's own units: one pixel each, never scaled; a phone narrower than it trims the empty sides. */
const W = 380;
const H = 230;

/** The wire between the two bulbs, a quadratic curve as designed. */
const FROM = { x: 118, y: 108 };
const BEND = { x: 190, y: 168 };
const TO = { x: 262, y: 128 };
const WIRE = `M${String(FROM.x)} ${String(FROM.y)} Q${String(BEND.x)} ${String(BEND.y)} ${String(TO.x)} ${String(TO.y)}`;

const HOME = { x: 110, y: 112 };
/** The caption under the counts, where the design has it. */
const CAPTION_Y = 214;
const ABROAD = { x: 270, y: 132 };

/** The design's timing: three sparks out, 3.6 s each, 1.2 s apart; one back, 7 s, from 0.6 s. */
const OUT_MS = 3_600;
const OUT_EVERY_MS = 1_200;
const BACK_MS = 7_000;
const BACK_FROM_MS = 600;
const BREATH_MS = 5_200;

/** The widest glow: the design's 34 plus 40 at a full share. */
const GLOW_MAX = 74;

const BP = 10_000;

/** Points along the wire at equal lengths, so a spark keeps one speed as the design's paced motion does. */
function alongWire(steps: number): { x: number; y: number }[] {
  const fine = 240;
  const at = (t: number) => ({
    x: (1 - t) * (1 - t) * FROM.x + 2 * (1 - t) * t * BEND.x + t * t * TO.x,
    y: (1 - t) * (1 - t) * FROM.y + 2 * (1 - t) * t * BEND.y + t * t * TO.y,
  });
  const points = Array.from({ length: fine + 1 }, (_, i) => at(i / fine));
  const lengths = [0];
  for (let i = 1; i < points.length; i += 1) lengths.push(lengths[i - 1]! + Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y));
  const total = lengths[lengths.length - 1]!;
  const out: { x: number; y: number }[] = [];
  let j = 0;
  for (let s = 0; s <= steps; s += 1) {
    const want = (total * s) / steps;
    while (j < lengths.length - 1 && lengths[j + 1]! < want) j += 1;
    const span = (lengths[j + 1] ?? want) - lengths[j]!;
    const f = span <= 0 ? 0 : (want - lengths[j]!) / span;
    const a = points[j]!;
    const b = points[Math.min(j + 1, points.length - 1)]!;
    out.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
  }
  return out;
}

const PATH = alongWire(24);

function sparkFrames(back: boolean, r: number): Keyframe[] {
  const points = back ? [...PATH].reverse() : PATH;
  return points.map((p) => ({ transform: `translate(${(p.x - r).toFixed(2)}px, ${(p.y - r).toFixed(2)}px)` }));
}

/** About how much of its light a glow holds at rest: the flicker's rest times the middle of the breath. */
const REST = 0.86 * 0.95;

/** A glow's flicker: bright as a spark reaches it, back to its resting light within the first third. */
const FLICKER: Keyframe[] = [
  { opacity: 1, transform: "scale(1.07)", offset: 0 },
  { opacity: 0.86, transform: "scale(1)", offset: 0.3 },
  { opacity: 0.86, transform: "scale(1)", offset: 1 },
];
const BREATHE: Keyframe[] = [
  { opacity: 0.9, transform: "scale(0.97)" },
  { opacity: 1, transform: "scale(1.03)" },
];

export function stillWanted(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The design's glow for a share: brighter and wider as the share grows, never out. */
function glowOf(shareBp: number): { alpha: number; radius: number; glass: number } {
  const share = shareBp / BP;
  return { alpha: 0.3 + 0.7 * share, radius: 34 + 40 * share, glass: 0.55 + 0.45 * share };
}

/**
 * The glow's light, as designed: a warm radial fall-off from the bulb, `alpha` at its heart. The one fill every
 * light glows with: the two lights here and the dedication's lights (R-ACCOUNT-032, R-ACCOUNT-033), so the game keeps
 * its one glow.
 */
export function glowFill(alpha: number): string {
  return `radial-gradient(circle closest-side, rgba(255, 246, 214, ${alpha.toFixed(3)}) 0%, rgba(255, 211, 110, ${(alpha * 0.55).toFixed(3)}) 35%, rgba(255, 179, 71, 0) 100%)`;
}

/** A glow layer: placed, sized by transform to its share, breathing, flickering; each layer moves one thing. */
function Glow({ at, shareBp, name, refs }: { at: { x: number; y: number }; shareBp: number; name: string; refs: { breathe: (node: HTMLDivElement | null) => void; flicker: (node: HTMLDivElement | null) => void } }) {
  const { radius } = glowOf(shareBp);
  // The layers rest at about REST of their light between flickers, so the gradient is that much brighter: at rest the
  // glow is the design's, and a flicker lifts it above.
  const alpha = Math.min(1, glowOf(shareBp).alpha / REST);
  const size = 2 * GLOW_MAX;
  const fill = glowFill(alpha);
  return (
    <div className="absolute" style={{ left: at.x - GLOW_MAX, top: at.y - GLOW_MAX, width: size, height: size }} data-light-glow={name}>
      <div className="h-full w-full transition-transform duration-700 ease-out" style={{ transform: `scale(${(radius / GLOW_MAX).toFixed(3)})` }} data-glow-share={shareBp}>
        <div ref={refs.breathe} className="h-full w-full">
          <div ref={refs.flicker} className="h-full w-full" style={{ background: fill, opacity: 0.86 }} />
        </div>
      </div>
    </div>
  );
}

/** A spark, drawn as designed: a small circle of the picture, carried along the wire by its layer. */
function Spark({ r, fill }: { r: number; fill: string }) {
  return (
    <svg width={2 * r} height={2 * r} className="block">
      <circle cx={r} cy={r} r={r} fill={fill} />
    </svg>
  );
}

function Bulb({ at, shareBp }: { at: { x: number; y: number }; shareBp: number }) {
  const { x, y } = at;
  const { glass } = glowOf(shareBp);
  return (
    <g>
      <rect x={x - 6} y={y - 26} width="12" height="11" rx="2" fill="#3a3a3a" />
      <path d={`M${String(x - 6)} ${String(y - 22)}h12M${String(x - 6)} ${String(y - 18.5)}h12`} stroke="#6a6a6a" strokeWidth="1" />
      <circle cx={x} cy={y} r="14" fill="#fff3c4" fillOpacity={glass.toFixed(3)} stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1" />
      <path d={`M${String(x - 4)} ${String(y + 3)}q4 -9 8 0`} fill="none" stroke="#c98a1a" strokeWidth="1.4" />
    </g>
  );
}

/** Hanging over the start screen's scene, from the top edge. */
export function TwoLights({ shown }: { shown: LightsShown }) {
  const { homeBp, abroadBp } = sharesOf(shown);
  const counted = shown.from !== "asking";
  const sparks = useRef<(HTMLDivElement | null)[]>([]);
  const layers = useRef<Record<string, HTMLDivElement | null>>({});
  const [still] = useState(stillWanted);

  useEffect(() => {
    if (still) return;
    const running: Animation[] = [];
    const run = (node: HTMLDivElement | null | undefined, frames: Keyframe[], options: KeyframeAnimationOptions) => {
      if (node === null || node === undefined || typeof node.animate !== "function") return;
      running.push(node.animate(frames, { iterations: Infinity, easing: "linear", ...options }));
    };
    // The design's sparks: three out, 1.2 s apart, and one back. Each waits at its start, under the home bulb's glass.
    for (let i = 0; i < 3; i += 1) run(sparks.current[i], sparkFrames(false, 2.6), { duration: OUT_MS, delay: i * OUT_EVERY_MS, fill: "backwards" });
    run(sparks.current[3], sparkFrames(true, 2.4), { duration: BACK_MS, delay: BACK_FROM_MS, fill: "backwards" });
    // Better than the design: the glows breathe out of step, and each flickers as a spark reaches it, on the same clock.
    run(layers.current["home-breathe"], BREATHE, { duration: BREATH_MS, direction: "alternate", easing: "ease-in-out" });
    run(layers.current["abroad-breathe"], BREATHE, { duration: BREATH_MS, direction: "alternate", easing: "ease-in-out", delay: -BREATH_MS / 2 });
    run(layers.current["abroad-flicker"], FLICKER, { duration: OUT_EVERY_MS, delay: OUT_MS, easing: "ease-out" });
    run(layers.current["home-flicker"], FLICKER, { duration: BACK_MS, delay: BACK_FROM_MS + BACK_MS, easing: "ease-out" });
    // One clock for all, so a flicker lands with its spark.
    if (running.length === 0) return;
    const start = (document.timeline as DocumentTimeline | undefined)?.currentTime ?? null;
    if (start !== null) for (const each of running) each.startTime = start;
    return () => {
      for (const each of running) each.cancel();
    };
  }, [still]);

  const refsFor = (name: string) => ({
    breathe: (node: HTMLDivElement | null) => {
      layers.current[`${name}-breathe`] = node;
    },
    flicker: (node: HTMLDivElement | null) => {
      layers.current[`${name}-flicker`] = node;
    },
  });
  const label = counted ? say("ui.lights.said", { home: formatNumber(shown.home), abroad: formatNumber(shown.abroad) }) : say("ui.lights.unsaid");
  const upper = (key: string) => say(key).toLocaleUpperCase("en-NG");

  return (
    <div className="pointer-events-none relative h-[230px] w-full overflow-hidden" data-two-lights={shown.from} role="img" aria-label={label}>
      {/* Dusk over the top of the scene, edge to edge, so the two glows read in daylight. */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, rgba(11, 16, 36, 0.72) 0%, rgba(11, 16, 36, 0.35) 70%, rgba(11, 16, 36, 0) 100%)" }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2" style={{ width: W, height: H }} aria-hidden>
        <svg className="absolute inset-0" width={W} height={H} viewBox={`0 0 ${String(W)} ${String(H)}`}>
          <path d="M110 0V86" stroke="#c9c2b2" strokeOpacity="0.7" strokeWidth="1.6" />
          <path d="M270 0V106" stroke="#c9c2b2" strokeOpacity="0.7" strokeWidth="1.6" />
          <path d={WIRE} fill="none" stroke="#c9c2b2" strokeOpacity="0.7" strokeWidth="1.4" />
        </svg>
        {(still ? [] : [0, 1, 2]).map((i) => (
          <div
            key={i}
            ref={(node) => {
              sparks.current[i] = node;
            }}
            className="absolute top-0 left-0"
            style={{ transform: `translate(${String(FROM.x - 2.6)}px, ${String(FROM.y - 2.6)}px)` }}
            data-light-spark="out"
          >
            <Spark r={2.6} fill="#ffe9a8" />
          </div>
        ))}
        {/* Now and then, one comes back. */}
        {still ? null : (
        <div
          ref={(node) => {
            sparks.current[3] = node;
          }}
          className="absolute top-0 left-0"
          style={{ transform: `translate(${String(TO.x - 2.4)}px, ${String(TO.y - 2.4)}px)` }}
          data-light-spark="back"
        >
          <Spark r={2.4} fill="#ffffff" />
        </div>
        )}
        <Glow at={HOME} shareBp={homeBp} name="home" refs={refsFor("home")} />
        <Glow at={ABROAD} shareBp={abroadBp} name="abroad" refs={refsFor("abroad")} />
        <svg className="absolute inset-0" width={W} height={H} viewBox={`0 0 ${String(W)} ${String(H)}`}>
          <Bulb at={HOME} shareBp={homeBp} />
          <Bulb at={ABROAD} shareBp={abroadBp} />
          <g fontFamily="system-ui, sans-serif" textAnchor="middle" fill="#ffffff" style={{ paintOrder: "stroke" }} stroke="rgba(0,0,0,0.45)" strokeWidth="3">
            <text x="110" y="148" fontSize="11" fontWeight="800" letterSpacing="1.5">
              {upper("ui.lights.home")}
            </text>
            <text x="270" y="168" fontSize="11" fontWeight="800" letterSpacing="1.5">
              {upper("ui.lights.abroad")}
            </text>
            {counted ? (
              <g className="fade" data-light-counts>
                <text x="110" y="166" fontSize="15" fontWeight="800">
                  {formatNumber(shown.home)}
                </text>
                <text x="270" y="186" fontSize="15" fontWeight="800">
                  {formatNumber(shown.abroad)}
                </text>
              </g>
            ) : null}
            {shown.from === "server" ? (
              <text x="190" y={CAPTION_Y} fontSize="12" fontWeight="700" opacity="0.85" className="fade">
                {say("ui.lights.everyone")}
              </text>
            ) : null}
          </g>
        </svg>
      </div>
    </div>
  );
}
