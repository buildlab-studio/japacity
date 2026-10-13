// The lively layer's pieces (design page 13, section 2; apps/client/src/index.css) at a trailer's scale, about two and a
// half times the phone's: the white card with the navy edge, the tilted sticker chip, the sticker cut from a tile, the
// pressed yellow button, the pill, and the big title whose words spring up one after another.
import type { CSSProperties, ReactNode } from "react";
import { Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

import { CLIPS, type ClipName } from "../clips";
import { land, pop, wobble } from "./motion";
import { DAY, DEVICE, FONT, NAVY, type Paint, YELLOW } from "./tokens";

export function Card({ children, paint = DAY, style }: { children: ReactNode; paint?: Paint; style?: CSSProperties }) {
  return (
    <div style={{ border: `3px solid ${paint.edge}`, borderRadius: 44, background: paint.card, color: paint.ink, boxShadow: "0 18px 40px rgba(19, 26, 51, 0.16)", fontFamily: FONT, ...style }}>
      {children}
    </div>
  );
}

/** The tilted sticker chip: a tinted pill cut with a white edge. It pops in at `delay`. */
export function Chip({ children, tint, tilt = -4, delay = 0, size = 34, paint = DAY }: { children: ReactNode; tint: string; tilt?: number; delay?: number; size?: number; paint?: Paint }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = pop(frame, fps, delay);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        borderRadius: size * 0.75,
        padding: `${String(size * 0.22)}px ${String(size * 0.7)}px`,
        background: tint,
        color: paint === DAY ? DAY.ink : paint.ink,
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1.3,
        whiteSpace: "nowrap",
        boxShadow: `0 0 0 6px ${paint.cut}, 0 8px 16px rgba(20, 40, 50, 0.22)`,
        transform: `rotate(${String(wobble(frame, fps, delay, tilt))}deg) scale(${String(p)})`,
        opacity: Math.min(1, p * 2),
      }}
    >
      {children}
    </div>
  );
}

/** A tile picture cut as a sticker: a white edge round its shape and a soft shadow, wobbling in at `delay`. */
export function Sticker({ tile, size, tilt = 0, delay = 0, edge = 8, style }: { tile: string; size: number; tilt?: number; delay?: number; edge?: number; style?: CSSProperties }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = pop(frame, fps, delay);
  const e = String(edge);
  return (
    <Img
      src={staticFile(`tiles/${tile}.png`)}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        filter: `drop-shadow(${e}px 0 0 #fff) drop-shadow(-${e}px 0 0 #fff) drop-shadow(0 ${e}px 0 #fff) drop-shadow(0 -${e}px 0 #fff) drop-shadow(0 16px 14px rgba(20, 40, 50, 0.28))`,
        transform: `rotate(${String(wobble(frame, fps, delay, tilt))}deg) scale(${String(p)})`,
        ...style,
      }}
    />
  );
}

/** The one yellow action with its navy underside. */
export function PressButton({ children, size = 52, style }: { children: ReactNode; size?: number; style?: CSSProperties }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `${String(size * 0.42)}px ${String(size * 1.2)}px`,
        border: `5px solid ${NAVY}`,
        borderRadius: size * 0.8,
        background: YELLOW,
        color: DAY.ink,
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1,
        boxShadow: `0 ${String(size * 0.2)}px 0 ${NAVY}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Pill({ children, paint = DAY, size = 34 }: { children: ReactNode; paint?: Paint; size?: number }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 12, border: `3px solid ${paint.edge}`, borderRadius: 999, padding: `${String(size * 0.3)}px ${String(size * 0.8)}px`, background: paint.card, color: paint.ink, fontFamily: FONT, fontWeight: 700, fontSize: size, lineHeight: 1.15, whiteSpace: "nowrap" }}>
      {children}
    </div>
  );
}

/** A big title: each word springs up from under a line, a few frames after the one before. */
export function Title({ words, size = 168, color = DAY.ink, delay = 0, align = "center", gap = 2 }: { words: string; size?: number; color?: string; delay?: number; align?: "center" | "left"; gap?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: align === "center" ? "center" : "flex-start", columnGap: size * 0.26, fontFamily: FONT, fontWeight: 700, fontSize: size, lineHeight: 1.05, letterSpacing: -size * 0.02, color }}>
      {words.split(" ").map((word, index) => {
        const p = land(frame, fps, delay + index * gap, 9);
        return (
          <span key={`${word}-${String(index)}`} style={{ display: "inline-block", overflow: "hidden", paddingBottom: size * 0.08 }}>
            <span style={{ display: "inline-block", transform: `translateY(${String((1 - p) * 110)}%)` }}>{word}</span>
          </span>
        );
      })}
    </div>
  );
}

/** A recorded moment of the game, from apps/teaser/clips. */
export function Clip({ name, from = 0, style }: { name: ClipName; from?: number; style?: CSSProperties }) {
  const clip = CLIPS.find((one) => one.name === name);
  if (clip === undefined) throw new Error(`No clip named ${name}`);
  return <OffthreadVideo src={staticFile(`clips/${clip.file}`)} muted trimBefore={from} style={{ width: "100%", height: "100%", objectFit: "cover", ...style }} />;
}

/** The phone drawn in code: a rounded dark frame round a screen of the phone's shape (390 by 844). */
export function Phone({ children, height, style }: { children: ReactNode; height: number; style?: CSSProperties }) {
  const screenHeight = height - height * 0.044;
  const screenWidth = (screenHeight * 390) / 844;
  const rim = height * 0.022;
  return (
    <div style={{ width: screenWidth + rim * 2, height, borderRadius: height * 0.075, background: DEVICE, padding: rim, boxShadow: "0 40px 80px rgba(13, 17, 36, 0.35), inset 0 0 0 3px #2a3150", ...style }}>
      <div style={{ position: "relative", width: screenWidth, height: screenHeight, borderRadius: height * 0.058, overflow: "hidden", background: DAY.sky }}>{children}</div>
    </div>
  );
}

/** A plane drawn flat, as the send-off card draws it, pointing right. */
export function Plane({ size, color = NAVY }: { size: number; color?: string }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 100 60" style={{ display: "block", overflow: "visible" }}>
      <path d="M4 30 Q4 26 10 26 L86 26 Q98 27 98 30 Q98 33 86 34 L10 34 Q4 34 4 30 Z" fill={color} />
      <path d="M44 27 L62 2 L70 2 L58 27 Z" fill={color} />
      <path d="M44 33 L62 58 L70 58 L58 33 Z" fill={color} />
      <path d="M8 27 L14 12 L20 12 L18 27 Z" fill={color} />
      <path d="M8 33 L14 46 L20 46 L18 33 Z" fill={color} />
    </svg>
  );
}
