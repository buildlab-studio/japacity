// The main cut: the game as it feels in the hand. The world's own recordings carry every shot, and the game's pieces live
// inside them: a word bubble over a head in the place's own voice, the band at the top, the brief's chip landing, the
// passbook sliding up over the house, the ways out stacking over the parlour, the night falling, the plane leaving, and
// the seal's two bulbs for the oldest Lagos joke about leaving. Twenty two seconds, silent.
import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import { Seal, Wordmark } from "../parts/brand";
import { Card, Chip, Clip, PressButton, Sticker } from "../parts/dress";
import { land, pop, ramp } from "../parts/motion";
import { CREAM, DAY, FONT, GREEN, NAVY, NIGHT, type Paint, TINT, YELLOW } from "../parts/tokens";
import { Flight, NightFalls } from "../teaser/scenes";

/** A bubble over someone's head, as the world draws it: the name pill with the speaker's mark, the words, the tail. */
function Bubble({ name, mark, children, x, y, delay = 0, paint = DAY, size = 40, width = 760 }: { name: string; mark?: string; children: ReactNode; x: number; y: number; delay?: number; paint?: Paint; size?: number; width?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = pop(frame, fps, delay);
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `translate(-50%, -100%) scale(${String(p)})`, transformOrigin: "50% 100%", opacity: Math.min(1, p * 2), width: "max-content", maxWidth: width }}>
      <div style={{ position: "relative", border: `4px solid ${paint.edge}`, borderRadius: 34, background: paint.card, color: paint.ink, padding: "18px 30px 22px", fontFamily: FONT, boxShadow: "0 16px 30px rgba(19, 26, 51, 0.22)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
          <div style={{ width: size * 0.9, height: size * 0.9, borderRadius: 999, background: paint === DAY ? NAVY : CREAM, color: paint === DAY ? CREAM : NAVY, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.5 }}>{mark ?? name.slice(0, 1)}</div>
          <div style={{ fontWeight: 700, fontSize: size * 0.72, color: paint.ink2 }}>{name}</div>
        </div>
        <div style={{ fontWeight: 700, fontSize: size, lineHeight: 1.2 }}>{children}</div>
        <div style={{ position: "absolute", left: "50%", bottom: -24, width: 0, height: 0, marginLeft: -18, borderLeft: "18px solid transparent", borderRight: "18px solid transparent", borderTop: `22px solid ${paint.edge}` }} />
        <div style={{ position: "absolute", left: "50%", bottom: -16, width: 0, height: 0, marginLeft: -13, borderLeft: "13px solid transparent", borderRight: "13px solid transparent", borderTop: `16px solid ${paint.card}` }} />
      </div>
    </div>
  );
}

