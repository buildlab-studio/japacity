// The deck cut: a deck of the life's cards on the left of the pale sky and one caption on the right
// that changes with it; then the front card's picture grows on a firm spring until it fills the frame and is the game's own
// world (the family house turning), and the world shrinks back into the next card (the Bank counting) with a sticker chip
// riding along. The night house grows out of the deck the same way, and the night shrinks into the seal for the name.
// Ten seconds, built from the dress (design page 13) and the wide recordings already under apps/teaser/clips.
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";

import type { ClipName } from "../clips";
import { Seal, Wordmark } from "../parts/brand";
import { Chip, Clip, PressButton, Sticker, Title } from "../parts/dress";
import { loadRubik } from "../parts/fonts";
import { land, pop, ramp } from "../parts/motion";
import { naira } from "../parts/naira";
import { CREAM, DAY, FONT, GREEN, NAVY, NIGHT, TINT } from "@japacity/brand";

export const DECK_FRAMES = 300;

/** The recorded clips the cut shows, and the frame span each is on screen, so a test can mount it there. */
export const DECK_CLIPS: readonly { readonly name: ClipName; readonly from: number; readonly to: number }[] = [
  { name: "wide-day", from: 50, to: 160 },
  { name: "wide-night", from: 208, to: 274 },
];

/** The beats, in frames: when a card leaves, when a picture grows to the frame and when the frame shrinks back. */
const T = {
  livesOut: 50,
  homeGrow: 88,
  homeShrink: 146,
  bankOut: 208,
  nightGrow: 222,
  sealShrink: 252,
  nightPaint: 244,
  name: 266,
  play: 278,
} as const;
const GROW_FRAMES = 20;
const SHRINK_FRAMES = 22;

// The deck: a card of the door's stacked homes at a trailer's scale, its picture above a strip with the card's name.
const DECK = { x: 540, y: 560, tilt: -2 } as const;
const CARD = { w: 720, h: 660, pad: 24, strip: 132 } as const;
const PIC = { w: CARD.w - CARD.pad * 2, h: CARD.h - CARD.pad - CARD.strip, radius: 26 } as const;
const PIC_DY = -CARD.h / 2 + CARD.pad + PIC.h / 2;

interface Pose {
  readonly x: number;
  readonly y: number;
  readonly rot: number;
  readonly scale: number;
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly rot: number;
  readonly radius: number;
}

const REST: Pose = { x: DECK.x, y: DECK.y, rot: DECK.tilt, scale: 1 };
const FULL: Box = { x: 960, y: 540, w: 1920, h: 1080, rot: 0, radius: 0 };

// The end card's row: the seal, then the name in the wordmark's letters, centred together.
const SEAL_SIZE = 300;
const MARK_HEIGHT = 180;
const MARK_WIDTH = (MARK_HEIGHT * 560) / 124;
const ROW_LEFT = (1920 - (SEAL_SIZE + 56 + MARK_WIDTH)) / 2;
const ROW_Y = 470;
const SEAL_BOX: Box = { x: ROW_LEFT + SEAL_SIZE / 2, y: ROW_Y, w: SEAL_SIZE, h: SEAL_SIZE, rot: 0, radius: SEAL_SIZE / 2 };

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mixBox(a: Box, b: Box, t: number): Box {
  return { x: mix(a.x, b.x, t), y: mix(a.y, b.y, t), w: mix(a.w, b.w, t), h: mix(a.h, b.h, t), rot: mix(a.rot, b.rot, t), radius: Math.max(0, mix(a.radius, b.radius, t)) };
}

/** Where a card's picture sits in the frame when the card stands at `pose`. */
function picBox(pose: Pose): Box {
  const angle = (pose.rot * Math.PI) / 180;
  const d = PIC_DY * pose.scale;
  return { x: pose.x - d * Math.sin(angle), y: pose.y + d * Math.cos(angle), w: PIC.w * pose.scale, h: PIC.h * pose.scale, rot: pose.rot, radius: PIC.radius * pose.scale };
}

/** A card dealt onto the deck from below at `at`. */
function dealt(frame: number, fps: number, at: number): Pose {
  const p = land(frame, fps, at, 16);
  return { ...REST, y: REST.y + (1 - p) * 760, rot: REST.rot + (1 - p) * 9 };
}

/** A card coming up from behind the one that leaves at `at`. */
function fromBehind(frame: number, fps: number, at: number): Pose {
  const p = pop(frame, fps, at + 2);
  return { ...REST, y: REST.y + (1 - p) * 26, scale: 0.92 + 0.08 * p };
}

