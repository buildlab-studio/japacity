// The main cut: the game as it feels in the hand. The world's own recordings carry every shot, and the game's pieces live
// inside them: a word bubble over a head in the place's own voice, the band at the top, the brief's chip landing, the
// passbook sliding up over the house, the ways out stacking over the parlour, the night falling, the plane leaving, and
// the seal's two bulbs for the oldest Nigerian joke about leaving. Twenty eight seconds, with sound.
//
// One list of shots draws two films: the landscape one (`Lead`, 1920 by 1080) and the portrait one for a phone's feed
// (`LeadPortrait`, 1080 by 1920). In the portrait film the city is first a strip: the wide recording seen through a card's
// window across the middle of the day sky, travelling left to right, what is said standing above it and what is shown
// below it, sliding a touch slower than the picture. On "Find your way out." the window grows to the frame and the picture
// inside becomes the phone's own recording of the house; from there the film is the game in the hand.
import { type CSSProperties, createContext, type ReactNode, useContext } from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

import type { ClipName } from "../clips";
import { Seal, Wordmark } from "../parts/brand";
import { Card, Chip, Clip, PressButton, Sticker, Title } from "../parts/dress";
import { loadRubik } from "../parts/fonts";
import { FrameContext, type FrameShape, useFrameShape } from "../parts/frame";
import { land, pop, ramp } from "../parts/motion";
import { CREAM, DAY, FONT, GREEN, NAVY, NIGHT, type Paint, TALL_VIDEO, TINT, VIDEO, YELLOW } from "../parts/tokens";
import { Flight, MapShot, NightFalls } from "../teaser/scenes";

/** Where a shot stands in the portrait film: the opening card, the strip, the turn, the hand, the end card. */
export type Act = "open" | "strip" | "turn" | "hand" | "end";

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const TALL_FULL: Box = { x: 0, y: 0, w: TALL_VIDEO.width, h: TALL_VIDEO.height };
/** The strip's window across the middle of the tall frame: the words stand above it, the stickers below. */
export const STRIP: Box = { x: 36, y: 560, w: 1008, h: 800 };
const STRIP_RADIUS = 44;
/** A wide recording's own pixels, which a strip shot's framing is given in. */
const WIDE_CLIP = { w: 1280, h: 720 } as const;
/** How much of the picture's travel the stickers under the strip follow: a touch slower, so the two layers slide apart. */
const PARALLAX = 0.8;
/** The turn's one spring, from the strip to the frame, on the frame "Find your way out." lands. */
const GROW_FRAMES = 18;
const TURN_AT = 20;
/** The frame of the turn the band starts to rise to the top of the frame on: landed before the chip pops. */
const BAND_RISES_AT = 4;
/**
 * The turn fades through the day sky, never across: the wide picture goes while the window grows, a beat of sky, then the
 * phone's recording comes up. Frames after the turn starts.
 */
const WIDE_GOES = [4, 10] as const;
const PHONE_COMES = [12, 18] as const;

interface Stage {
  readonly act: Act;
  /** The window onto the world, in the tall frame's pixels. */
  readonly box: Box;
  /** 0 while the world is a strip, 1 once it fills the frame. */
  readonly grow: number;
  /** How far the strip's picture stands from where it stands halfway through the shot, in pixels of the frame. */
  readonly travel: number;
}

const ActContext = createContext<Act>("hand");
const StageContext = createContext<Stage>({ act: "hand", box: TALL_FULL, grow: 1, travel: 0 });

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixBox(a: Box, b: Box, t: number): Box {
  return { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), w: mix(a.w, b.w, t), h: mix(a.h, b.h, t) };
}

