// Shots the round's directions share: a title card on the sky, a wide shot of the world, the painted map with the plane
// leaving over the lagoon, and the end card with the seal, the name and "Play it".
import type { ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

import type { ClipName } from "../clips";
import { Seal, Wordmark } from "../parts/brand";
import { Clip, Plane, PressButton, Title } from "../parts/dress";
import { land, pop, ramp } from "../parts/motion";
import { CREAM, DAY, FONT, NAVY, NIGHT, type Paint } from "../parts/tokens";

/** A title card: big words on the sky, by day or at night. */
export function TitleCard({ words, paint = DAY, size = 176, kicker }: { words: string; paint?: Paint; size?: number; kicker?: ReactNode }) {
  return (
    <AbsoluteFill style={{ background: paint.sky, alignItems: "center", justifyContent: "center", gap: 36 }}>
      <Title words={words} size={size} color={paint.ink} delay={2} />
      {kicker}
    </AbsoluteFill>
  );
}

/** A wide shot of the world alone, eased a little closer while it rolls, as a camera would. */
export function WideShot({ clip, from = 0, push = 0.06, drift = 0 }: { clip: ClipName; from?: number; push?: number; drift?: number }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = ramp(frame, 0, durationInFrames);
  return (
    <AbsoluteFill style={{ background: NAVY, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${String(1 + push * t)}) translateX(${String(drift * t)}px)` }}>
        <Clip name={clip} from={from} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** The painted map, by day or at night, pushed in slowly toward a point (fractions of the picture). */
export function MapShot({ paint, zoom = [1.05, 1.25], toward = [0.5, 0.5] }: { paint: "day" | "night"; zoom?: readonly [number, number]; toward?: readonly [number, number] }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = land(frame, 30, 0, durationInFrames);
  const scale = interpolate(t, [0, 1], zoom);
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: paint === "day" ? "#f6efdf" : NIGHT.sky }}>
      <Img src={staticFile(`clips/map-${paint}.png`)} style={{ width: "100%", height: "100%", objectFit: "cover", transformOrigin: `${String(toward[0] * 100)}% ${String(toward[1] * 100)}%`, transform: `scale(${String(scale)})` }} />
    </AbsoluteFill>
  );
}

/** The plane leaving: it climbs from the city across the lagoon and off the edge, a dashed line behind it. */
export function PlaneOver({ paint }: { paint: "day" | "night" }) {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  const t = ramp(frame, 4, durationInFrames - 2);
  const eased = t * t * (3 - 2 * t);
  const start = { x: width * 0.3, y: height * 0.82 };
  const end = { x: width * 1.08, y: height * 0.08 };
  const x = interpolate(eased, [0, 1], [start.x, end.x]);
  const y = interpolate(eased, [0, 1], [start.y, end.y]) - Math.sin(eased * Math.PI) * 60;
  const angle = (Math.atan2(end.y - start.y - 60, end.x - start.x) * 180) / Math.PI;
  const size = interpolate(eased, [0, 1], [130, 260]);
  const ink = paint === "day" ? NAVY : CREAM;
  return (
    <AbsoluteFill>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <path d={`M${String(start.x)} ${String(start.y)} L${String(x)} ${String(y)}`} stroke={ink} strokeWidth={7} strokeDasharray="22 18" strokeLinecap="round" fill="none" opacity={0.75} />
      </svg>
      <div style={{ position: "absolute", left: x - size / 2, top: y - size * 0.3, transform: `rotate(${String(angle)}deg)`, filter: "drop-shadow(0 18px 12px rgba(13, 17, 36, 0.3))" }}>
        <Plane size={size} color={ink} />
      </div>
    </AbsoluteFill>
  );
}

/** The end card: the seal springs in with its bulbs lit, the name beside it, the address and "Play it". */
export function EndCard({ paint = DAY, glowFrom = 0 }: { paint?: Paint; glowFrom?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seal = pop(frame, fps, 0);
  const name = land(frame, fps, 5);
  const button = pop(frame, fps, 12);
  const glow = ramp(frame, glowFrom, glowFrom + 14, 0, 0.85);
  return (
    <AbsoluteFill style={{ background: paint.sky, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
        <div style={{ transform: `scale(${String(seal)}) rotate(${String((1 - seal) * -40)}deg)` }}>
          <Seal size={300} glow={glow} id="end" />
        </div>
        <div style={{ transform: `translateX(${String((1 - name) * 60)}px)`, opacity: name }}>
          <Wordmark height={190} color={paint.ink} />
        </div>
      </div>
      <div style={{ marginTop: 80, display: "flex", alignItems: "center", gap: 44, transform: `scale(${String(button)})` }}>
        <PressButton size={60}>Play it</PressButton>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 56, color: paint.ink }}>japacity.app</div>
      </div>
    </AbsoluteFill>
  );
}