/** A card thrown off the deck to the upper left from `at`, or the pose it holds before then. */
function thrown(pose: Pose, frame: number, fps: number, at: number): Pose {
  const t = land(frame, fps, at, 14);
  return { ...pose, x: pose.x - t * 1150, y: pose.y - t * 140, rot: pose.rot - t * 16 };
}

function boxStyle(box: Box): CSSProperties {
  return { position: "absolute", left: box.x - box.w / 2, top: box.y - box.h / 2, width: box.w, height: box.h, transform: `rotate(${String(box.rot)}deg)`, borderRadius: box.radius, overflow: "hidden" };
}

/** The card's white body with its strip; the picture is drawn into it here or, where it will grow, as a window above it. */
function CardBody({ pose, title, line, children, lift = 1 }: { pose: Pose; title: string; line: string; children?: ReactNode; lift?: number }) {
  return (
    <div
      style={{
        position: "absolute",
        left: pose.x - CARD.w / 2,
        top: pose.y - CARD.h / 2,
        width: CARD.w,
        height: CARD.h,
        transform: `rotate(${String(pose.rot)}deg) scale(${String(pose.scale)})`,
        borderRadius: 40,
        border: `3px solid ${NAVY}`,
        background: DAY.card,
        boxShadow: `0 ${String(18 * lift)}px ${String(40 * lift)}px rgba(19, 26, 51, 0.18)`,
        boxSizing: "border-box",
      }}
    >
      <div style={{ position: "absolute", left: CARD.pad - 3, top: CARD.pad - 3, width: PIC.w, height: PIC.h, borderRadius: PIC.radius, overflow: "hidden", background: TINT.plain }}>{children}</div>
      <div style={{ position: "absolute", left: CARD.pad + 8, bottom: 0, height: CARD.strip, display: "flex", alignItems: "center", fontFamily: FONT, fontWeight: 700, fontSize: 50, color: DAY.ink, whiteSpace: "nowrap" }}>
        {title}
        <span style={{ color: DAY.ink2 }}>&nbsp;·&nbsp;{line}</span>
      </div>
    </div>
  );
}

