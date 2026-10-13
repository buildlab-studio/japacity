// Direction C, one day in Lagos: the phone travels across a toy city as the sky goes from morning to night. Its screen
// shows the game at each part of the day (the map, the ride, the sofa, the house at night), a big word names the part,
// the sun crosses and sets, the moon rises, the city's windows warm, and the seal's two bulbs light as the night paint
// falls. One travelling shot of about eight seconds, then the name at night.
import { AbsoluteFill, interpolate, interpolateColors, Sequence, useCurrentFrame, useVideoConfig } from "remotion";

import { Seal, Wordmark } from "../parts/brand";
import { Clip, Phone, PressButton, Sticker, Title } from "../parts/dress";
import { loadRubik } from "../parts/fonts";
import { land, pop, ramp } from "../parts/motion";
import { CREAM, DAY, FONT, NIGHT, YELLOW } from "../parts/tokens";
import type { ClipName } from "../clips";

const DAY_FRAMES = 236;
const END_FRAMES = 64;
export const C_FRAMES = DAY_FRAMES + END_FRAMES;

/** The four parts of the day: when each starts, its word, the clip on the phone, and the sky's top and foot. */
const PARTS: readonly { at: number; word: string; clip: ClipName; from: number; top: string; foot: string }[] = [
  { at: 0, word: "Morning.", clip: "map", from: 20, top: "#cfe6fb", foot: DAY.sky },
  { at: 58, word: "Afternoon.", clip: "ride", from: 40, top: "#a9d4f5", foot: "#e4f1fb" },
  { at: 118, word: "Evening.", clip: "sofa", from: 10, top: "#f4b98a", foot: "#fde3c8" },
  { at: 176, word: "Night.", clip: "night", from: 20, top: NIGHT.skyDeep, foot: NIGHT.sky },
];

const CITY = ["bld_shop-row", "bld_market-block", "bld_family-house", "bld_plaza", "bld_phone-plaza", "shop_barber-kiosk", "bld_shop-row", "bld_market-block"];

function skyAt(frame: number, edge: "top" | "foot"): string {
  const stops = PARTS.map((part) => part.at + 20);
  const colours = PARTS.map((part) => (edge === "top" ? part.top : part.foot));
  return interpolateColors(frame, stops, colours);
}

function Day() {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const night = ramp(frame, 160, 196);
  const ink = interpolateColors(night, [0, 1], [DAY.ink, NIGHT.ink]);
  // The sun climbs, crosses and sets; the moon rises after it.
  const sunT = ramp(frame, 0, 170);
  const sunX = interpolate(sunT, [0, 1], [240, width - 200]);
  const sunY = 520 - Math.sin(sunT * Math.PI) * 400;
  const moon = land(frame, fps, 176);
  // The phone glides from the left third to the right third, tilting as it goes, with a small float.
  const travel = land(frame, fps, 96, 60);
  const phoneX = interpolate(travel, [0, 1], [300, 1140]);
  const tilt = interpolate(travel, [0, 0.5, 1], [-5, 2, 5]) + Math.sin(frame / 14) * 1.2;
  const bob = Math.sin(frame / 18) * 10;
  const textLeft = travel > 0.5 ? 130 : 960;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(${skyAt(frame, "top")}, ${skyAt(frame, "foot")})`, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: sunX - 90, top: sunY - 90, width: 180, height: 180, borderRadius: 999, background: YELLOW, boxShadow: `0 0 0 30px rgba(242, 183, 5, 0.18), 0 0 0 70px rgba(242, 183, 5, 0.08)`, opacity: 1 - night }} />
      <div style={{ position: "absolute", left: 1560, top: interpolate(moon, [0, 1], [700, 120]), width: 140, height: 140, borderRadius: 999, background: CREAM, boxShadow: "0 0 0 26px rgba(243, 239, 230, 0.12)", opacity: moon }} />
      {CITY.map((tile, index) => (
        <div key={`${tile}-${String(index)}`} style={{ position: "absolute", left: -60 + index * 260, bottom: -70 - (index % 2) * 30, filter: `brightness(${String(1 - night * 0.55)}) saturate(${String(1 - night * 0.3)})` }}>
          <Sticker tile={tile} size={340} delay={index * 2} edge={6} />
          <div style={{ position: "absolute", inset: "30% 20%", borderRadius: 999, background: "rgba(255, 196, 92, 0.55)", filter: "blur(30px)", opacity: night }} />
        </div>
      ))}
      <div style={{ position: "absolute", left: phoneX, top: 70 + bob, transform: `rotate(${String(tilt)}deg)` }}>
        <Phone height={940}>
          {PARTS.map((part, index) => {
            const next = PARTS[index + 1];
            const length = (next?.at ?? DAY_FRAMES) - part.at;
            const rise = land(frame, fps, part.at, 14);
            return (
              <Sequence key={part.word} from={part.at} durationInFrames={length + 10} layout="none">
                <div style={{ position: "absolute", inset: 0, transform: index === 0 ? "none" : `translateY(${String((1 - rise) * 100)}%)` }}>
                  <Clip name={part.clip} from={part.from} />
                </div>
              </Sequence>
            );
          })}
        </Phone>
      </div>
      {PARTS.map((part, index) => {
        const next = PARTS[index + 1];
        const length = (next?.at ?? DAY_FRAMES) - part.at;
        return (
          <Sequence key={part.word} from={part.at} durationInFrames={length} layout="none">
            <div style={{ position: "absolute", left: textLeft, top: 340, width: 1000 }}>
              <Title words={part.word} size={164} color={ink} align="left" delay={4} />
            </div>
          </Sequence>
        );
      })}
      <div style={{ position: "absolute", right: 80, top: 70, opacity: night, transform: `scale(${String(0.6 + 0.4 * pop(frame, fps, 186))})` }}>
        <Seal size={150} glow={ramp(frame, 192, 210, 0, 0.9)} id="corner" />
      </div>
    </AbsoluteFill>
  );
}

function NightEnd() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seal = pop(frame, fps, 0);
  const name = land(frame, fps, 5);
  const button = pop(frame, fps, 12);
  return (
    <AbsoluteFill style={{ background: NIGHT.sky, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
        <div style={{ transform: `scale(${String(seal)})` }}>
          <Seal size={300} glow={ramp(frame, 4, 20, 0.2, 1)} id="night-end" />
        </div>
        <div style={{ opacity: name, transform: `translateX(${String((1 - name) * 60)}px)` }}>
          <Wordmark height={190} color={CREAM} />
        </div>
      </div>
      <div style={{ marginTop: 80, display: "flex", alignItems: "center", gap: 44, transform: `scale(${String(button)})` }}>
        <PressButton size={60} style={{ borderColor: "#0b1130", boxShadow: `0 12px 0 ${CREAM}` }}>
          Play it
        </PressButton>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 56, color: CREAM }}>japacity.app</div>
      </div>
    </AbsoluteFill>
  );
}

export function RoundC() {
  loadRubik();
  return (
    <AbsoluteFill>
      <Sequence durationInFrames={DAY_FRAMES}>
        <Day />
      </Sequence>
      <Sequence from={DAY_FRAMES} durationInFrames={END_FRAMES}>
        <NightEnd />
      </Sequence>
    </AbsoluteFill>
  );
}