/** A smooth step from 0 to 1, for travel that eases in and out. */
function ease(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * A sticker under the strip (or a line over it) as the portrait film moves it: in from the left on a firm spring, drifting
 * right a touch slower than the picture travels, and off to the right in the shot's last frames. In the turn it stays.
 * Outside the strip it does nothing.
 */
function Slide({ delay = 0, children }: { delay?: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const stage = useContext(StageContext);
  if (useFrameShape() === "wide" || (stage.act !== "strip" && stage.act !== "turn")) return <>{children}</>;
  const enter = land(frame, fps, delay, 16);
  const drift = stage.travel * PARALLAX;
  const off = stage.act === "strip" ? ramp(frame, durationInFrames - 10, durationInFrames) : 0;
  const x = (1 - enter) * -1100 + drift + off * off * 1200;
  return <div style={{ position: "absolute", inset: 0, transform: `translateX(${String(x)}px)` }}>{children}</div>;
}

/** A place for anything in each frame: left and top (or bottom) in that frame's pixels, and a scale for the tall one. */
interface Spot {
  readonly left: number;
  readonly top?: number;
  readonly bottom?: number;
  readonly scale?: number;
}

function Place({ wide, tall, delay = 0, children }: { wide: Spot; tall: Spot; delay?: number; children: ReactNode }) {
  const shape = useFrameShape();
  const spot = shape === "tall" ? tall : wide;
  const scale = spot.scale ?? 1;
  return (
    <Slide delay={delay}>
      <div style={{ position: "absolute", left: spot.left, top: spot.top, bottom: spot.bottom, transformOrigin: "0 0", transform: scale === 1 ? undefined : `scale(${String(scale)})` }}>{children}</div>
    </Slide>
  );
}

/** Where a bubble stands in the tall frame: (x, y) is the tip of its tail, which points down at a head or up into the strip. */
interface TallBubble {
  readonly x: number;
  readonly y: number;
  readonly tail?: "down" | "up";
  readonly width?: number;
}

/**
 * A bubble over someone's head, as the world draws it: the name pill with the speaker's mark, the words, the tail. In the
 * tall frame the words spring in one after another from the left, as the portrait film's lines do.
 */
function Bubble({ name, mark, children, x, y, delay = 0, paint = DAY, size = 40, width = 760, tall }: { name: string; mark?: string; children: string; x: number; y: number; delay?: number; paint?: Paint; size?: number; width?: number; tall: TallBubble }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shape = useFrameShape();
  const p = pop(frame, fps, delay);
  const up = shape === "tall" && tall.tail === "up";
  const at = shape === "tall" ? { x: tall.x, y: up ? tall.y + 24 : tall.y - 24, size: 46, width: tall.width ?? 860 } : { x, y, size, width };
  const words =
    shape === "tall" ? (
      <div style={{ display: "flex", flexWrap: "wrap", columnGap: at.size * 0.27 }}>
        {children.split(" ").map((word, index) => {
          const w = land(frame, fps, delay + 2 + index * 2, 10);
          return (
            <span key={`${word}-${String(index)}`} style={{ display: "inline-block", opacity: w, transform: `translateX(${String((1 - w) * -40)}px)` }}>
              {word}
            </span>
          );
        })}
      </div>
    ) : (
      children
    );
  const bubble = (
    <div style={{ position: "absolute", left: at.x, top: at.y, transform: `translate(-50%, ${up ? "0" : "-100%"}) scale(${String(p)})`, transformOrigin: up ? "50% 0" : "50% 100%", opacity: Math.min(1, p * 2), width: "max-content", maxWidth: at.width }}>
      <div style={{ position: "relative", border: `4px solid ${paint.edge}`, borderRadius: 34, background: paint.card, color: paint.ink, padding: "18px 30px 22px", fontFamily: FONT, boxShadow: "0 16px 30px rgba(19, 26, 51, 0.22)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
          <div style={{ width: at.size * 0.9, height: at.size * 0.9, borderRadius: 999, background: paint === DAY ? NAVY : CREAM, color: paint === DAY ? CREAM : NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: at.size * 0.5 }}>{mark ?? name.slice(0, 1)}</div>
          <div style={{ fontWeight: 700, fontSize: at.size * 0.72, color: paint.ink2 }}>{name}</div>
        </div>
        <div style={{ fontWeight: 700, fontSize: at.size, lineHeight: 1.2 }}>{words}</div>
        {up ? (
          <>
            <div style={{ position: "absolute", left: "50%", top: -24, width: 0, height: 0, marginLeft: -18, borderLeft: "18px solid transparent", borderRight: "18px solid transparent", borderBottom: `22px solid ${paint.edge}` }} />
            <div style={{ position: "absolute", left: "50%", top: -16, width: 0, height: 0, marginLeft: -13, borderLeft: "13px solid transparent", borderRight: "13px solid transparent", borderBottom: `16px solid ${paint.card}` }} />
          </>
        ) : (
          <>
            <div style={{ position: "absolute", left: "50%", bottom: -24, width: 0, height: 0, marginLeft: -18, borderLeft: "18px solid transparent", borderRight: "18px solid transparent", borderTop: `22px solid ${paint.edge}` }} />
            <div style={{ position: "absolute", left: "50%", bottom: -16, width: 0, height: 0, marginLeft: -13, borderLeft: "13px solid transparent", borderRight: "13px solid transparent", borderTop: `16px solid ${paint.card}` }} />
          </>
        )}
      </div>
    </div>
  );
  return shape === "tall" ? <Slide delay={delay}>{bubble}</Slide> : bubble;
}

/** The band at the top of the world: who, when, where, and what is in the pocket. */
function Band({ name, when, where, naira, age = "23 yrs 1 mo", paint = DAY, delay = 0 }: { name: string; when: string; where: string; naira: string; age?: string; paint?: Paint; delay?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shape = useFrameShape();
  const stage = useContext(StageContext);
  const p = land(frame, fps, delay, 14);
  // In the tall frame the band rides the window's top edge across the strip, and stands at the top of the frame in the
  // hand. In the turn it rises there on its own before "Find your way out." lands, so the chip never covers it.
  const rise = stage.act === "turn" ? land(frame, fps, BAND_RISES_AT, 12) : stage.grow;
  const inset = mix(24, 40, rise);
  const at = shape === "tall" ? { left: mix(STRIP.x, 0, rise) + inset, right: mix(TALL_FULL.w - STRIP.x - STRIP.w, 0, rise) + inset, top: mix(STRIP.y + 22, 60, rise) } : { left: 40, right: 40, top: 32 };
  return (
    <div style={{ position: "absolute", ...at, transform: `translateY(${String((1 - p) * -160)}px)` }}>
      <Card paint={paint} style={{ display: "flex", alignItems: "center", gap: 26, padding: "16px 28px", borderRadius: 999 }}>
        <div style={{ width: 70, height: 70, borderRadius: 999, background: paint === DAY ? DAY.skyDeep : "#2f3f7a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>{paint === DAY ? "☀️" : "🌙"}</div>
        <div style={{ fontFamily: FONT, lineHeight: 1.1 }}>
          <div style={{ fontWeight: 700, fontSize: 40 }}>
            {name} <span style={{ color: paint.ink2, fontWeight: 500 }}>· {when}</span>
          </div>
          <div style={{ fontWeight: 500, fontSize: 28, color: paint.ink2 }}>{age} · {where}</div>
        </div>
        <div style={{ marginLeft: "auto", fontFamily: FONT, fontWeight: 700, fontSize: 42, color: paint === DAY ? GREEN : "#8fe3b0", background: paint === DAY ? TINT.money : "#1f4a3a", borderRadius: 999, padding: "10px 30px" }}>{naira}</div>
      </Card>
    </div>
  );
}

/** The brief's chip, as the hand hands it: the sticker, the words, the dots of its steps. */
function BriefChip({ tile, children, delay = 0, paint = DAY }: { tile: string; children: ReactNode; delay?: number; paint?: Paint }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tall = useFrameShape() === "tall";
  const p = land(frame, fps, delay, 16);
  const chip = (
    <div style={{ position: "absolute", left: 40, top: tall ? 1450 : 40, transform: tall ? undefined : `translateX(${String((1 - p) * -700)}px)` }}>
      <Card paint={paint} style={{ display: "flex", alignItems: "center", gap: 20, padding: "14px 32px 14px 18px", borderRadius: 999 }}>
        <Sticker tile={tile} size={78} delay={delay + 4} edge={5} />
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 40 }}>{children}</div>
        <div style={{ display: "flex", gap: 8, marginLeft: 8 }}>
          {[YELLOW, paint.ink2, paint.ink2, paint.ink2].map((color, index) => (
            <div key={String(index)} style={{ width: 18, height: 18, borderRadius: 999, background: color, opacity: index === 0 ? 1 : 0.35 }} />
          ))}
        </div>
      </Card>
    </div>
  );
  return tall ? <Slide delay={delay}>{chip}</Slide> : chip;
}

/**
 * A big tilted sticker chip of two or three words, the trailer's title, standing in a corner of the world. In the tall frame
 * it stands at `tall` (under the strip, sliding with it, unless `still`; `tilt` there, where a flatter chip fits better).
 */
function BigChip({ children, tint, delay = 0, tilt = -4, style, tall }: { children: ReactNode; tint: string; delay?: number; tilt?: number; style?: CSSProperties; tall: { left: number; top: number; still?: boolean; tilt?: number } }) {
  if (useFrameShape() === "tall") {
    const chip = (
      <div style={{ position: "absolute", left: tall.left, top: tall.top }}>
        <Chip tint={tint} tilt={tall.tilt ?? tilt} delay={delay} size={74}>
          {children}
        </Chip>
      </div>
    );
    return tall.still === true ? chip : <Slide delay={delay}>{chip}</Slide>;
  }
  return (
    <div style={{ position: "absolute", left: 60, bottom: 70, ...style }}>
      <Chip tint={tint} tilt={tilt} delay={delay} size={84}>
        {children}
      </Chip>
    </div>
  );
}

/** The left, the top and the width of a wide recording's pixels a strip window shows. */
type Framing = readonly [number, number, number];

/** The whole height of the recording, travelling across it: the framing a strip shot has unless it is given its own. */
const WHOLE: { from: Framing; to: Framing } = { from: [373, 0, 907], to: [0, 0, 907] };

interface WorldProps {
  readonly clip: "wide-ride" | "wide-street" | "wide-day" | "wide-sofa" | "wide-night";
  /** The phone's recording of the same place, which the turn grows into. */
  readonly tall: ClipName;
  readonly from?: number;
  readonly push?: number;
  readonly toward?: readonly [number, number];
  /**
   * What the strip's window frames, at the shot's first frame and at its last: the left, the top and the width of the
   * wide recording's own pixels (1280 by 720) shown, the height following from the window's shape. The left only falls,
   * so the picture travels left to right; each framing is chosen to stay inside the drawn city for the whole shot.
   */
  readonly strip?: { readonly from: Framing; readonly to: Framing };
  /** The strip's own frame of the clip to start on and its speed, where the landscape's would show the house turning away. */
  readonly stripFrom?: number;
  readonly stripRate?: number;
  /** The frame of a turn shot the window starts to grow on. */
  readonly turnAt?: number;
  readonly children?: ReactNode;
}

/** A recording of the world: in the wide frame, the wide recording pushed in slowly toward a point; in the tall, the strip or the hand. */
function World(props: WorldProps) {
  return useFrameShape() === "tall" ? <TallWorld {...props} /> : <WideWorld {...props} />;
}

function WideWorld({ clip, from = 0, push = 0.06, toward = [0.5, 0.5], children }: WorldProps) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = ramp(frame, 0, durationInFrames);
  return (
    <AbsoluteFill style={{ background: NAVY, overflow: "hidden" }}>
      <AbsoluteFill style={{ transformOrigin: `${String(toward[0] * 100)}% ${String(toward[1] * 100)}%`, transform: `scale(${String(1 + push * t)})` }}>
        <Clip name={clip} from={from} />
      </AbsoluteFill>
      {children}
    </AbsoluteFill>
  );
}

/** Where the wide recording stands in the tall frame when the strip's window frames `at`. */
function placeOf(at: Framing): { x: number; y: number; scale: number } {
  const scale = STRIP.w / at[2];
  return { x: STRIP.x - at[0] * scale, y: STRIP.y - at[1] * scale, scale };
}

/**
 * The world in the tall frame. In the strip, the wide recording inside the card's window, its framing easing from the
 * shot's first to its last, so the picture travels left to right and pushes in. In the turn, the window grows to the frame
 * on one spring and the picture fades through the day sky to the phone's recording of the same place. In the hand, the
 * phone's recording fills the frame.
 */
function TallWorld({ clip, tall, from = 0, push = 0.06, strip = WHOLE, stripFrom, stripRate = 1, turnAt = 20, children }: WorldProps) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const act = useContext(ActContext);
  const t = ramp(frame, 0, durationInFrames);
  const turning = act === "turn";
  const grow = act === "hand" ? 1 : turning ? land(frame, fps, turnAt, GROW_FRAMES) : 0;
  const k = ease(ramp(frame, 0, turning ? turnAt : durationInFrames));
  const at: Framing = [mix(strip.from[0], strip.to[0], k), mix(strip.from[1], strip.to[1], k), mix(strip.from[2], strip.to[2], k)];
  const place = placeOf(at);
  const middle = placeOf([mix(strip.from[0], strip.to[0], 0.5), mix(strip.from[1], strip.to[1], 0.5), mix(strip.from[2], strip.to[2], 0.5)]);
  const travel = place.x - middle.x;
  const box = mixBox(STRIP, TALL_FULL, grow);
  const wide = act === "hand" ? 0 : turning ? 1 - ramp(frame, turnAt + WIDE_GOES[0], turnAt + WIDE_GOES[1]) : 1;
  const phone = act === "hand" ? 1 : turning ? ramp(frame, turnAt + PHONE_COMES[0], turnAt + PHONE_COMES[1]) : 0;
  return (
    <AbsoluteFill style={{ background: DAY.sky, overflow: "hidden" }}>
      <div data-stage-window={act} style={{ position: "absolute", left: box.x, top: box.y, width: box.w, height: box.h, overflow: "hidden", borderRadius: STRIP_RADIUS * (1 - grow), background: DAY.sky, boxShadow: grow < 1 ? `0 0 0 ${String(3 * (1 - grow))}px ${DAY.edge}, 0 18px 40px rgba(19, 26, 51, ${String(0.16 * (1 - grow))})` : "none" }}>
        {wide > 0 ? (
          <div data-strip-picture={clip} style={{ position: "absolute", left: place.x - box.x, top: place.y - box.y, width: WIDE_CLIP.w * place.scale, height: WIDE_CLIP.h * place.scale, opacity: wide }}>
            <Clip name={clip} from={stripFrom ?? from} rate={stripRate} />
          </div>
        ) : null}
        {phone > 0 ? (
          <div style={{ position: "absolute", left: -box.x, top: -box.y, width: TALL_FULL.w, height: TALL_FULL.h, opacity: phone }}>
            <div style={{ width: "100%", height: "100%", transform: `scale(${String(1 + push * t)})` }}>
              <Clip name={tall} from={from} />
            </div>
          </div>
        ) : null}
      </div>
      <StageContext.Provider value={{ act, box, grow, travel }}>{children}</StageContext.Provider>
    </AbsoluteFill>
  );
}

function Stamp({ label, delay }: { label: string; delay: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = pop(frame, fps, delay);
  const inked = frame >= delay;
  return (
    <div style={{ width: 118, height: 118, borderRadius: 999, border: `5px ${inked ? "solid" : "dashed"} ${inked ? GREEN : DAY.ink2}`, color: inked ? GREEN : DAY.ink2, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 30, lineHeight: 1, gap: 4, transform: inked ? `scale(${String(interpolate(p, [0, 1], [1.6, 1]))}) rotate(-8deg)` : "none", background: inked ? TINT.money : "transparent" }}>
      {label}
      {inked ? <span style={{ fontSize: 16, fontWeight: 500 }}>Mama heard</span> : null}
    </div>
  );
}

/** The passbook sliding up over the house, counting, its stamps landing as Mama hears. */
function Passbook({ delay = 0 }: { delay?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tall = useFrameShape() === "tall";
  const card = land(frame, fps, delay, 16);
  const counted = ramp(frame, delay + 6, delay + 44);
  const eased = 1 - (1 - counted) * (1 - counted);
  const amount = Math.round((eased * 2_500_000) / 10_000) * 10_000;
  // In the tall frame it slides in under the strip from the left, over the window's lower edge, at the frame's scale.
  const at: CSSProperties = tall ? { left: 52, top: 1300, transformOrigin: "0 0", transform: `scale(0.78) rotate(${String(-3 * card)}deg)` } : { left: 90, bottom: 60, transform: `translateY(${String((1 - card) * 900)}px) rotate(${String(-3 * card)}deg)` };
  const book = (
    <div style={{ position: "absolute", ...at }}>
      <Card style={{ width: 760, padding: 36, fontFamily: FONT }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 66, height: 66, borderRadius: 20, background: GREEN, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, fontWeight: 700 }}>₦</div>
          <div style={{ fontWeight: 700, fontSize: 46 }}>Bank</div>
          <div style={{ marginLeft: "auto" }}>
            <Chip tint={TINT.plain} delay={delay + 14} size={26}>
              Next stamp ₦5m
            </Chip>
          </div>
        </div>
        <div style={{ marginTop: 22, fontWeight: 500, fontSize: 28, color: DAY.ink2 }}>Held for the road</div>
        <div style={{ fontWeight: 700, fontSize: 96, letterSpacing: -2, fontVariantNumeric: "tabular-nums", color: DAY.ink }}>₦{amount.toLocaleString("en-NG")}</div>
        <div style={{ marginTop: 14, height: 22, borderRadius: 99, background: DAY.skyDeep, overflow: "hidden" }}>
          <div style={{ width: `${String(eased * 50)}%`, height: "100%", borderRadius: 99, background: GREEN }} />
        </div>
        <div style={{ marginTop: 26, display: "flex", gap: 26 }}>
          <Stamp label="₦1m" delay={delay + 24} />
          <Stamp label="₦2.5m" delay={delay + 44} />
          <Stamp label="₦5m" delay={9999} />
        </div>
      </Card>
    </div>
  );
  return tall ? <Slide delay={delay}>{book}</Slide> : book;
}

function RouteCard({ tile, title, line, tint, top, tallTop, delay }: { tile: string; title: string; line: string; tint: string; top: number; tallTop: number; delay: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tall = useFrameShape() === "tall";
  const p = land(frame, fps, delay, 16);
  // In the tall frame the ways out stack under the strip, coming in from the left with the other stickers.
  const at: CSSProperties = tall ? { left: 218, top: tallTop, transformOrigin: "0 0", transform: `scale(0.92) rotate(${String((1 - p) * -6)}deg)` } : { right: 70, top, transform: `translateX(${String((1 - p) * 1200)}px) rotate(${String((1 - p) * 6)}deg)` };
  const card = (
    <div style={{ position: "absolute", ...at }}>
      <Card style={{ width: 700, padding: 20, display: "flex", alignItems: "center", gap: 24 }}>
        <div style={{ width: 120, height: 120, borderRadius: 26, background: tint, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sticker tile={tile} size={104} delay={delay + 4} edge={5} />
        </div>
        <div style={{ fontFamily: FONT }}>
          <div style={{ fontWeight: 700, fontSize: 44 }}>{title}</div>
          <div style={{ fontWeight: 500, fontSize: 28, color: DAY.ink2, marginTop: 2 }}>{line}</div>
        </div>
      </Card>
    </div>
  );
  return tall ? <Slide delay={delay}>{card}</Slide> : card;
}

/** The bits that fly when the ways out land: where each stands in the wide frame, and round Ada in the tall one. */
const CONFETTI = [
  { x: 1180, y: 160, tx: 560, ty: 520, c: "#f2b705", r: -20, d: 30 },
  { x: 1500, y: 120, tx: 900, ty: 430, c: "#c2185b", r: 25, d: 32 },
  { x: 1120, y: 420, tx: 520, ty: 820, c: "#2a8656", r: 40, d: 34 },
  { x: 1820, y: 520, tx: 1000, ty: 760, c: "#2c3f87", r: -35, d: 31 },
  { x: 1380, y: 60, tx: 700, ty: 400, c: "#d4602e", r: 10, d: 33 },
];

function Bit({ bit }: { bit: (typeof CONFETTI)[number] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tall = useFrameShape() === "tall";
  const p = pop(frame, fps, bit.d);
  return <div style={{ position: "absolute", left: tall ? bit.tx : bit.x, top: tall ? bit.ty : bit.y, width: 40, height: 20, borderRadius: 8, background: bit.c, boxShadow: "0 0 0 5px #fff", transform: `translateY(${String((1 - p) * 160)}px) rotate(${String(bit.r * p)}deg) scale(${String(p)})` }} />;
}

/** The end card's last line: the game costs nothing and its making is open to read. */
export const END_LINE = "Free. Open source.";

/**
 * The oldest Lagos joke about leaving, then the seal: its two bulbs click off one after the other, and come back on with the
 * name. In the tall frame the card stands stacked: the seal over the name, then Play it, the address, the hook and the last line.
 */
function LightsOut() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tall = useFrameShape() === "tall";
  const seal = pop(frame, fps, 0);
  const off = frame >= 22 ? 0 : 1;
  const back = ramp(frame, 46, 58, 0, 1);
  const glow = Math.max(off * 0.8, back);
  const name = land(frame, fps, 50);
  const button = pop(frame, fps, 66);
  const click = frame >= 22 && frame < 46;
  if (tall) {
    return (
      <AbsoluteFill style={{ background: click ? "#0b1130" : NIGHT.sky, alignItems: "center", justifyContent: "center", fontFamily: FONT, textAlign: "center" }}>
        <div style={{ transform: `scale(${String(seal)}) rotate(${String((1 - seal) * -30)}deg)`, opacity: click ? 0.55 : 1 }}>
          <Seal size={330} glow={glow} id="lead-end-tall" />
        </div>
        <div style={{ marginTop: 56, opacity: name, transform: `translateY(${String((1 - name) * 50)}px)` }}>
          <Wordmark height={160} color={CREAM} />
        </div>
        <div style={{ marginTop: 96, display: "flex", flexDirection: "column", alignItems: "center", gap: 44, transform: `scale(${String(button)})` }}>
          <PressButton size={66} style={{ borderColor: "#0b1130", boxShadow: `0 13px 0 ${CREAM}` }}>
            Play it
          </PressButton>
          <div style={{ fontWeight: 700, fontSize: 66, color: CREAM }}>japacity.app</div>
        </div>
        <div style={{ marginTop: 48, fontWeight: 500, fontSize: 46, lineHeight: 1.3, color: NIGHT.ink2, opacity: button }}>
          Japa is not by force.
          <br />
          How ready are you?
        </div>
        <div style={{ marginTop: 30, fontWeight: 500, fontSize: 34, color: NIGHT.ink2, opacity: button * 0.85 }}>{END_LINE}</div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ background: click ? "#0b1130" : NIGHT.sky, alignItems: "center", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 56 }}>
        <div style={{ transform: `scale(${String(seal)}) rotate(${String((1 - seal) * -30)}deg)`, opacity: click ? 0.55 : 1 }}>
          <Seal size={320} glow={glow} id="lead-end" />
        </div>
        <div style={{ width: name * 920, overflow: "hidden", opacity: name }}>
          <Wordmark height={200} color={CREAM} />
        </div>
      </div>
      <div style={{ marginTop: 84, display: "flex", alignItems: "center", gap: 48, transform: `scale(${String(button)})` }}>
        <PressButton size={62} style={{ borderColor: "#0b1130", boxShadow: `0 12px 0 ${CREAM}` }}>
          Play it
        </PressButton>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 58, color: CREAM }}>japacity.app</div>
      </div>
      <div style={{ marginTop: 40, fontFamily: FONT, fontWeight: 500, fontSize: 40, color: NIGHT.ink2, opacity: button }}>Japa is not by force. How ready are you?</div>
      <div style={{ marginTop: 20, fontFamily: FONT, fontWeight: 500, fontSize: 30, color: NIGHT.ink2, opacity: button * 0.85 }}>{END_LINE}</div>
    </AbsoluteFill>
  );
}

/** The flight with the joke written over the lagoon. */
function Leaving() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tall = useFrameShape() === "tall";
  const p = land(frame, fps, 10, 14);
  return (
    <AbsoluteFill>
      <Flight city="London" tile="bld_rye-lane-terrace_a" />
      <div style={{ position: "absolute", left: tall ? 60 : 80, bottom: tall ? 330 : 90, transform: `translateY(${String((1 - p) * 200)}px)`, opacity: p }}>
        <Card paint={NIGHT} style={{ padding: "26px 44px", borderRadius: 40, boxShadow: `0 0 0 8px ${CREAM}, 0 24px 40px rgba(0, 0, 0, 0.35)` }}>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 64, lineHeight: 1.15, color: CREAM }}>
            Last person out,
            <br />
            switch off the light.
          </div>
        </Card>
      </div>
    </AbsoluteFill>
  );
}

/** The opening, as the door introduces a life: the painted city, Ada herself, her card, and the game's own hook. */
function MeetAda() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = land(frame, fps, 14, 16);
  if (useFrameShape() === "tall") {
    // Stacked for the phone: her card and the hook in the top half on the day sky, Ada herself standing in the lower half.
    return (
      <AbsoluteFill>
        <MapShot paint="day" zoom={[1.0, 1.18]} toward={[0.42, 0.4]} />
        <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(234, 243, 251, 0.95) 0%, rgba(234, 243, 251, 0.88) 52%, rgba(234, 243, 251, 0.45) 100%)" }} />
        <div style={{ position: "absolute", left: 250, bottom: 0 }}>
          <Sticker tile="chr_ada-figure" size={900} tilt={-2} delay={4} edge={10} />
        </div>
        <div style={{ position: "absolute", left: 56, top: 210, transform: `translateY(${String((1 - card) * -120)}px) rotate(${String(-3 * card)}deg)`, opacity: card }}>
          <Card style={{ display: "flex", alignItems: "center", gap: 24, padding: "18px 40px 18px 22px", borderRadius: 999 }}>
            <Sticker tile="chr_ada-face" size={104} delay={18} edge={5} />
            <div style={{ fontFamily: FONT, lineHeight: 1.1 }}>
              <div style={{ fontWeight: 700, fontSize: 54 }}>Ada</div>
              <div style={{ fontWeight: 500, fontSize: 31, color: DAY.ink2 }}>23 yrs · The nurse · Surulere, Lagos</div>
            </div>
          </Card>
        </div>
        {/* The hook broken by sense, two words a line or three, each line springing on from the one before. */}
        <div style={{ position: "absolute", left: 64, top: 400, width: 960 }}>
          <Title words="Japa is not" size={128} align="left" delay={28} gap={2} />
          <Title words="by force." size={128} align="left" delay={34} gap={2} />
          <div style={{ marginTop: 14 }}>
            <Title words="How ready" size={128} align="left" delay={52} gap={2} />
            <Title words="are you?" size={128} align="left" delay={56} gap={2} />
          </div>
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <MapShot paint="day" zoom={[1.0, 1.22]} toward={[0.42, 0.4]} />
      <AbsoluteFill style={{ background: "linear-gradient(to right, rgba(234, 243, 251, 0.94) 0%, rgba(234, 243, 251, 0.84) 60%, rgba(234, 243, 251, 0.4) 100%)" }} />
      <div style={{ position: "absolute", left: 90, bottom: 0 }}>
        <Sticker tile="chr_ada-figure" size={760} tilt={-2} delay={4} edge={10} />
      </div>
      <div style={{ position: "absolute", left: 640, top: 150, transform: `translateY(${String((1 - card) * -120)}px) rotate(${String(-3 * card)}deg)`, opacity: card }}>
        <Card style={{ display: "flex", alignItems: "center", gap: 26, padding: "18px 40px 18px 22px", borderRadius: 999 }}>
          <Sticker tile="chr_ada-face" size={110} delay={18} edge={5} />
          <div style={{ fontFamily: FONT, lineHeight: 1.1 }}>
            <div style={{ fontWeight: 700, fontSize: 56 }}>Ada</div>
            <div style={{ fontWeight: 500, fontSize: 32, color: DAY.ink2 }}>23 yrs · The nurse · Surulere, Lagos</div>
          </div>
        </Card>
      </div>
      <div style={{ position: "absolute", left: 640, top: 340, width: 1200 }}>
        <Title words="Japa is not by force." size={120} align="left" delay={28} gap={2} />
        <div style={{ marginTop: 10 }}>
          <Title words="How ready are you?" size={120} align="left" delay={52} gap={2} />
        </div>
      </div>
    </AbsoluteFill>
  );
}