/** A card behind the front one: only its edge and a corner of its picture peek out. */
function BackCard({ dx, dy, rot, tile, tint, at }: { dx: number; dy: number; rot: number; tile: string; tint: string; at: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pose = dealt(frame, fps, at);
  return (
    <CardBody pose={{ x: pose.x + dx, y: pose.y + dy, rot: pose.rot - DECK.tilt + rot, scale: 0.95 }} title="" line="" lift={0.6}>
      <AbsoluteFill style={{ background: tint, alignItems: "center", justifyContent: "center" }}>
        <Sticker tile={tile} size={330} delay={at + 6} />
      </AbsoluteFill>
    </CardBody>
  );
}

/** The window: a picture that can grow out of its card to fill the frame, or shrink from the frame into a card. */
function Window({ box, children, ground = NAVY }: { box: Box; children: ReactNode; ground?: string }) {
  return <div style={{ ...boxStyle(box), background: ground }}>{children}</div>;
}

/** A recorded wide shot inside a window, playing from `from` (a frame of the cut) and eased closer while it fills the frame. */
function WindowClip({ clip, from, trim, push }: { clip: ClipName; from: number; trim: number; push: number }) {
  return (
    <AbsoluteFill style={{ transform: `scale(${String(1 + push)})` }}>
      <Sequence from={from} layout="none">
        <Clip name={clip} from={trim} />
      </Sequence>
    </AbsoluteFill>
  );
}

function Stamp({ label, at }: { label: string; at: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const inked = frame >= at;
  const p = pop(frame, fps, at);
  return (
    <div
      style={{
        width: 112,
        height: 112,
        borderRadius: 999,
        border: `4px ${inked ? "solid" : "dashed"} ${inked ? GREEN : DAY.ink2}`,
        color: inked ? GREEN : DAY.ink2,
        background: inked ? "#ffffff" : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: 32,
        transform: inked ? `scale(${String(interpolate(p, [0, 1], [1.6, 1]))}) rotate(-8deg)` : "none",
      }}
    >
      {label}
    </div>
  );
}

/** The Bank's passbook at the size of a card's picture: the sum counts up, the bar fills and the stamps land. */
function Passbook() {
  const frame = useCurrentFrame();
  const counted = ramp(frame, 156, 200);
  const eased = 1 - (1 - counted) * (1 - counted);
  const amount = Math.round((eased * 2_840_000) / 10_000) * 10_000;
  return (
    <AbsoluteFill style={{ background: TINT.money, padding: "34px 40px", fontFamily: FONT, color: DAY.ink }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ width: 70, height: 70, borderRadius: 20, background: GREEN, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42, fontWeight: 700 }}>₦</div>
        <div style={{ fontWeight: 700, fontSize: 48 }}>Bank</div>
      </div>
      <div style={{ marginTop: 26, fontWeight: 500, fontSize: 30, color: DAY.ink2 }}>Held for the road</div>
      <div style={{ fontWeight: 700, fontSize: 108, letterSpacing: -2, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{naira(amount)}</div>
      <div style={{ marginTop: 18, height: 24, borderRadius: 99, background: "#ffffff", overflow: "hidden" }}>
        <div style={{ width: `${String(eased * 88)}%`, height: "100%", borderRadius: 99, background: GREEN }} />
      </div>
      <div style={{ marginTop: 26, display: "flex", gap: 28 }}>
        <Stamp label="₦1m" at={182} />
        <Stamp label="₦2.5m" at={194} />
        <Stamp label="₦5m" at={9999} />
      </div>
    </AbsoluteFill>
  );
}

/** The caption on the right: three words springing up as their card lands, one plain line under them, gone as the next comes. */
function Caption({ words, line, from, until }: { words: string; line: string; from: number; until: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < from || frame > until + 12) return null;
  const lineIn = land(frame, fps, from + 7, 12);
  const out = land(frame, fps, until, 10);
  return (
    <div style={{ position: "absolute", left: 1010, top: 0, width: 840, height: 1080, display: "flex", flexDirection: "column", justifyContent: "center", opacity: 1 - out, transform: `translateY(${String(-out * 70)}px)` }}>
      <Title words={words} size={124} align="left" delay={from} />
      <div style={{ marginTop: 14, fontFamily: FONT, fontWeight: 500, fontSize: 42, lineHeight: 1.3, color: DAY.ink2, opacity: lineIn, transform: `translateY(${String((1 - lineIn) * 30)}px)` }}>{line}</div>
    </div>
  );
}

/** The end: the seal where the night shrank to, its bulbs lighting, the name beside it, then "Play it" and the address. */
function EndRow() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sealIn = ramp(frame, T.sealShrink + 12, T.sealShrink + 20);
  const glow = ramp(frame, T.sealShrink + 18, T.sealShrink + 36);
  const name = land(frame, fps, T.name, 14);
  const button = pop(frame, fps, T.play);
  if (frame < T.sealShrink + 12) return null;
  return (
    <>
      <div style={{ position: "absolute", left: SEAL_BOX.x - SEAL_SIZE / 2, top: SEAL_BOX.y - SEAL_SIZE / 2, opacity: sealIn }}>
        <Seal size={SEAL_SIZE} glow={glow} id="deck" />
      </div>
      <div style={{ position: "absolute", left: ROW_LEFT + SEAL_SIZE + 56, top: ROW_Y - MARK_HEIGHT / 2, opacity: name, transform: `translateX(${String((1 - name) * -70)}px)` }}>
        <Wordmark height={MARK_HEIGHT} color={CREAM} />
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 690, display: "flex", justifyContent: "center", alignItems: "center", gap: 48, transform: `scale(${String(button)})`, opacity: Math.min(1, button * 2) }}>
        <PressButton size={58} paint={NIGHT}>
          Play it
        </PressButton>
        <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 54, color: CREAM }}>japacity.app</div>
      </div>
    </>
  );
}

