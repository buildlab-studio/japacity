// The lead cut: the game as it feels in the hand. The world's own recordings carry every shot, and the game's pieces live
// inside them: a word bubble over a head in the place's own voice, the band at the top, the brief's chip landing, the
// passbook sliding up over the house, the ways out stacking over the parlour, the night falling, the plane leaving, and
// the seal's two bulbs for the oldest Nigerian joke about leaving. Twenty eight seconds, with sound.
//
// One list of shots draws two films: the landscape one (`Lead`, 1920 by 1080) and the portrait one for a phone's feed
// (`LeadPortrait`, 1080 by 1920). The portrait teaser is the game in the hand from the first shot: every shot of the world
// is the phone's own recording, full frame, and the pieces stand where the game puts them on a phone, each in its zone of
// a feed's frame (parts/zones.tsx): the band under the notch, the bubbles over heads, the beat's words in one big chip
// where the eye rests, the cards under them, and nothing in the feed's own bars at the top and the bottom.
import { type CSSProperties, createContext, type ReactNode, useContext } from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

import type { ClipName } from "../clips";
import { GitHubMark, Seal, Wordmark } from "../parts/brand";
import { Card, Chip, Clip, confetti, PressButton, Sticker, Title } from "../parts/dress";
import { loadRubik } from "../parts/fonts";
import { FrameContext, type FrameShape, useFrameShape } from "../parts/frame";
import { land, pop, ramp } from "../parts/motion";
import { naira } from "../parts/naira";
import { CREAM, DAY, FONT, GREEN, NAVY, NIGHT, type Paint, TINT, YELLOW } from "@japacity/brand";
import { TALL_VIDEO, VIDEO } from "../parts/frame";
import { FEED_BARS, Piece, ZONES } from "../parts/zones";
import { Flight, MapShot, NightFalls } from "../teaser/scenes";

/** Where a shot stands in the portrait teaser: the opening card, the city, the turn, the hand, the end card. */
export type Act = "open" | "city" | "turn" | "hand" | "end";

type Point = readonly [number, number];

const TALL_W = TALL_VIDEO.width;
const TALL_H = TALL_VIDEO.height;
/** The day sky as the phone's recordings carry it, behind a recording drawn higher than the frame's top. */
const RECORDED_SKY = "#eef1f8";
/** The side margin of anything of ours in the tall frame. */
const EDGE = 40;

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/** How a phone's recording stands in the tall frame: its scale over the frame and where its top left corner stands. */
interface Look {
  readonly scale?: number;
  readonly at?: Point;
}

/** The phone's own recording a shot of the world shows in the tall frame, full frame. */
interface TallShot extends Look {
  readonly clip: ClipName;
  readonly from?: number;
  readonly rate?: number;
  /** How much closer the picture eases while the shot rolls, toward a point of the frame. */
  readonly push?: number;
  readonly toward?: Point;
  /** From a frame of the shot on, where the recording cuts to another view, the look that frames that view. */
  readonly after?: Look & { readonly frame: number };
}

/** Where a point of the phone's recording (its own 1080 by 1920 pixels) stands in the tall frame on this frame of the shot. */
type Mapper = (point: Point) => Point;

const PictureContext = createContext<Mapper>((point) => point);

/** A speaker's head in the phone's recording: one place, or places at frames of the shot as the speaker or the view moves. */
type Head = Point | readonly (readonly [number, number, number])[];

function isPoint(head: Head): head is Point {
  return typeof head[0] === "number";
}

function headAt(head: Head, frame: number): Point {
  if (isPoint(head)) return head;
  const first = head[0];
  if (first === undefined) return [TALL_W / 2, TALL_H / 2];
  if (head.length === 1) return [first[1], first[2]];
  const frames = head.map((key) => key[0]);
  const options = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
  return [interpolate(frame, frames, head.map((key) => key[1]), options), interpolate(frame, frames, head.map((key) => key[2]), options)];
}

/** A sticker's entrance from a side of the tall frame, and its leaving to the other, as an offset in pixels. */
function fromSide(frame: number, fps: number, delay: number, side: "left" | "right", leave?: number): number {
  const enter = land(frame, fps, delay, 16);
  const sign = side === "left" ? -1 : 1;
  const gone = leave === undefined ? 0 : ramp(frame, leave, leave + 10);
  return sign * (1 - enter) * 1100 - sign * gone * gone * 1200;
}

/** The tall bubble's measures: the words' size, a line's height, the card above its lines, the tail, the gap over a head. */
const TB = { size: 46, line: 56, head: 100, tail: 24, gap: 12, padX: 30, char: 26, name: 0.72 } as const;

/**
 * The words of a tall bubble laid in lines that fit `cap` letters: one line if it fits, else the two (or three) lines whose
 * longest is shortest, a break after a full stop or a comma counting a little shorter, so a line ends where the sense does.
 */
export function layLines(text: string, cap: number): string[][] {
  const words = text.split(" ");
  const len = (line: readonly string[]) => line.join(" ").length;
  if (len(words) <= cap) return [words];
  const sense = (line: readonly string[]) => (/[.,?!]$/.test(line.at(-1) ?? "") ? 6 : 0);
  let best: { lines: string[][]; score: number } | null = null;
  for (let i = 1; i < words.length; i += 1) {
    const two = [words.slice(0, i), words.slice(i)];
    const longest = Math.max(...two.map(len));
    if (longest <= cap && (best === null || longest - sense(two[0] ?? []) < best.score)) best = { lines: two, score: longest - sense(two[0] ?? []) };
  }
  if (best !== null) return best.lines;
  for (let i = 1; i < words.length - 1; i += 1) {
    for (let j = i + 1; j < words.length; j += 1) {
      const three = [words.slice(0, i), words.slice(i, j), words.slice(j)];
      const longest = Math.max(...three.map(len));
      if (longest <= cap && (best === null || longest < best.score)) best = { lines: three, score: longest };
    }
  }
  if (best === null) throw new Error(`"${text}" does not fit a tall bubble of ${String(cap)} letters a line: widen it.`);
  return best.lines;
}