/** A sound at a frame of the shot, from public/sound (made by pnpm --filter @japacity/teaser sound). */
function Sfx({ name, at = 0, volume = 1, from = 0 }: { name: string; at?: number; volume?: number; from?: number }) {
  return (
    <Sequence from={at}>
      <Audio src={staticFile(`sound/${name}`)} volume={volume} trimBefore={from} />
    </Sequence>
  );
}

/** The passbook's coins: one tick every few frames while it counts. */
function Coins({ from, to, every = 3 }: { from: number; to: number; every?: number }) {
  const ticks: number[] = [];
  for (let f = from; f <= to; f += every) ticks.push(f);
  return (
    <>
      {ticks.map((f, i) => (
        <Sfx key={String(f)} name="coin.wav" at={f} volume={0.35 + (i / ticks.length) * 0.3} />
      ))}
    </>
  );
}

interface Shot {
  readonly frames: number;
  /** Where the shot stands in the portrait film. */
  readonly act: Act;
  readonly node: ReactNode;
}

/** The cut, as frames at 30 a second, for both frames: each piece carries where it stands in the tall one. */
const SHOTS: readonly Shot[] = [
  { frames: 100, act: "open", node: (
    <>
      <MeetAda />
      <Sfx name="pop.wav" at={6} volume={0.7} />
      <Sfx name="swish.wav" at={14} volume={0.4} />
      <Sfx name="pop.wav" at={20} volume={0.5} />
      <Sfx name="swish.wav" at={28} volume={0.4} />
      <Sfx name="swish.wav" at={52} volume={0.4} />
    </>
  ) },
  { frames: 56, act: "strip", node: (
    <World clip="wide-ride" tall="tall-ride" from={30} push={0.08} stripFrom={42} stripRate={0.76} strip={{ from: [440, 40, 820], to: [200, 40, 820] }}>
      <Bubble name="Conductor" x={900} y={720} delay={6} size={44} tall={{ x: 540, y: 552 }}>
        Oshodi, Oshodi. Enter with your change o.
      </Bubble>
      <Sfx name="engine.m4a" volume={0.38} />
      <Sfx name="horn.wav" at={3} volume={0.8} />
      <Sfx name="pop.wav" at={7} volume={0.8} />
    </World>
  ) },
  { frames: 46, act: "strip", node: (
    <World clip="wide-ride" tall="tall-ride" from={140} push={0.05} strip={{ from: [420, 20, 860], to: [240, 20, 860] }}>
      <Bubble name="Ada" x={1500} y={330} delay={4} size={44} width={720} tall={{ x: 600, y: 552 }}>
        Who get change for one thousand?
      </Bubble>
      <BigChip tint={TINT.food} delay={14} tilt={-5} tall={{ left: 90, top: 1460 }}>
        Danfo ₦300
      </BigChip>
      <Sfx name="engine.m4a" volume={0.34} from={56} />
      <Sfx name="pop.wav" at={5} volume={0.8} />
      <Sfx name="pop.wav" at={15} volume={0.6} />
    </World>
  ) },
  { frames: 84, act: "strip", node: (
    <World clip="wide-day" tall="tall-day" from={40} push={0.05} toward={[0.4, 0.3]} stripFrom={66} stripRate={0.7} strip={{ from: [390, 150, 680], to: [230, 160, 640] }}>
      <Bubble name="Mama" x={1440} y={330} delay={10} size={42} width={700} tall={{ x: 600, y: 552 }}>
        Your uncle called. When are you going?
      </Bubble>
      <BriefChip tile="prop_travel-bag" delay={40}>
        Papers, abeg
      </BriefChip>
      <Sfx name="pop.wav" at={11} volume={0.8} />
      <Sfx name="swish.wav" at={40} volume={0.4} />
      <Sfx name="pop.wav" at={45} volume={0.5} />
    </World>
  ) },
  { frames: 66, act: "strip", node: (
    <World clip="wide-sofa" tall="tall-sofa" from={40} push={0.14} toward={[0.4, 0.45]} strip={{ from: [600, 170, 600], to: [450, 200, 560] }}>
      <Band name="Ada" when="Evening" where="The family house" naira="₦498,500" age="23 yrs 1 mo" delay={0} />
      <Bubble name="Ada" x={1240} y={540} delay={30} size={42} width={620} tall={{ x: 560, y: 552 }}>
        Small rest, then I go hustle.
      </Bubble>
      <BigChip tint={TINT.body} delay={8} tall={{ left: 80, top: 1470 }}>
        One month at a time.
      </BigChip>
      <Sfx name="pop.wav" at={9} volume={0.7} />
      <Sfx name="pop.wav" at={31} volume={0.8} />
    </World>
  ) },
  { frames: 72, act: "strip", node: (
    <World clip="wide-street" tall="tall-street" from={0} push={0.12} toward={[0.5, 0.7]} strip={{ from: [360, 230, 620], to: [290, 290, 540] }}>
      <Band name="Ada" when="Morning" where="Ojuelegba" naira="₦498,200" age="23 yrs 2 mo" delay={0} />
      <Bubble name="Conductor" x={760} y={760} delay={6} size={40} width={620} tall={{ x: 500, y: 552 }}>
        Na Yaba you dey go? Enter, enter.
      </Bubble>
      <Bubble name="Water seller" mark="W" x={1300} y={700} delay={26} size={40} width={560} tall={{ x: 640, y: 1366, tail: "up", width: 760 }}>
        Cold water, cold one. Buy cold water.
      </Bubble>
      <BigChip tint={TINT.people} delay={44} tall={{ left: 56, top: 1615, tilt: -2 }}>
        Your people.
      </BigChip>
      <Sfx name="crowd.m4a" volume={0.5} />
      <Sfx name="horn.wav" at={18} volume={0.45} />
      <Sfx name="pop.wav" at={7} volume={0.8} />
      <Sfx name="pop.wav" at={27} volume={0.8} />
      <Sfx name="pop.wav" at={45} volume={0.6} />
    </World>
  ) },
  { frames: 80, act: "strip", node: (
    <World clip="wide-day" tall="tall-day" from={110} push={0.05} toward={[0.5, 0.3]} stripFrom={138} stripRate={0.75} strip={{ from: [370, 150, 680], to: [225, 160, 640] }}>
      <Band name="Ada" when="Afternoon" where="The family house" naira="₦2,500,000" age="24 yrs 6 mo" delay={0} />
      <Passbook delay={4} />
      <Bubble name="Ada" x={1180} y={420} delay={34} size={42} width={520} tall={{ x: 540, y: 552 }}>
        Small small, I go reach.
      </Bubble>
      <BigChip tint={TINT.money} delay={54} style={{ left: "auto", right: 60 }} tall={{ left: 690, top: 1600 }}>
        Save up.
      </BigChip>
      <Sfx name="swish.wav" at={4} volume={0.4} />
      <Coins from={12} to={46} />
      <Sfx name="stamp.wav" at={28} volume={0.9} />
      <Sfx name="stamp.wav" at={48} volume={0.9} />
      <Sfx name="pop.wav" at={35} volume={0.8} />
      <Sfx name="pop.wav" at={55} volume={0.6} />
    </World>
  ) },
  { frames: 76, act: "turn", node: (
    <World clip="wide-day" tall="tall-day" from={10} push={0.05} toward={[0.3, 0.5]} strip={{ from: [350, 150, 680], to: [250, 150, 680] }} turnAt={TURN_AT}>
      <Band name="Ada" when="Evening" where="The family house" naira="₦3,120,000" age="25 yrs 1 mo" delay={0} />
      <RouteCard tile="prop_travel-bag" title="Care work in the UK" line="Your papers and a sponsor" tint={TINT.people} top={170} tallTop={1300} delay={2} />
      <RouteCard tile="prop_laptop-desk" title="A master's" line="A school that says yes" tint={TINT.study} top={360} tallTop={1450} delay={8} />
      <RouteCard tile="prop_flight-board" title="The Gulf" line="A job before the flight" tint={TINT.food} top={550} tallTop={1600} delay={14} />
      {CONFETTI.map((bit) => (
        <Bit key={`${String(bit.x)}-${String(bit.y)}`} bit={bit} />
      ))}
      <Place wide={{ left: 90, bottom: 40 }} tall={{ left: 560, top: 380, scale: 0.86 }}>
        <Sticker tile="chr_ada-cheer" size={520} tilt={4} delay={28} />
      </Place>
      <BigChip tint={TINT.study} delay={TURN_AT} style={{ left: 640, bottom: 80 }} tall={{ left: 60, top: 250, still: true }}>
        Find your way out.
      </BigChip>
      <Sfx name="swish.wav" at={2} volume={0.4} />
      <Sfx name="swish.wav" at={8} volume={0.4} />
      <Sfx name="swish.wav" at={14} volume={0.4} />
      <Sfx name="pop.wav" at={21} volume={0.6} />
      <Sfx name="chime.wav" at={28} volume={0.9} />
      <Sfx name="pop.wav" at={31} volume={0.5} />
    </World>
  ) },
  { frames: 78, act: "hand", node: (
    <AbsoluteFill>
      <NightFalls from={0} falls={[6, 30]} />
      <Band name="Ada" when="Night" where="The family house" naira="₦3,120,000" age="25 yrs 2 mo" paint={NIGHT} delay={30} />
      <Bubble name="Ada" x={760} y={700} delay={44} size={42} paint={NIGHT} width={560} tall={{ x: 540, y: 860, width: 800 }}>
        Sleep. The month is done.
      </Bubble>
      <Sfx name="night.m4a" volume={0.5} />
      <Sfx name="swish.wav" at={30} volume={0.4} />
      <Sfx name="pop.wav" at={45} volume={0.7} />
    </AbsoluteFill>
  ) },
  { frames: 86, act: "hand", node: (
    <>
      <Leaving />
      <Sfx name="jet.m4a" at={4} volume={0.5} />
      <Sfx name="swish.wav" at={10} volume={0.4} />
      <Sfx name="pop.wav" at={57} volume={0.7} />
    </>
  ) },
  { frames: 96, act: "end", node: (
    <>
      <LightsOut />
      <Sfx name="pop.wav" at={1} volume={0.6} />
      <Sfx name="click.wav" at={22} volume={1} />
      <Sfx name="click.wav" at={46} volume={1} />
      <Sfx name="swell.wav" at={46} volume={0.9} />
      <Sfx name="pop.wav" at={67} volume={0.6} />
    </>
  ) },
];

