// The built inserts: the Bank's passbook counting up while its stamps land, and the ways out sliding in as the figure
// cheers. Built in Remotion from the game's own card, chip and stickers, where a recording would be small and slow.
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import { Card, Chip, Sticker } from "../parts/dress";
import { land, pop, ramp } from "../parts/motion";
import { DAY, FONT, GREEN, TINT } from "../parts/tokens";

function Sky({ children }: { children: React.ReactNode }) {
  return <AbsoluteFill style={{ background: DAY.sky, overflow: "hidden" }}>{children}</AbsoluteFill>;
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

export function SaveUp() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = land(frame, fps, 0);
  const counted = ramp(frame, 8, 46);
  const eased = 1 - (1 - counted) * (1 - counted);
  const amount = Math.round((eased * 2_840_000) / 10_000) * 10_000;
  return (
    <Sky>
      <div style={{ position: "absolute", left: 460, top: 150, transform: `translateY(${String((1 - card) * 800)}px) rotate(${String(-2 * card)}deg)` }}>
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

export function WayOut() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Sky>
      <RouteCard tile="prop_travel-bag" title="Care work in the UK" line="Your papers and a sponsor" tint={TINT.people} top={190} delay={2} />
      <RouteCard tile="prop_laptop-desk" title="A master's" line="A school that says yes" tint={TINT.study} top={430} delay={6} />
      <RouteCard tile="prop_flight-board" title="The Gulf" line="A job before the flight" tint={TINT.food} top={670} delay={10} />
      {CONFETTI.map((bit) => {
        const p = pop(frame, fps, bit.d);
        return <div key={`${String(bit.x)}-${String(bit.y)}`} style={{ position: "absolute", left: bit.x, top: bit.y, width: 46, height: 22, borderRadius: 8, background: bit.c, boxShadow: "0 0 0 5px #fff", transform: `translateY(${String((1 - p) * 180)}px) rotate(${String(bit.r * p)}deg) scale(${String(p)})` }} />;
      })}
      <div style={{ position: "absolute", left: 1150, top: 200 }}>
        <Sticker tile="chr_ada-cheer" size={680} tilt={4} delay={14} />
      </div>
    </Sky>
  );
}
