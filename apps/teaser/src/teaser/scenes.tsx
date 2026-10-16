// The teaser's shots: a title card on the sky, a wide shot of the world, the painted map pushed in, the night falling over
// the house, the flight to the route's city over the night map, the phone with a results morning, and the end card at
// night with the seal's bulbs lighting, the name and "Play it". The map, the night and the flight also have a portrait
// layout, read from the frame a cut draws them in (parts/frame.ts).
import type { ReactNode } from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

import type { ClipName } from "../clips";
import { Seal, Wordmark } from "../parts/brand";
import { Card, Clip, Phone, Plane, PressButton, Sticker, Title } from "../parts/dress";
import { useFrameShape } from "../parts/frame";
import { land, pop, ramp } from "../parts/motion";
import { CREAM, DAY, FONT, NAVY, NIGHT, type Paint } from "../parts/tokens";

/** A title card: big words on the sky, by day or at night. */
export function TitleCard({ words, paint = DAY, size = 176, kicker }: { words: string; paint?: Paint; size?: number; kicker?: ReactNode }) {
  return (
    <AbsoluteFill style={{ background: paint.sky, alignItems: "center", justifyContent: "center", gap: 36 }}>
      <Title words={words} size={size} color={paint.ink} delay={1} />
      {kicker}
    </AbsoluteFill>
  );
}

/** A wide shot of the world alone, eased a little closer while it rolls, as a camera would. */
export function WideShot({ clip, from = 0, push = 0.06, toward = [0.5, 0.5] }: { clip: ClipName; from?: number; push?: number; toward?: readonly [number, number] }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = ramp(frame, 0, durationInFrames);
  return (
    <AbsoluteFill style={{ background: NAVY, overflow: "hidden" }}>
      <AbsoluteFill style={{ transformOrigin: `${String(toward[0] * 100)}% ${String(toward[1] * 100)}%`, transform: `scale(${String(1 + push * t)})` }}>
        <Clip name={clip} from={from} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/**
 * The painted map, by day or at night, pushed in slowly toward a point (fractions of the picture). In the tall frame the
 * wide still is cut to the frame's shape round the same point, so the push goes where the landscape's goes.
 */
export function MapShot({ paint, zoom = [1.05, 1.25], toward = [0.5, 0.5] }: { paint: "day" | "night"; zoom?: readonly [number, number]; toward?: readonly [number, number] }) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const tall = useFrameShape() === "tall";
  const t = land(frame, fps, 0, durationInFrames);
  const scale = interpolate(t, [0, 1], zoom);
  const point = `${String(toward[0] * 100)}% ${String(toward[1] * 100)}%`;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: paint === "day" ? "#f6efdf" : NIGHT.sky }}>
      <Img src={staticFile(`clips/map-${paint}.png`)} style={{ width: "100%", height: "100%", objectFit: "cover", ...(tall ? { objectPosition: point } : {}), transformOrigin: tall ? "50% 50%" : point, transform: `scale(${String(scale)})` }} />
    </AbsoluteFill>
  );
}

/**
 * The night falling over the family house: the same view by day and at night, the night drawn down over the day with a
 * soft edge, as the world's clock turns the paint (R-CLOCK-033). A wipe of the shot, not a fade of the frame. The tall
 * frame draws the phone's own recordings of the house.
 */
export function NightFalls({ from = 0, falls = [14, 40] }: { from?: number; falls?: readonly [number, number] }) {
  const frame = useCurrentFrame();
  const tall = useFrameShape() === "tall";
  const edge = ramp(frame, falls[0], falls[1], -20, 120);
  const mask = `linear-gradient(to bottom, black ${String(edge)}%, transparent ${String(edge + 20)}%)`;
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: NAVY }}>
      <AbsoluteFill>
        <Clip name={tall ? "tall-day" : "wide-day"} from={from} />
      </AbsoluteFill>
      <AbsoluteFill style={{ maskImage: mask, WebkitMaskImage: mask }}>
        <Clip name={tall ? "tall-night" : "wide-night"} from={from} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/**
 * The send-off's flight: the plane leaves Lagos from the airport's side of the night map and climbs off toward the route's
 * city, a dashed line behind it, and the city's name lands on a sticker card where it went. In the tall frame the plane
 * climbs from low on the left to the top right, under the city's card.
 */