/** Where a bubble stands in the tall frame: over a head in the phone's recording, and the widest it may grow. */
interface TallBubble {
  readonly head: Head;
  readonly width?: number;
}

/** A bubble over someone's head, as the world draws it: the name pill with the speaker's mark, the words, the tail. */
function Bubble({ name, mark, children, x, y, delay = 0, paint = DAY, size = 40, width = 760, tall }: { name: string; mark?: string; children: string; x: number; y: number; delay?: number; paint?: Paint; size?: number; width?: number; tall: TallBubble }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const map = useContext(PictureContext);
  const p = pop(frame, fps, delay);
  const avatar = (at: number) => (
    <div style={{ flex: "none", width: at * 0.9, height: at * 0.9, borderRadius: 999, background: paint === DAY ? NAVY : CREAM, color: paint === DAY ? CREAM : NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: at * 0.5 }}>{mark ?? name.slice(0, 1)}</div>
  );
  const tail = (left: number | string) => (
    <>
      <div style={{ position: "absolute", left, bottom: -24, width: 0, height: 0, marginLeft: -18, borderLeft: "18px solid transparent", borderRight: "18px solid transparent", borderTop: `22px solid ${paint.edge}` }} />
      <div style={{ position: "absolute", left, bottom: -16, width: 0, height: 0, marginLeft: -13, borderLeft: "13px solid transparent", borderRight: "13px solid transparent", borderTop: `16px solid ${paint.card}` }} />
    </>
  );
  const card: CSSProperties = { position: "relative", boxSizing: "border-box", border: `4px solid ${paint.edge}`, borderRadius: 34, background: paint.card, color: paint.ink, padding: "18px 30px 22px", fontFamily: FONT, boxShadow: "0 16px 30px rgba(19, 26, 51, 0.22)" };
  if (useFrameShape() === "tall") {
    // Laid in lines of known letters, so the bubble's box is known: the test of the feed's zones reads it.
    const most = tall.width ?? 860;
    const lines = layLines(children, Math.floor((most - TB.padX * 2 - 8) / TB.char));
    const longest = Math.max(...lines.map((line) => line.join(" ").length), name.length * TB.name + 3);
    const w = Math.min(most, Math.ceil(longest * TB.char + TB.padX * 2 + 8));
    const cardH = TB.head + TB.line * lines.length;
    const boxH = cardH + TB.tail;
    const tip = map(headAt(tall.head, frame));
    const left = clamp(tip[0] - w / 2, EDGE, TALL_W - EDGE - w);
    const tailX = clamp(tip[0] - left, 54, w - 54);
    let count = 0;
    return (
      <Piece zone="picture" name={`bubble: ${name}`} left={left} top={tip[1] - TB.gap - boxH} width={w} height={boxH} style={{ transformOrigin: `${String(tailX)}px 100%`, transform: `scale(${String(p)})`, opacity: Math.min(1, p * 2) }}>
        <div style={{ ...card, width: w, height: cardH }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, height: 44, marginBottom: 8 }}>
            {avatar(TB.size)}
            <div style={{ fontWeight: 700, fontSize: TB.size * TB.name, color: paint.ink2, whiteSpace: "nowrap" }}>{name}</div>
          </div>
          {lines.map((line, row) => (
            <div key={String(row)} style={{ display: "flex", columnGap: TB.size * 0.27, height: TB.line, lineHeight: `${String(TB.line)}px`, fontWeight: 700, fontSize: TB.size, whiteSpace: "nowrap" }}>
              {line.map((word) => {
                count += 1;
                const w2 = land(frame, fps, delay + count * 2, 10);
                return (
                  <span key={`${word}-${String(count)}`} style={{ display: "inline-block", opacity: w2, transform: `translateX(${String((1 - w2) * -40)}px)` }}>
                    {word}
                  </span>
                );
              })}
            </div>
          ))}
          {tail(tailX - 4)}
        </div>
      </Piece>
    );
  }
  return (
    <div style={{ position: "absolute", left: x, top: y - 24, transform: `translate(-50%, -100%) scale(${String(p)})`, transformOrigin: "50% 100%", opacity: Math.min(1, p * 2), width: "max-content", maxWidth: width }}>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
          {avatar(size)}
          <div style={{ fontWeight: 700, fontSize: size * 0.72, color: paint.ink2 }}>{name}</div>
        </div>
        <div style={{ fontWeight: 700, fontSize: size, lineHeight: 1.2 }}>{children}</div>
        {tail("50%")}
      </div>
    </div>
  );
}

/** The band in the tall frame: the game's band at a phone's scale, as tall as its zone. */
const TALL_BAND = { scale: 0.88 } as const;

