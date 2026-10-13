// Direction B, a life assembled: the game's stickers and cards fly in and land on the pale sky, one idea a shot. A life is
// picked from three cards, the house and the street stick round it, the passbook fills and stamps, the ways out slide in
// and the figure cheers; then the name. Shots of about two seconds, each built in Remotion from the game's own pieces.
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import { Card, Chip, Sticker, Title } from "../parts/dress";
import { loadRubik } from "../parts/fonts";
import { land, pop, ramp } from "../parts/motion";
import { DAY, FONT, GREEN, TINT } from "../parts/tokens";
import { EndCard } from "./scenes";
import { lengthOf, type Shot, Shots } from "./shots";

function Sky({ children }: { children: React.ReactNode }) {
  return <AbsoluteFill style={{ background: DAY.sky, overflow: "hidden" }}>{children}</AbsoluteFill>;
}

/** A big title in the top left, as a shot's one idea. */
function Head({ words }: { words: string }) {
  return (
    <div style={{ position: "absolute", left: 120, top: 96 }}>
      <Title words={words} size={150} align="left" delay={2} />
    </div>
  );
}

function LifeCard({ tile, name, line, tint, at, delay, tilt, top = 300, grow = 0 }: { tile: string; name: string; line: string; tint: string; at: number; delay: number; tilt: number; top?: number; grow?: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = land(frame, fps, delay);
  return (
    <div style={{ position: "absolute", left: at, top, transform: `translateY(${String((1 - p) * 700)}px) rotate(${String(tilt * p)}deg) scale(${String(1 + grow)})` }}>
      <Card style={{ width: 420, padding: 28 }}>
        <div style={{ height: 300, borderRadius: 30, background: tint, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sticker tile={tile} size={250} delay={delay + 6} />
        </div>
        <div style={{ marginTop: 26, fontWeight: 700, fontSize: 50, color: DAY.ink }}>{name}</div>
        <div style={{ marginTop: 6, fontWeight: 500, fontSize: 32, color: DAY.ink2 }}>{line}</div>
      </Card>
    </div>
  );
}

function PickALife() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chosen = pop(frame, fps, 34);
  return (
    <Sky>
      <Head words="Pick a life." />
      <LifeCard tile="prop_laptop-desk" name="The developer" line="Codes at night" tint={TINT.study} at={560} delay={4} tilt={-7} />
      <LifeCard tile="shop_provisions" name="The trader" line="Sells by the road" tint={TINT.food} at={1360} delay={10} tilt={7} />
      <LifeCard tile="prop_papers-box" name="The nurse" line="Nurse on shifts" tint={TINT.body} at={960} top={260} delay={7} tilt={0} grow={0.06 * chosen} />
      <div style={{ position: "absolute", left: 1290, top: 250 }}>
        <Sticker tile="chr_ada-face" size={220} tilt={8} delay={22} />
      </div>
      <div style={{ position: "absolute", left: 1010, top: 870 }}>
        <Chip tint={TINT.money} delay={30} size={40}>
          Savings ₦500,000
        </Chip>
      </div>
    </Sky>
  );
}

function LiveIt() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drive = land(frame, fps, 14, 30);
  return (
    <Sky>
      <Head words="Live it." />
      <div style={{ position: "absolute", left: 640, top: 250 }}>
        <Sticker tile="bld_family-house" size={640} tilt={-3} delay={0} />
      </div>
      <div style={{ position: "absolute", left: interpolate(drive, [0, 1], [-500, 210]), top: 610 }}>
        <Sticker tile="veh_danfo" size={380} tilt={-4} delay={14} />
      </div>
      <div style={{ position: "absolute", left: 300, top: 600 }}>
        <Chip tint={TINT.plain} delay={30} tilt={-6} size={40}>
          Danfo ₦250
        </Chip>
      </div>
      <div style={{ position: "absolute", left: 1330, top: 240 }}>
        <Sticker tile="prop_big-pot" size={260} tilt={6} delay={8} />
      </div>
      <div style={{ position: "absolute", left: 1450, top: 470 }}>
        <Chip tint={TINT.food} delay={20} tilt={5} size={40}>
          +Belly
        </Chip>
      </div>
      <div style={{ position: "absolute", left: 1360, top: 620 }}>
        <Sticker tile="prop_suya-grill" size={300} tilt={-5} delay={16} />
      </div>
      <div style={{ position: "absolute", left: 1200, top: 820 }}>
        <Sticker tile="chr_emeka-face" size={190} tilt={-8} delay={24} />
      </div>
      <div style={{ position: "absolute", left: 1390, top: 930 }}>
        <Chip tint={TINT.people} delay={30} tilt={-3} size={40}>
          How far?
        </Chip>
      </div>
    </Sky>
  );
}

function Stamp({ label, delay }: { label: string; delay: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = pop(frame, fps, delay);
  const inked = frame >= delay;
  return (
    <div
      style={{
        width: 150,
        height: 150,
        borderRadius: 999,
        border: `5px ${inked ? "solid" : "dashed"} ${inked ? GREEN : DAY.ink2}`,
        color: inked ? GREEN : DAY.ink2,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        fontSize: 40,
        transform: inked ? `scale(${String(interpolate(p, [0, 1], [1.6, 1]))}) rotate(-8deg)` : "none",
        background: inked ? TINT.money : "transparent",
      }}
    >
      {label}
    </div>
  );
}

function SaveUp() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = land(frame, fps, 0);
  const counted = ramp(frame, 8, 46);
  const eased = 1 - (1 - counted) * (1 - counted);
  const amount = Math.round((eased * 2_840_000) / 10_000) * 10_000;
  return (
    <Sky>
      <Head words="Save up." />
      <div style={{ position: "absolute", left: 760, top: 200, transform: `translateY(${String((1 - card) * 800)}px) rotate(${String(2 * card)}deg)` }}>
        <Card style={{ width: 900, padding: 50, fontFamily: FONT }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <div style={{ width: 84, height: 84, borderRadius: 24, background: GREEN, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 50, fontWeight: 700 }}>₦</div>
            <div style={{ fontWeight: 700, fontSize: 58 }}>Bank</div>
            <div style={{ marginLeft: "auto" }}>
              <Chip tint={TINT.plain} delay={20} size={34}>
                Next stamp ₦5m
              </Chip>
            </div>
          </div>
          <div style={{ marginTop: 40, fontWeight: 500, fontSize: 34, color: DAY.ink2 }}>Held for the road</div>
          <div style={{ fontWeight: 700, fontSize: 132, letterSpacing: -2, fontVariantNumeric: "tabular-nums", color: DAY.ink }}>₦{amount.toLocaleString("en-NG")}</div>
          <div style={{ marginTop: 30, height: 30, borderRadius: 99, background: DAY.skyDeep, overflow: "hidden" }}>
            <div style={{ width: `${String(eased * 88)}%`, height: "100%", borderRadius: 99, background: GREEN }} />
          </div>
          <div style={{ marginTop: 44, display: "flex", gap: 40 }}>
            <Stamp label="₦1m" delay={22} />
            <Stamp label="₦2.5m" delay={38} />
            <Stamp label="₦5m" delay={999} />
          </div>
        </Card>
      </div>
    </Sky>
  );
}

function RouteCard({ tile, title, line, tint, top, delay }: { tile: string; title: string; line: string; tint: string; top: number; delay: number }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = land(frame, fps, delay);
  return (
    <div style={{ position: "absolute", left: 160, top, transform: `translateX(${String((1 - p) * -1400)}px)` }}>
      <Card style={{ width: 820, padding: 26, display: "flex", alignItems: "center", gap: 30 }}>
        <div style={{ width: 150, height: 150, borderRadius: 30, background: tint, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Sticker tile={tile} size={130} delay={delay + 4} edge={6} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 52 }}>{title}</div>
          <div style={{ fontWeight: 500, fontSize: 32, color: DAY.ink2, marginTop: 4 }}>{line}</div>
        </div>
      </Card>
    </div>
  );
}

const CONFETTI = [
  { x: 1240, y: 300, c: "#f2b705", r: -20, d: 18 },
  { x: 1700, y: 260, c: "#c2185b", r: 25, d: 20 },
  { x: 1180, y: 620, c: "#2a8656", r: 40, d: 22 },
  { x: 1760, y: 640, c: "#2c3f87", r: -35, d: 19 },
  { x: 1450, y: 190, c: "#d4602e", r: 10, d: 21 },
  { x: 1600, y: 900, c: "#f2b705", r: -12, d: 23 },
];

function WayOut() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Sky>
      <div style={{ position: "absolute", left: 160, top: 90 }}>
        <Title words="Find your way out." size={124} align="left" delay={2} />
      </div>
      <RouteCard tile="prop_travel-bag" title="Care work in the UK" line="Your papers and a sponsor" tint={TINT.people} top={340} delay={4} />
      <RouteCard tile="prop_laptop-desk" title="A master's" line="A school that says yes" tint={TINT.study} top={560} delay={9} />
      <RouteCard tile="prop_flight-board" title="The Gulf" line="A job before the flight" tint={TINT.food} top={780} delay={14} />
      {CONFETTI.map((bit) => {
        const p = pop(frame, fps, bit.d);
        return <div key={`${String(bit.x)}-${String(bit.y)}`} style={{ position: "absolute", left: bit.x, top: bit.y, width: 46, height: 22, borderRadius: 8, background: bit.c, boxShadow: "0 0 0 5px #fff", transform: `translateY(${String((1 - p) * 180)}px) rotate(${String(bit.r * p)}deg) scale(${String(p)})` }} />;
      })}
      <div style={{ position: "absolute", left: 1270, top: 230 }}>
        <Sticker tile="chr_ada-cheer" size={600} tilt={4} delay={16} />
      </div>
    </Sky>
  );
}

export const B_SHOTS: readonly Shot[] = [
  { frames: 70, node: <PickALife /> },
  { frames: 66, entry: "slide-left", node: <LiveIt /> },
  { frames: 62, entry: "slide-left", node: <SaveUp /> },
  { frames: 72, entry: "slide-left", node: <WayOut /> },
  { frames: 70, entry: "slide-up", node: <EndCard glowFrom={6} /> },
];

export const B_FRAMES = lengthOf(B_SHOTS);

export function RoundB() {
  loadRubik();
  return <Shots shots={B_SHOTS} />;
}