export function Deck() {
  loadRubik();
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // The four front cards' poses.
  const livesPose = thrown(dealt(frame, fps, 10), frame, fps, T.livesOut);
  const homePose = fromBehind(frame, fps, T.livesOut);
  const bankPose = thrown(REST, frame, fps, T.bankOut);
  const nightPose = fromBehind(frame, fps, T.bankOut);

  // The first window: the house grows out of its card to the frame, then shrinks into the Bank's card and leaves with it.
  const homeGrow = land(frame, fps, T.homeGrow, GROW_FRAMES);
  const homeShrink = land(frame, fps, T.homeShrink, SHRINK_FRAMES);
  const first = frame < T.homeShrink ? mixBox(picBox(homePose), FULL, homeGrow) : mixBox(FULL, picBox(bankPose), homeShrink);
  // A fade through the card's mint as it shrinks: the house goes out, then the passbook comes in.
  const houseOut = ramp(frame, T.homeShrink + 7, T.homeShrink + 10);
  const passbookIn = ramp(frame, T.homeShrink + 10, T.homeShrink + 13);

  // The second window: the night house grows to the frame, then shrinks to the seal.
  const nightGrow = land(frame, fps, T.nightGrow, GROW_FRAMES - 2);
  const sealShrink = land(frame, fps, T.sealShrink, GROW_FRAMES);
  const second = frame < T.sealShrink ? mixBox(picBox(nightPose), FULL, nightGrow) : mixBox(FULL, SEAL_BOX, sealShrink);

  // The payday chip pops over the house, then rides the shrinking frame to the Bank card's corner.
  const corner = picBox(bankPose);
  const chipX = mix(1230, corner.x + corner.w * 0.27, homeShrink);
  const chipY = mix(250, corner.y - corner.h * 0.36, homeShrink);
  const chipScale = mix(1.15, 0.85, homeShrink);

  const night = frame >= T.nightPaint;
  return (
    <AbsoluteFill style={{ background: night ? NIGHT.sky : DAY.sky, overflow: "hidden" }}>
      {frame < T.nightPaint ? (
        <>
          <BackCard dx={-58} dy={-14} rot={-8} tile="prop_laptop-desk" tint={TINT.study} at={2} />
          <BackCard dx={58} dy={-22} rot={6} tile="shop_provisions" tint={TINT.food} at={6} />
        </>
      ) : null}

      <Caption words="Pick a life." line="The nurse, the developer, the trader." from={8} until={T.livesOut} />
      <Caption words="Home, for now." line="The family house, full of people." from={T.livesOut + 6} until={T.homeGrow + 14} />
      <Caption words="Save it up." line="Payday lands, the Bank holds it." from={T.homeShrink + 14} until={T.bankOut - 2} />
      <Caption words="Find your way." line="Ways out open as your life fits them." from={T.bankOut + 6} until={T.nightGrow + 16} />

      {frame >= T.bankOut && frame < T.nightGrow + GROW_FRAMES ? <CardBody pose={nightPose} title="The family house" line="Night" /> : null}
      {frame >= T.bankOut ? (
        <Window box={second}>
          <WindowClip clip="wide-night" from={T.bankOut} trim={0} push={0.05 * ramp(frame, T.nightGrow + GROW_FRAMES, T.sealShrink)} />
        </Window>
      ) : null}

      {frame >= T.livesOut && frame < T.homeGrow + GROW_FRAMES ? <CardBody pose={homePose} title="The family house" line="Day" /> : null}
      {frame >= T.homeShrink && frame < T.bankOut + 16 ? <CardBody pose={bankPose} title="The Bank" line="Savings" /> : null}
      {frame >= T.livesOut && frame < T.bankOut + 16 ? (
        <Window box={first} ground={frame >= T.homeShrink ? TINT.money : NAVY}>
          {frame < T.homeShrink + 10 ? (
            <AbsoluteFill style={{ opacity: 1 - houseOut }}>
              <WindowClip clip="wide-day" from={T.livesOut} trim={24} push={0.06 * ramp(frame, T.homeGrow + GROW_FRAMES, T.homeShrink)} />
            </AbsoluteFill>
          ) : null}
          {frame >= T.homeShrink + 10 ? (
            <AbsoluteFill style={{ opacity: passbookIn }}>
              <Passbook />
            </AbsoluteFill>
          ) : null}
        </Window>
      ) : null}
      {frame >= T.homeGrow + GROW_FRAMES && frame < T.bankOut + 16 ? (
        <div style={{ position: "absolute", left: chipX, top: chipY, transform: `translate(-50%, -50%) scale(${String(chipScale)}) rotate(${String(bankPose.rot - DECK.tilt)}deg)` }}>
          <Chip tint={TINT.money} delay={T.homeGrow + GROW_FRAMES + 8} size={46} tilt={-6}>
            Payday
          </Chip>
        </div>
      ) : null}

      {frame < T.livesOut + 16 ? (
        <CardBody pose={livesPose} title="The nurse" line="On shifts">
          <AbsoluteFill style={{ background: TINT.body, alignItems: "center", justifyContent: "center" }}>
            <Sticker tile="prop_papers-box" size={380} delay={16} />
          </AbsoluteFill>
        </CardBody>
      ) : null}
      {frame < T.livesOut + 16 ? (
        <div style={{ position: "absolute", left: livesPose.x + 190, top: livesPose.y - 400 }}>
          <Sticker tile="chr_ada-face" size={230} tilt={8} delay={28} />
        </div>
      ) : null}

      <EndRow />
    </AbsoluteFill>
  );
}