/** The band at the top of the world: who, when, where, and what is in the pocket. */
function Band({ name, when, where, money, age = "23 yrs 1 mo", paint = DAY, delay = 0 }: { name: string; when: string; where: string; money: string; age?: string; paint?: Paint; delay?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = land(frame, fps, delay, 14);
  const band = (
    <Card paint={paint} style={{ display: "flex", alignItems: "center", gap: 26, padding: "16px 28px", borderRadius: 999 }}>
      <div style={{ width: 70, height: 70, borderRadius: 999, background: paint === DAY ? DAY.skyDeep : "#2f3f7a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>{paint === DAY ? "☀️" : "🌙"}</div>
      <div style={{ fontFamily: FONT, lineHeight: 1.1 }}>
        <div style={{ fontWeight: 700, fontSize: 40 }}>
          {name} <span style={{ color: paint.ink2, fontWeight: 500 }}>· {when}</span>
        </div>
        <div style={{ fontWeight: 500, fontSize: 28, color: paint.ink2 }}>{age} · {where}</div>
      </div>
      <div style={{ marginLeft: "auto", fontFamily: FONT, fontWeight: 700, fontSize: 42, color: paint === DAY ? GREEN : "#8fe3b0", background: paint === DAY ? TINT.money : "#1f4a3a", borderRadius: 999, padding: "10px 30px" }}>{money}</div>
    </Card>
  );
  if (useFrameShape() === "tall") {
    // It settles in place under the notch rather than dropping from above, where the phone's own bar stands.
    const [top, bottom] = ZONES.band;
    const width = TALL_W - EDGE * 2;
    return (
      <Piece zone="band" name="band" left={EDGE} top={top} width={width} height={bottom - top} style={{ opacity: p, transform: `scale(${String(0.94 + 0.06 * p)})` }}>
        <div style={{ width: width / TALL_BAND.scale, transformOrigin: "0 0", transform: `scale(${String(TALL_BAND.scale)})` }}>{band}</div>
      </Piece>
    );
  }
  return <div style={{ position: "absolute", left: 40, right: 40, top: 32, transform: `translateY(${String((1 - p) * -160)}px)` }}>{band}</div>;
}

/** The brief's chip, as the hand hands it: the sticker, the words, the dots of its steps. */
function BriefChip({ tile, children, delay = 0, paint = DAY }: { tile: string; children: ReactNode; delay?: number; paint?: Paint }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = land(frame, fps, delay, 16);
  const chip = (
    <Card paint={paint} style={{ display: "flex", alignItems: "center", gap: 20, padding: "14px 32px 14px 18px", borderRadius: 999 }}>
      <Sticker tile={tile} size={78} delay={delay + 4} edge={5} />
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 40 }}>{children}</div>
      <div style={{ display: "flex", gap: 8, marginLeft: 8 }}>
        {[YELLOW, paint.ink2, paint.ink2, paint.ink2].map((color, index) => (
          <div key={String(index)} style={{ width: 18, height: 18, borderRadius: 999, background: color, opacity: index === 0 ? 1 : 0.35 }} />
        ))}
      </div>
    </Card>
  );
  if (useFrameShape() === "tall") {
    return (
      <Piece zone="cards" name="brief" left={EDGE} top={1210} width={TALL_W - EDGE * 2} height={120} style={{ display: "flex", alignItems: "center", justifyContent: "center", transform: `translateX(${String(fromSide(frame, fps, delay, "left"))}px)` }}>
        {chip}
      </Piece>
    );
  }
  return <div style={{ position: "absolute", left: 40, top: 40, transform: `translateX(${String((1 - p) * -700)}px)` }}>{chip}</div>;
}

/**
 * A big tilted sticker chip of two or three words, the trailer's title, standing in a corner of the world. In the tall frame
 * it is the beat's words, one chip centred where a viewer's eye rests, springing up from under its place; or, given a
 * `top`, it stands in the picture (the turn's chip over the house).
 */
function BigChip({ children, tint, delay = 0, tilt = -4, style, tall = {} }: { children: string; tint: string; delay?: number; tilt?: number; style?: CSSProperties; tall?: { top?: number; tilt?: number } }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (useFrameShape() === "tall") {
    const p = land(frame, fps, delay, 12);
    const inPicture = tall.top !== undefined;
    const top = tall.top ?? ZONES.words[0];
    const height = inPicture ? 180 : ZONES.words[1] - ZONES.words[0];
    return (
      <Piece zone={inPicture ? "picture" : "words"} name={`chip: ${children}`} left={EDGE} top={top} width={TALL_W - EDGE * 2} height={height} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: inPicture ? undefined : `translateY(${String((1 - p) * 24)}px)` }}>
          <Chip tint={tint} tilt={tall.tilt ?? -2} delay={delay} size={74}>
            {children}
          </Chip>
        </div>
      </Piece>
    );
  }
  return (
    <div style={{ position: "absolute", left: 60, bottom: 70, ...style }}>
      <Chip tint={tint} tilt={tilt} delay={delay} size={84}>
        {children}
      </Chip>
    </div>
  );
}

interface WorldProps {
  readonly clip: "wide-ride" | "wide-street" | "wide-makoko" | "wide-day" | "wide-sofa" | "wide-night";
  readonly from?: number;
  readonly rate?: number;
  readonly push?: number;
  readonly toward?: readonly [number, number];
  /** The phone's recording of the same moment, which the tall frame shows full frame. */
  readonly tall: TallShot;
  readonly children?: ReactNode;
}

/** A recording of the world: the wide one pushed in slowly toward a point, or in the tall frame the phone's own, full frame. */
function World(props: WorldProps) {
  return useFrameShape() === "tall" ? <TallWorld {...props} /> : <WideWorld {...props} />;
}

function WideWorld({ clip, from = 0, rate = 1, push = 0.06, toward = [0.5, 0.5], children }: WorldProps) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = ramp(frame, 0, durationInFrames);
  return (
    <AbsoluteFill style={{ background: NAVY, overflow: "hidden" }}>
      <AbsoluteFill style={{ transformOrigin: `${String(toward[0] * 100)}% ${String(toward[1] * 100)}%`, transform: `scale(${String(1 + push * t)})` }}>
        <Clip name={clip} from={from} rate={rate} />
      </AbsoluteFill>
      {children}
    </AbsoluteFill>
  );
}