export const LEAD_FRAMES = SHOTS.reduce((sum, shot) => sum + shot.frames, 0);
/** The frame the last shot starts on, for the bed to go quiet while the bulbs are off. */
const LIGHTS_AT = LEAD_FRAMES - (SHOTS[SHOTS.length - 1]?.frames ?? 0);

/** Each shot's first frame and act, in order, for a test or a still to find a moment of the cut. */
export const LEAD_SHOTS: readonly { readonly from: number; readonly frames: number; readonly act: Act }[] = SHOTS.map((shot, index) => ({
  from: SHOTS.slice(0, index).reduce((sum, one) => sum + one.frames, 0),
  frames: shot.frames,
  act: shot.act,
}));

/** The two compositions of the one cut, as Root registers them. */
export const LEAD_COMPOSITIONS = {
  Lead: { ...VIDEO, durationInFrames: LEAD_FRAMES },
  LeadPortrait: { ...TALL_VIDEO, durationInFrames: LEAD_FRAMES },
} as const;

/** What a shot's pieces read in the tall frame before a world gives them more: the strip's window, or the whole frame. */
function stageOf(act: Act): Stage {
  return act === "strip" ? { act, box: STRIP, grow: 0, travel: 0 } : { act, box: TALL_FULL, grow: 1, travel: 0 };
}