export function Flight({ city, tile }: { city: string; tile: string }) {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height, fps } = useVideoConfig();
  const tall = useFrameShape() === "tall";
  const t = ramp(frame, 6, durationInFrames - 22);
  const eased = t * t * (3 - 2 * t);
  const start = tall ? { x: width * 0.22, y: height * 0.64 } : { x: width * 0.3, y: height * 0.7 };
  const end = tall ? { x: width * 1.2, y: height * 0.12 } : { x: width * 1.1, y: height * 0.02 };
  const lift = Math.sin(eased * Math.PI) * 70;
  const x = interpolate(eased, [0, 1], [start.x, end.x]);
  const y = interpolate(eased, [0, 1], [start.y, end.y]) - lift;
  const angle = (Math.atan2(end.y - start.y - 70, end.x - start.x) * 180) / Math.PI;
  const size = interpolate(eased, [0, 1], [110, 280]);
  const card = land(frame, fps, durationInFrames - 34);
  return (
    <AbsoluteFill>
      <MapShot paint="night" zoom={[1.18, 1.0]} toward={tall ? [0.3, 0.6] : [0.35, 0.65]} />
      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <circle cx={start.x} cy={start.y} r={18 * pop(frame, fps, 0)} fill={CREAM} opacity={0.9} />
        <path d={`M${String(start.x)} ${String(start.y)} Q${String((start.x + x) / 2)} ${String((start.y + y) / 2 - lift * 0.6)} ${String(x)} ${String(y)}`} stroke={CREAM} strokeWidth={7} strokeDasharray="22 18" strokeLinecap="round" fill="none" opacity={0.8} />
      </svg>
      <div style={{ position: "absolute", left: x - size / 2, top: y - size * 0.3, transform: `rotate(${String(angle)}deg)`, filter: "drop-shadow(0 18px 12px rgba(13, 17, 36, 0.4))" }}>
        <Plane size={size} color={CREAM} />
      </div>
      <div style={{ position: "absolute", right: tall ? 70 : 120, top: tall ? 210 : 120, transform: `translateY(${String((1 - card) * -260)}px) rotate(${String(interpolate(card, [0, 1], [-14, -4]))}deg)`, opacity: Math.min(1, card * 3) }}>
        <Card paint={NIGHT} style={{ display: "flex", alignItems: "center", gap: 26, padding: "22px 44px 22px 26px", boxShadow: `0 0 0 8px ${CREAM}, 0 24px 40px rgba(0, 0, 0, 0.35)` }}>
          <Sticker tile={tile} size={150} delay={durationInFrames - 30} edge={6} />
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 96, color: CREAM }}>{city}</div>
        </Card>
      </div>
    </AbsoluteFill>
  );
}

/** The phone drawn in code rising onto the sky with a recorded moment on its screen, tilted, floating a little. */
export function PhoneShot({ clip, from = 0 }: { clip: ClipName; from?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = land(frame, fps, 0, 16);
  const bob = Math.sin(frame / 16) * 8;
  return (
    <AbsoluteFill style={{ background: DAY.sky, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ transform: `translateY(${String((1 - rise) * 900 + bob)}px) rotate(${String(interpolate(rise, [0, 1], [8, -3]))}deg)` }}>
        <Phone height={980}>
          <Clip name={clip} from={from} />
        </Phone>
      </div>
    </AbsoluteFill>
  );
}

/**
 * The end card at night: the seal springs in and its two bulbs light, the name slides in beside it in the night paint's
 * cream, then the yellow "Play it" (its underside cream at night) and the address.
 */
export function NightEnd() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seal = pop(frame, fps, 0);
  const glow = ramp(frame, 10, 30, 0, 1);
  const name = land(frame, fps, 18);
  const button = pop(frame, fps, 36);
  return (
    <AbsoluteFill style={{ background: NIGHT.sky, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 56 }}>
        <div style={{ transform: `scale(${String(seal)}) rotate(${String((1 - seal) * -30)}deg)` }}>
          <Seal size={320} glow={glow} id="end" />
        </div>
        <div style={{ opacity: name, transform: `translateX(${String((1 - name) * 80)}px)` }}>
          <Wordmark height={200} color={CREAM} />
        </div>
      </div>
      <div style={{ marginTop: 84, display: "flex", alignItems: "center", gap: 48, transform: `scale(${String(button)})` }}>
        <PressButton size={62} style={{ borderColor: "#0b1130", boxShadow: `0 12px 0 ${CREAM}` }}>
          Play it
        </PressButton>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 58, color: CREAM }}>japacity.app</div>
      </div>
    </AbsoluteFill>
  );
}