/**
 * The world in the tall frame: the phone's own recording of the moment over the whole frame, at its look (scaled up and
 * moved where the view puts its people low, the frame never left bare), eased a little closer while it rolls. The pieces
 * inside read where a point of the recording stands, so a bubble's tail stays on its speaker's head.
 */
function TallWorld({ tall, children }: WorldProps) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = ramp(frame, 0, durationInFrames);
  const look = tall.after !== undefined && frame >= tall.after.frame ? tall.after : tall;
  const scale = look.scale ?? 1;
  const at = look.at ?? [0, 0];
  const toward = tall.toward ?? [TALL_W / 2, TALL_H / 2];
  const k = 1 + (tall.push ?? 0.04) * t;
  const map: Mapper = (point) => [toward[0] + (at[0] + point[0] * scale - toward[0]) * k, toward[1] + (at[1] + point[1] * scale - toward[1]) * k];
  return (
    <AbsoluteFill style={{ background: RECORDED_SKY, overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, transformOrigin: `${String(toward[0])}px ${String(toward[1])}px`, transform: `scale(${String(k)})` }}>
        <div data-picture={tall.clip} style={{ position: "absolute", left: at[0], top: at[1], width: TALL_W * scale, height: TALL_H * scale }}>
          <Clip name={tall.clip} from={tall.from ?? 0} rate={tall.rate ?? 1} />
        </div>
      </div>
      <PictureContext.Provider value={map}>{children}</PictureContext.Provider>
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

/** The passbook's measures, so its box in the tall frame is known: its width, its height, and its scale there. */
const PASSBOOK = { width: 760, height: 490, tall: 0.8 } as const;

/**
 * The passbook sliding up over the house, counting, its stamps landing as Mama hears. In the tall frame it comes in from
 * the left under the house and, its second stamp landed, goes off to the right for the beat's words.
 */
function Passbook({ delay = 0 }: { delay?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const tall = useFrameShape() === "tall";
  const card = land(frame, fps, delay, 16);
  const counted = ramp(frame, delay + 6, delay + 44);
  const eased = 1 - (1 - counted) * (1 - counted);
  const amount = Math.round((eased * 2_500_000) / 10_000) * 10_000;
  const book = (
    <Card style={{ boxSizing: "border-box", width: PASSBOOK.width, height: PASSBOOK.height, padding: 36, fontFamily: FONT }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, height: 66 }}>
        <div style={{ width: 66, height: 66, borderRadius: 20, background: GREEN, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, fontWeight: 700 }}>₦</div>
        <div style={{ fontWeight: 700, fontSize: 46 }}>Bank</div>
        <div style={{ marginLeft: "auto" }}>
          <Chip tint={TINT.plain} delay={delay + 14} size={26}>
            Next stamp ₦5m
          </Chip>
        </div>
      </div>
      <div style={{ marginTop: 22, height: 34, lineHeight: "34px", fontWeight: 500, fontSize: 28, color: DAY.ink2 }}>Held for the road</div>
      <div style={{ height: 110, lineHeight: "110px", fontWeight: 700, fontSize: 96, letterSpacing: -2, fontVariantNumeric: "tabular-nums", color: DAY.ink }}>{naira(amount)}</div>
      <div style={{ marginTop: 14, height: 22, borderRadius: 99, background: DAY.skyDeep, overflow: "hidden" }}>
        <div style={{ width: `${String(eased * 50)}%`, height: "100%", borderRadius: 99, background: GREEN }} />
      </div>
      <div style={{ marginTop: 26, display: "flex", gap: 26 }}>
        <Stamp label="₦1m" delay={delay + 24} />
        <Stamp label="₦2.5m" delay={delay + 44} />
        <Stamp label="₦5m" delay={9999} />
      </div>
    </Card>
  );
  if (tall) {
    const width = PASSBOOK.width * PASSBOOK.tall;
    return (
      <Piece zone="cards" name="passbook" left={(TALL_W - width) / 2} top={1060} width={width} height={PASSBOOK.height * PASSBOOK.tall} style={{ transform: `translateX(${String(fromSide(frame, fps, delay, "left", delay + 46))}px) rotate(${String(-2 * card)}deg)` }}>
        <div style={{ transformOrigin: "0 0", transform: `scale(${String(PASSBOOK.tall)})` }}>{book}</div>
      </Piece>
    );
  }
  return <div style={{ position: "absolute", left: 90, bottom: 60, transform: `translateY(${String((1 - card) * 900)}px) rotate(${String(-3 * card)}deg)` }}>{book}</div>;
}

/**
 * A way out's card at each frame's measures: in the wide frame the four stand down the right; in the tall one they stand
 * wider and lower, four in the cards' zone, their titles still big enough to read on a phone.
 */
const ROUTE = {
  wide: { width: 640, height: 150, tile: 108, title: 42, line: 27, pad: 18, gap: 22 },
  tall: { width: 920, height: 120, tile: 96, title: 42, line: 28, pad: 12, gap: 26 },
} as const;

function RouteCard({ tile, title, line, tint, top, tallTop, delay }: { tile: string; title: string; line: string; tint: string; top: number; tallTop: number; delay: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = land(frame, fps, delay, 16);
  const tall = useFrameShape() === "tall";
  const size = tall ? ROUTE.tall : ROUTE.wide;
  const card = (
    <Card style={{ boxSizing: "border-box", width: size.width, height: size.height, padding: size.pad, display: "flex", alignItems: "center", gap: size.gap }}>
      <div style={{ flex: "none", width: size.tile, height: size.tile, borderRadius: 24, background: tint, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Sticker tile={tile} size={Math.round(size.tile * 0.86)} delay={delay + 4} edge={5} />
      </div>
      <div style={{ fontFamily: FONT, lineHeight: 1.15, whiteSpace: "nowrap" }}>
        <div style={{ fontWeight: 700, fontSize: size.title }}>{title}</div>
        <div style={{ fontWeight: 500, fontSize: size.line, color: DAY.ink2, marginTop: 2 }}>{line}</div>
      </div>
    </Card>
  );
  if (tall) {
    return (
      <Piece zone="cards" name={`way out: ${title}`} left={(TALL_W - size.width) / 2} top={tallTop} width={size.width} height={size.height} style={{ transform: `translateX(${String((1 - p) * 1000)}px) rotate(${String((1 - p) * 6)}deg)` }}>
        {card}
      </Piece>
    );
  }
  return <div style={{ position: "absolute", right: 70, top, transform: `translateX(${String((1 - p) * 1200)}px) rotate(${String((1 - p) * 6)}deg)` }}>{card}</div>;
}

/** The bits that fly when the ways out land: where each stands in the wide frame, and round Ada in the tall one. */
const CONFETTI = [
  { x: 1130, y: 170, tx: 600, ty: 600, c: "#f2b705", r: -20, d: 30 },
  { x: 980, y: 250, tx: 990, ty: 590, c: "#c2185b", r: 25, d: 32 },
  { x: 1120, y: 420, tx: 580, ty: 900, c: "#2a8656", r: 40, d: 34 },
  { x: 1150, y: 660, tx: 1000, ty: 880, c: "#2c3f87", r: -35, d: 31 },
  { x: 840, y: 190, tx: 830, ty: 540, c: "#d4602e", r: 10, d: 33 },
];

function Bit({ bit }: { bit: (typeof CONFETTI)[number] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = pop(frame, fps, bit.d);
  const style = confetti(bit.c, bit.r, p, { width: 40, height: 20, rise: 160 });
  if (useFrameShape() === "tall") {
    return (
      <Piece zone="picture" name="confetti" left={bit.tx} top={bit.ty} width={40} height={20}>
        <div style={style} />
      </Piece>
    );
  }
  return <div style={{ position: "absolute", left: bit.x, top: bit.y, ...style }} />;
}

/** Ada cheering as the ways out land: in a corner of the wide frame, and over the house in the tall one. */
function Cheer() {
  const sticker = <Sticker tile="person_ada-cheer" size={520} tilt={4} delay={28} />;
  if (useFrameShape() === "tall") {
    const size = 440;
    return (
      <Piece zone="picture" name="Ada cheering" left={600} top={560} width={size} height={size}>
        <div style={{ transformOrigin: "0 0", transform: `scale(${String(size / 520)})` }}>{sticker}</div>
      </Piece>
    );
  }
  return <div style={{ position: "absolute", left: 90, bottom: 40 }}>{sticker}</div>;
}

/** The end cards' last line: the game costs nothing and its making is open to read, on GitHub. */
export const END_LINE = "Free. Open source on GitHub.";

/** The last line with GitHub's mark before it, the mark as tall as the line's letters and the smallest thing on the card. */
function OpenLine({ size, opacity }: { size: number; opacity: number }) {
  return (
    <div data-end-line style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: size * 0.4, fontFamily: FONT, fontWeight: 500, fontSize: size, lineHeight: 1.2, color: NIGHT.ink2, opacity }}>
      <GitHubMark height={Math.round(size * 0.8)} color={CREAM} />
      <span>{END_LINE}</span>
    </div>
  );
}

/** The tall end card's stack, centred in a box clear of the feed's bars. */
const TALL_END = { top: 320, height: 1200 } as const;

/**
 * The oldest Nigerian joke about leaving, then the seal: its two bulbs click off one after the other, and come back on with the
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
      <AbsoluteFill style={{ background: click ? "#0b1130" : NIGHT.sky, fontFamily: FONT, textAlign: "center" }}>
        <Piece zone="safe" name="end card" left={0} top={TALL_END.top} width={TALL_W} height={TALL_END.height} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ transform: `scale(${String(seal)}) rotate(${String((1 - seal) * -30)}deg)`, opacity: click ? 0.55 : 1 }}>
            <Seal size={330} glow={glow} id="lead-end-tall" />
          </div>
          <div style={{ marginTop: 56, opacity: name, transform: `translateY(${String((1 - name) * 50)}px)` }}>
            <Wordmark height={160} color={CREAM} />
          </div>
          <div style={{ marginTop: 90, display: "flex", flexDirection: "column", alignItems: "center", gap: 44, transform: `scale(${String(button)})` }}>
            <PressButton size={66} paint={NIGHT}>
              Play it
            </PressButton>
            <div style={{ fontWeight: 700, fontSize: 66, color: CREAM }}>japacity.app</div>
          </div>
          <div style={{ marginTop: 44, fontWeight: 500, fontSize: 46, lineHeight: 1.3, color: NIGHT.ink2, opacity: button }}>
            Japa is not by force.
            <br />
            How ready are you?
          </div>
          <div style={{ marginTop: 30 }}>
            <OpenLine size={34} opacity={button * 0.85} />
          </div>
        </Piece>
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
        <PressButton size={62} paint={NIGHT}>
          Play it
        </PressButton>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 58, color: CREAM }}>japacity.app</div>
      </div>
      <div style={{ marginTop: 40, fontFamily: FONT, fontWeight: 500, fontSize: 40, color: NIGHT.ink2, opacity: button }}>Japa is not by force. How ready are you?</div>
      <div style={{ marginTop: 20 }}>
        <OpenLine size={30} opacity={button * 0.85} />
      </div>
    </AbsoluteFill>
  );
}

/** The flight with the joke written over the lagoon. */
function Leaving() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = land(frame, fps, 10, 14);
  const joke = (
    <Card paint={NIGHT} style={{ padding: "26px 44px", borderRadius: 40, boxShadow: `0 0 0 8px ${CREAM}, 0 24px 40px rgba(0, 0, 0, 0.35)` }}>
      <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 64, lineHeight: 1.15, color: CREAM }}>
        Last person out,
        <br />
        switch off the light.
      </div>
    </Card>
  );
  return (
    <AbsoluteFill>
      <Flight city="London" tile="building_rye-lane-terrace_a" />
      {useFrameShape() === "tall" ? (
        // From the left over the lagoon, low but clear of the feed's caption.
        <Piece zone="safe" name="the joke" left={60} top={1310} height={210} style={{ transform: `translateX(${String((1 - p) * -900)}px)`, opacity: p }}>
          {joke}
        </Piece>
      ) : (
        <div style={{ position: "absolute", left: 80, bottom: 90, transform: `translateY(${String((1 - p) * 200)}px)`, opacity: p }}>{joke}</div>
      )}
    </AbsoluteFill>
  );
}