function Cut({ shape }: { shape: FrameShape }) {
  loadRubik();
  let at = 0;
  return (
    <FrameContext.Provider value={shape}>
      <AbsoluteFill style={{ background: NAVY }}>
        <Audio
          src={staticFile("sound/bed.m4a")}
          volume={(f) => {
            const dark = f >= LIGHTS_AT + 22 && f < LIGHTS_AT + 46 ? 0.12 : 1;
            const tail = interpolate(f, [LEAD_FRAMES - 36, LEAD_FRAMES], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const head = interpolate(f, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            return 0.46 * dark * tail * head;
          }}
        />
        {SHOTS.map((shot, index) => {
          const from = at;
          at += shot.frames;
          // In the hand the world is the whole frame: the window the strip grew into.
          const node =
            shape === "tall" && shot.act === "hand" ? (
              <div data-stage-window="hand" style={{ position: "absolute", left: 0, top: 0, width: TALL_FULL.w, height: TALL_FULL.h, overflow: "hidden" }}>
                {shot.node}
              </div>
            ) : (
              shot.node
            );
          return (
            <Sequence key={String(index)} from={from} durationInFrames={shot.frames}>
              <ActContext.Provider value={shot.act}>
                <StageContext.Provider value={stageOf(shot.act)}>{node}</StageContext.Provider>
              </ActContext.Provider>
            </Sequence>
          );
        })}
      </AbsoluteFill>
    </FrameContext.Provider>
  );
}

/** The teaser as shipped, 1920 by 1080. */
export function Lead() {
  return <Cut shape="wide" />;
}

/** The same cut for a phone's feed, 1080 by 1920: the strip, the turn, the hand and the stacked end card. */
export function LeadPortrait() {
  return <Cut shape="tall" />;
}