/** The band at the top of the world: who, when, where, and what is in the pocket. */
function Band({ name, when, where, naira, paint = DAY, delay = 0 }: { name: string; when: string; where: string; naira: string; paint?: Paint; delay?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = land(frame, fps, delay, 14);
  return (
    <div style={{ position: "absolute", left: 40, right: 40, top: 32, transform: `translateY(${String((1 - p) * -160)}px)` }}>
      <Card paint={paint} style={{ display: "flex", alignItems: "center", gap: 26, padding: "16px 28px", borderRadius: 999 }}>
        <div style={{ width: 70, height: 70, borderRadius: 999, background: paint === DAY ? DAY.skyDeep : "#2f3f7a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40 }}>{paint === DAY ? "☀️" : "🌙"}</div>
        <div style={{ fontFamily: FONT, lineHeight: 1.1 }}>
          <div style={{ fontWeight: 700, fontSize: 40 }}>
            {name} <span style={{ color: paint.ink2, fontWeight: 500 }}>· {when}</span>
          </div>
          <div style={{ fontWeight: 500, fontSize: 28, color: paint.ink2 }}>23 yrs 1 mo · {where}</div>
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
  const p = land(frame, fps, delay, 16);
  return (
    <div style={{ position: "absolute", left: 40, top: 40, transform: `translateX(${String((1 - p) * -700)}px)` }}>
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
}

/** A big tilted sticker chip of two or three words, the trailer's title, standing in a corner of the world. */
function BigChip({ children, tint, delay = 0, tilt = -4, style }: { children: ReactNode; tint: string; delay?: number; tilt?: number; style?: CSSProperties }) {
  return (
    <div style={{ position: "absolute", left: 60, bottom: 70, ...style }}>
      <Chip tint={tint} tilt={tilt} delay={delay} size={84}>
        {children}
      </Chip>
    </div>
  );
}

/** A wide recording, pushed in slowly toward a point. */
function World({ clip, from = 0, push = 0.06, toward = [0.5, 0.5], children }: { clip: "wide-ride" | "wide-street" | "wide-day" | "wide-sofa" | "wide-night"; from?: number; push?: number; toward?: readonly [number, number]; children?: ReactNode }) {
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
  const card = land(frame, fps, delay, 16);
  const counted = ramp(frame, delay + 6, delay + 44);
  const eased = 1 - (1 - counted) * (1 - counted);
  const amount = Math.round((eased * 2_500_000) / 10_000) * 10_000;
  return (
    <div style={{ position: "absolute", left: 90, bottom: 60, transform: `translateY(${String((1 - card) * 900)}px) rotate(${String(-3 * card)}deg)` }}>
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
}

function RouteCard({ tile, title, line, tint, top, delay }: { tile: string; title: string; line: string; tint: string; top: number; delay: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = land(frame, fps, delay, 16);
  return (
    <div style={{ position: "absolute", right: 70, top, transform: `translateX(${String((1 - p) * 1200)}px) rotate(${String((1 - p) * 6)}deg)` }}>
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
}

const CONFETTI = [
  { x: 1180, y: 160, c: "#f2b705", r: -20, d: 30 },
  { x: 1500, y: 120, c: "#c2185b", r: 25, d: 32 },
  { x: 1120, y: 420, c: "#2a8656", r: 40, d: 34 },
  { x: 1820, y: 520, c: "#2c3f87", r: -35, d: 31 },
  { x: 1380, y: 60, c: "#d4602e", r: 10, d: 33 },
];

/** The oldest Lagos joke about leaving, then the seal: its two bulbs click off one after the other, and come back on with the name. */
function LightsOut() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const seal = pop(frame, fps, 0);
  const off = frame >= 22 ? 0 : 1;
  const back = ramp(frame, 46, 58, 0, 1);
  const glow = Math.max(off * 0.8, back);
  const name = land(frame, fps, 50);
  const button = pop(frame, fps, 66);
  const click = frame >= 22 && frame < 46;
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
    </AbsoluteFill>
  );
}

/** The flight with the joke written over the lagoon. */
function Leaving() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = land(frame, fps, 10, 14);
  return (
    <AbsoluteFill>
      <Flight city="London" tile="bld_rye-lane-terrace_a" />
      <div style={{ position: "absolute", left: 80, bottom: 90, transform: `translateY(${String((1 - p) * 200)}px)`, opacity: p }}>
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

/** The cut, as frames at 30 a second. */
const SHOTS = [
  { frames: 56, node: (
    <World clip="wide-ride" from={30} push={0.08}>
      <Bubble name="Conductor" x={900} y={720} delay={6} size={44}>
        Oshodi, Oshodi. Enter with your change o.
      </Bubble>
    </World>
  ) },
  { frames: 46, node: (
    <World clip="wide-ride" from={140} push={0.05}>
      <Bubble name="Ada" x={1500} y={330} delay={4} size={44} width={720}>
        Who get change for one thousand?
      </Bubble>
      <BigChip tint={TINT.food} delay={14} tilt={-5}>
        Danfo ₦300
      </BigChip>
    </World>
  ) },
  { frames: 84, node: (
    <World clip="wide-day" from={40} push={0.05} toward={[0.4, 0.3]}>
      <Bubble name="Mama" x={1440} y={330} delay={10} size={42} width={700}>
        Your uncle called. When are you going?
      </Bubble>
      <BriefChip tile="prop_travel-bag" delay={40}>
        Papers, abeg
      </BriefChip>
    </World>
  ) },
  { frames: 66, node: (
    <World clip="wide-sofa" from={40} push={0.14} toward={[0.4, 0.45]}>
      <Band name="Ada" when="Evening" where="The family house" naira="₦498,500" delay={0} />
      <Bubble name="Ada" x={1240} y={540} delay={30} size={42} width={620}>
        Small rest, then I go hustle.
      </Bubble>
      <BigChip tint={TINT.body} delay={8}>
        One month at a time.
      </BigChip>
    </World>
  ) },
  { frames: 72, node: (
    <World clip="wide-street" from={0} push={0.12} toward={[0.5, 0.7]}>
      <Band name="Ada" when="Morning" where="Ojuelegba" naira="₦498,200" delay={0} />
      <Bubble name="Conductor" x={760} y={760} delay={6} size={40} width={620}>
        Na Yaba you dey go? Enter, enter.
      </Bubble>
      <Bubble name="Water seller" mark="W" x={1300} y={700} delay={26} size={40} width={560}>
        Cold water, cold one. Buy cold water.
      </Bubble>
      <BigChip tint={TINT.people} delay={44}>
        Your people.
      </BigChip>
    </World>
  ) },
  { frames: 80, node: (
    <World clip="wide-day" from={110} push={0.05} toward={[0.5, 0.3]}>
      <Band name="Ada" when="Afternoon" where="The family house" naira="₦2,500,000" delay={0} />
      <Passbook delay={4} />
      <Bubble name="Ada" x={1180} y={420} delay={34} size={42} width={520}>
        Small small, I go reach.
      </Bubble>
      <BigChip tint={TINT.money} delay={54} style={{ left: "auto", right: 60 }}>
        Save up.
      </BigChip>
    </World>
  ) },
  { frames: 76, node: (
    <World clip="wide-day" from={10} push={0.05} toward={[0.3, 0.5]}>
      <Band name="Ada" when="Evening" where="The family house" naira="₦3,120,000" delay={0} />
      <RouteCard tile="prop_travel-bag" title="Care work in the UK" line="Your papers and a sponsor" tint={TINT.people} top={170} delay={2} />
      <RouteCard tile="prop_laptop-desk" title="A master's" line="A school that says yes" tint={TINT.study} top={360} delay={8} />
      <RouteCard tile="prop_flight-board" title="The Gulf" line="A job before the flight" tint={TINT.food} top={550} delay={14} />
      {CONFETTI.map((bit) => {
        const Bit = () => {
          const frame = useCurrentFrame();
          const { fps } = useVideoConfig();
          const p = pop(frame, fps, bit.d);
          return <div style={{ position: "absolute", left: bit.x, top: bit.y, width: 40, height: 20, borderRadius: 8, background: bit.c, boxShadow: "0 0 0 5px #fff", transform: `translateY(${String((1 - p) * 160)}px) rotate(${String(bit.r * p)}deg) scale(${String(p)})` }} />;
        };
        return <Bit key={`${String(bit.x)}-${String(bit.y)}`} />;
      })}
      <div style={{ position: "absolute", left: 90, bottom: 40 }}>
        <Sticker tile="chr_ada-cheer" size={520} tilt={4} delay={28} />
      </div>
      <BigChip tint={TINT.study} delay={20} style={{ left: 640, bottom: 80 }}>
        Find your way out.
      </BigChip>
    </World>
  ) },
  { frames: 78, node: (
    <AbsoluteFill>
      <NightFalls from={0} falls={[6, 30]} />
      <Band name="Ada" when="Night" where="The family house" naira="₦3,120,000" paint={NIGHT} delay={30} />
      <Bubble name="Ada" x={760} y={700} delay={44} size={42} paint={NIGHT} width={560}>
        Sleep. The month is done.
      </Bubble>
    </AbsoluteFill>
  ) },
  { frames: 86, node: <Leaving /> },
  { frames: 96, node: <LightsOut /> },
] as const;

export const LEAD_FRAMES = SHOTS.reduce((sum, shot) => sum + shot.frames, 0);

export function Lead() {
  let at = 0;
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      {SHOTS.map((shot, index) => {
        const from = at;
        at += shot.frames;
        return (
          <Sequence key={String(index)} from={from} durationInFrames={shot.frames}>
            {shot.node}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