/** The opening, as the door introduces a life: the painted city, Ada herself, her card, and the game's own hook. */
function MeetAda() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = land(frame, fps, 14, 16);
  if (useFrameShape() === "tall") {
    // Stacked for the phone: her card and the hook in the top half on the day sky, Ada herself standing in the lower half,
    // her feet on the feed's caption line. Her card comes in from the left, never down through the phone's own bar.
    const ada = { left: 380, size: 700 };
    return (
      <AbsoluteFill>
        <MapShot paint="day" zoom={[1.0, 1.18]} toward={[0.42, 0.4]} />
        <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(234, 243, 251, 0.95) 0%, rgba(234, 243, 251, 0.88) 52%, rgba(234, 243, 251, 0.45) 100%)" }} />
        <Piece zone="safe" name="Ada" left={ada.left} top={FEED_BARS.bottom - ada.size} width={ada.size} height={ada.size}>
          <Sticker tile="person_ada-figure" size={ada.size} tilt={-2} delay={4} edge={10} />
        </Piece>
        <Piece zone="safe" name="her card" left={56} top={250} height={150} style={{ transform: `translateX(${String((1 - card) * -160)}px) rotate(${String(-3 * card)}deg)`, opacity: card }}>
          <Card style={{ display: "flex", alignItems: "center", gap: 24, padding: "18px 40px 18px 22px", borderRadius: 999 }}>
            <Sticker tile="person_ada-face" size={104} delay={18} edge={5} />
            <div style={{ fontFamily: FONT, lineHeight: 1.1 }}>
              <div style={{ fontWeight: 700, fontSize: 54 }}>Ada</div>
              <div style={{ fontWeight: 500, fontSize: 31, color: DAY.ink2 }}>23 yrs · The nurse · Surulere, Lagos</div>
            </div>
          </Card>
        </Piece>
        {/* The hook broken by sense, two words a line or three, each line springing on from the one before. */}
        <Piece zone="safe" name="the hook" left={64} top={440} width={960} height={600}>
          <Title words="Japa is not" size={128} align="left" delay={28} gap={2} />
          <Title words="by force." size={128} align="left" delay={34} gap={2} />
          <div style={{ marginTop: 14 }}>
            <Title words="How ready" size={128} align="left" delay={52} gap={2} />
            <Title words="are you?" size={128} align="left" delay={56} gap={2} />
          </div>
        </Piece>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill>
      <MapShot paint="day" zoom={[1.0, 1.22]} toward={[0.42, 0.4]} />
      <AbsoluteFill style={{ background: "linear-gradient(to right, rgba(234, 243, 251, 0.94) 0%, rgba(234, 243, 251, 0.84) 60%, rgba(234, 243, 251, 0.4) 100%)" }} />
      <div style={{ position: "absolute", left: 90, bottom: 0 }}>
        <Sticker tile="person_ada-figure" size={760} tilt={-2} delay={4} edge={10} />
      </div>
      <div style={{ position: "absolute", left: 640, top: 150, transform: `translateY(${String((1 - card) * -120)}px) rotate(${String(-3 * card)}deg)`, opacity: card }}>
        <Card style={{ display: "flex", alignItems: "center", gap: 26, padding: "18px 40px 18px 22px", borderRadius: 999 }}>
          <Sticker tile="person_ada-face" size={110} delay={18} edge={5} />
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
  /** Where the shot stands in the portrait teaser. */
  readonly act: Act;
  readonly node: ReactNode;
}

/** The family house by day in the tall frame: drawn higher, so the cards stand on the sky under it. */
const HOUSE_UP: Point = [0, -150];

/**
 * The cut, as frames at 30 a second, for both frames. A world's `tall` is the phone's recording of the same moment and
 * how it stands; a bubble's `tall` is its speaker's head in that recording (at frames of the shot where either moves).
 */
const SHOTS: readonly Shot[] = [
  { frames: 96, act: "open", node: (
    <>
      <MeetAda />
      <Sfx name="pop.wav" at={6} volume={0.7} />
      <Sfx name="swish.wav" at={14} volume={0.4} />
      <Sfx name="pop.wav" at={20} volume={0.5} />
      <Sfx name="swish.wav" at={28} volume={0.4} />
      <Sfx name="swish.wav" at={52} volume={0.4} />
    </>
  ) },
  { frames: 44, act: "city", node: (
    // The danfo alongside, then from above, where the phone's view puts it low: that view drawn larger and higher.
    <World clip="wide-ride" from={30} push={0.08} tall={{ clip: "tall-ride", from: 5, after: { frame: 26, scale: 1.4, at: [-150, -768] } }}>
      <Bubble name="Conductor" x={900} y={720} delay={6} size={44} tall={{ head: [[25, 440, 690], [26, 470, 1350]], width: 840 }}>
        Oshodi, Oshodi. Enter with your change o.
      </Bubble>
      <Sfx name="engine.m4a" volume={0.38} />
      <Sfx name="horn.wav" at={3} volume={0.8} />
      <Sfx name="pop.wav" at={7} volume={0.8} />
    </World>
  ) },
  { frames: 40, act: "city", node: (
    <World clip="wide-ride" from={137} rate={0.97} push={0.05} tall={{ clip: "tall-ride", from: 124, rate: 0.96, push: 0.03 }}>
      <Bubble name="Ada" x={1250} y={345} delay={4} size={44} width={720} tall={{ head: [1040, 690], width: 760 }}>
        Who get change for one thousand?
      </Bubble>
      <BigChip tint={TINT.food} delay={14} tilt={-5}>
        Danfo ₦300
      </BigChip>
      <Sfx name="engine.m4a" volume={0.34} from={44} />
      <Sfx name="pop.wav" at={5} volume={0.8} />
      <Sfx name="pop.wav" at={15} volume={0.6} />
    </World>
  ) },
  { frames: 42, act: "city", node: (
    // Makoko by morning, another life the door can start: the homes on stilts over the lagoon, the plank walk, the canoes;
    // in the tall frame drawn a little closer round the fish racks, the bridge under the band.
    <World clip="wide-makoko" from={6} push={0.08} toward={[0.48, 0.52]} tall={{ clip: "tall-makoko", from: 6, scale: 1.12, at: [-60, -118], push: 0.04, toward: [495, 975] }}>
      <Band name="Bisi" when="Morning" where="Makoko" money="₦500,000" age="21 yrs 1 mo" delay={0} />
      <Bubble name="Fish seller" mark="F" x={919} y={556} delay={6} size={42} width={780} tall={{ head: [495, 975], width: 760 }}>
        Fish don ready! Come buy o.
      </Bubble>
      <Sfx name="crowd.m4a" volume={0.4} />
      <Sfx name="pop.wav" at={7} volume={0.8} />
    </World>
  ) },
  { frames: 78, act: "city", node: (
    <World clip="wide-day" from={40} push={0.05} toward={[0.4, 0.3]} tall={{ clip: "tall-day", from: 40, at: HOUSE_UP, push: 0.03, toward: [540, 700] }}>
      <Bubble name="Mama" x={1018} y={550} delay={24} size={42} width={700} tall={{ head: [572, 965], width: 860 }}>
        Your uncle called. When are you going?
      </Bubble>
      <BriefChip tile="prop_travel-bag" delay={40}>
        Papers, abeg
      </BriefChip>
      <Sfx name="pop.wav" at={25} volume={0.8} />
      <Sfx name="swish.wav" at={40} volume={0.4} />
      <Sfx name="pop.wav" at={45} volume={0.5} />
    </World>
  ) },
  { frames: 66, act: "city", node: (
    <World clip="wide-sofa" from={40} push={0.14} toward={[0.4, 0.45]} tall={{ clip: "tall-sofa", from: 40, push: 0.08, toward: [640, 880] }}>
      <Band name="Ada" when="Evening" where="The family house" money="₦498,500" age="23 yrs 1 mo" delay={0} />
      <Bubble name="Ada" x={1150} y={525} delay={30} size={42} width={620} tall={{ head: [[30, 640, 905], [48, 640, 905], [62, 780, 850]], width: 760 }}>
        Small rest, then I go hustle.
      </Bubble>
      <BigChip tint={TINT.body} delay={8}>
        One month at a time.
      </BigChip>
      <Sfx name="pop.wav" at={9} volume={0.7} />
      <Sfx name="pop.wav" at={31} volume={0.8} />
    </World>
  ) },
  { frames: 68, act: "city", node: (
    // The street seen from above, its people low in the phone's view: drawn larger and higher, its empty road under the bars.
    <World clip="wide-street" from={0} push={0.12} toward={[0.5, 0.7]} tall={{ clip: "tall-street", from: 0, scale: 1.3, at: [-60, -576], push: 0.05, toward: [420, 900] }}>
      <Band name="Ada" when="Morning" where="Ojuelegba" money="₦498,200" age="23 yrs 2 mo" delay={0} />
      <Bubble name="Conductor" x={1200} y={700} delay={6} size={40} width={620} tall={{ head: [262, 1048], width: 760 }}>
        Na Yaba you dey go? Enter, enter.
      </Bubble>
      <Bubble name="Water seller" mark="W" x={615} y={718} delay={26} size={40} width={540} tall={{ head: [456, 1290], width: 760 }}>
        Cold water, cold one. Buy cold water.
      </Bubble>
      <BigChip tint={TINT.people} delay={44}>
        Your people.
      </BigChip>
      <Sfx name="crowd.m4a" volume={0.5} />
      <Sfx name="horn.wav" at={18} volume={0.45} />
      <Sfx name="pop.wav" at={7} volume={0.8} />
      <Sfx name="pop.wav" at={27} volume={0.8} />
      <Sfx name="pop.wav" at={45} volume={0.6} />
    </World>
  ) },
  { frames: 76, act: "city", node: (
    <World clip="wide-day" from={68} rate={0.78} push={0.05} toward={[0.5, 0.3]} tall={{ clip: "tall-day", from: 110, at: [0, -130], push: 0.03, toward: [540, 700] }}>
      <Band name="Ada" when="Afternoon" where="The family house" money="₦2,500,000" age="24 yrs 6 mo" delay={0} />
      <Passbook delay={4} />
      <Bubble name="Ada" x={415} y={330} delay={34} size={42} width={660} tall={{ head: [641, 664], width: 760 }}>
        Small small, I go reach.
      </Bubble>
      <BigChip tint={TINT.money} delay={54} style={{ left: "auto", right: 60 }}>
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
    <World clip="wide-day" from={10} push={0.05} toward={[0.3, 0.5]} tall={{ clip: "tall-day", from: 10, at: HOUSE_UP, push: 0.04, toward: [540, 700] }}>
      <Band name="Ada" when="Evening" where="The family house" money="₦3,120,000" age="25 yrs 1 mo" delay={0} />
      <RouteCard tile="prop_papers-box" title="A master's in the UK" line="A school that says yes" tint={TINT.money} top={166} tallTop={1006} delay={2} />
      <RouteCard tile="prop_laptop-desk" title="A tech job abroad" line="A company that sponsors you" tint={TINT.study} top={332} tallTop={1142} delay={8} />
      <RouteCard tile="prop_travel-bag" title="Health care in the UK" line="Your registration and a sponsor" tint={TINT.people} top={498} tallTop={1278} delay={14} />
      <RouteCard tile="prop_flight-board" title="The Gulf" line="A job before the flight" tint={TINT.food} top={664} tallTop={1414} delay={20} />
      {CONFETTI.map((bit) => (
        <Bit key={`${String(bit.x)}-${String(bit.y)}`} bit={bit} />
      ))}
      <Cheer />
      <BigChip tint={TINT.study} delay={24} style={{ left: 640, bottom: 80 }} tall={{ top: 340, tilt: -3 }}>
        Find your way out.
      </BigChip>
      <Sfx name="swish.wav" at={2} volume={0.4} />
      <Sfx name="swish.wav" at={8} volume={0.4} />
      <Sfx name="swish.wav" at={14} volume={0.4} />
      <Sfx name="swish.wav" at={20} volume={0.4} />
      <Sfx name="pop.wav" at={25} volume={0.6} />
      <Sfx name="chime.wav" at={28} volume={0.9} />
      <Sfx name="pop.wav" at={31} volume={0.5} />
    </World>
  ) },
  { frames: 78, act: "hand", node: (
    <AbsoluteFill>
      <NightFalls from={49} falls={[6, 30]} />
      <Band name="Ada" when="Night" where="The family house" money="₦3,120,000" age="25 yrs 2 mo" paint={NIGHT} delay={30} />
      <Bubble name="Ada" x={430} y={372} delay={44} size={42} paint={NIGHT} width={620} tall={{ head: [150, 830], width: 760 }}>
        Sleep. The month is done.
      </Bubble>
      <Sfx name="night.m4a" volume={0.5} />
      <Sfx name="swish.wav" at={30} volume={0.4} />
      <Sfx name="pop.wav" at={45} volume={0.7} />
    </AbsoluteFill>
  ) },
  { frames: 80, act: "hand", node: (
    <>
      <Leaving />
      <Sfx name="jet.m4a" at={4} volume={0.5} />
      <Sfx name="swish.wav" at={10} volume={0.4} />
      <Sfx name="pop.wav" at={51} volume={0.7} />
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

/**
 * A mock of a phone feed's own bars over the portrait teaser, for a still that shows what they cover: the status bar and
 * the feed's header at the top, the caption, the buttons and the progress at the bottom. Generic shapes, no real app.
 */
function FeedBars() {
  const shade = "rgba(8, 10, 20, 0.62)";
  const line = (width: number, top: number, left = 44, height = 26) => <div style={{ position: "absolute", left, top, width, height, borderRadius: 99, background: "rgba(255, 255, 255, 0.78)" }} />;
  return (
    <AbsoluteFill style={{ pointerEvents: "none", fontFamily: FONT, color: "#fff" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width: TALL_W, height: FEED_BARS.top, background: shade, borderBottom: "4px dashed rgba(255, 255, 255, 0.9)" }}>
        <div style={{ position: "absolute", left: 60, top: 34, fontSize: 40, fontWeight: 700 }}>9:41</div>
        {line(120, 46, 880, 24)}
        <div style={{ position: "absolute", left: 0, right: 0, top: 128, display: "flex", justifyContent: "center", gap: 60, fontSize: 40, fontWeight: 700 }}>
          <span style={{ opacity: 0.6 }}>Following</span>
          <span>For you</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, top: FEED_BARS.bottom, width: TALL_W, height: TALL_H - FEED_BARS.bottom, background: shade, borderTop: "4px dashed rgba(255, 255, 255, 0.9)" }}>
        <div style={{ position: "absolute", left: 44, top: 34, fontSize: 40, fontWeight: 700 }}>@japacity</div>
        {line(760, 100)}
        {line(520, 144)}
        {line(TALL_W - 88, 214, 44, 8)}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 34, display: "flex", justifyContent: "space-around" }}>
          {[0, 1, 2, 3, 4].map((at) => (
            <div key={String(at)} style={{ width: 64, height: 64, borderRadius: 20, border: "5px solid rgba(255, 255, 255, 0.8)" }} />
          ))}
        </div>
      </div>
    </AbsoluteFill>
  );
}

function Cut({ shape, feed = false }: { shape: FrameShape; feed?: boolean }) {
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
          return (
            <Sequence key={String(index)} from={from} durationInFrames={shot.frames}>
              {shot.node}
            </Sequence>
          );
        })}
        {feed && shape === "tall" ? <FeedBars /> : null}
      </AbsoluteFill>
    </FrameContext.Provider>
  );
}

/** The teaser as shipped, 1920 by 1080. */
export function Lead() {
  return <Cut shape="wide" />;
}

/** The same cut for a phone's feed, 1080 by 1920: the game in the hand, full frame. `feed` draws a feed's bars over it. */
export function LeadPortrait({ feed = false }: { feed?: boolean }) {
  return <Cut shape="tall" feed={feed} />;
}
