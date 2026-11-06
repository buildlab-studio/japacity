// The phone's Japa app and home screen as the game draws them (apps/client/src/features/phone): the plan's card with how
// ready you are, the official page's card, the other ways out as cards in two columns, what is coming up, and the home
// screen's clock, place and apps.
import { Briefcase, CalendarDays, ChevronRight, FolderOpen, Landmark, MessageCircle, Newspaper, Plane, Receipt, Settings, ShoppingBag, Ticket, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

import { Meter } from "./kit";
import { Sticker, StickerChip } from "./parts";
import { W } from "./words";

/** A model's picture on its soft tile, as the phone's cards carry one, the picture filling the tile. */
export function PicTile({ size, tile }: { size: number; tile: string }) {
  return (
    <span className="phone-pic tint-study" style={{ width: size, height: size }}>
      <Sticker tile={tile} size={size - 4} />
    </span>
  );
}

/** A stand-in picture on its soft tile, drawn from the tile's own attribute so the tile is the picture. */
export function PicStandIn({ size, pic }: { size: number; pic: string }) {
  return <span className="phone-pic tint-study drawn-pic" data-pic={pic} style={{ width: size, height: size, fontSize: Math.round(size * 0.6) }} aria-hidden />;
}

/** The head of the app: the plan's route in its own words, with how ready you are to go. */
export function PlanCard({ ready }: { ready: number }) {
  return (
    <div className="look-card" style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <PicTile size={56} tile="building_rye-lane-terrace_a" />
        <span style={{ fontSize: 20, lineHeight: 1.15, fontWeight: 700 }}>{W.plan}</span>
      </div>
      <div>
        <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 6 }}>{W.ready}</div>
        <Meter value={ready} tone="success" className="phone-meter" />
      </div>
    </div>
  );
}

/** The official page's card: read at once, free, the full list for the way it is about. */
export function OfficialCard({ target }: { target: string }) {
  return (
    <div className="look-card" data-target={target} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12 }}>
      <PicStandIn size={48} pic="🧭" />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{W.official}</span>
          <StickerChip className="tint-money" tilt={-2} style={{ color: "var(--money-ink)" }}>
            {W.free}
          </StickerChip>
        </span>
        <span style={{ display: "block", marginTop: 10, fontSize: 14, lineHeight: 1.3, color: "var(--text-2)" }}>{W.officialLine}</span>
      </span>
      <ChevronRight size={16} strokeWidth={2.4} style={{ flex: "none", color: "var(--text-2)" }} aria-hidden />
    </div>
  );
}

/** A section's head inside an app. */
export function Head({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-2)" }}>{children}</div>;
}

/** Another way out as the app draws it: its picture, its name and how far you are with it. */
export function WayCard({ tile, name, state, compact = false, style }: { tile: string; name: string; state: string; compact?: boolean; style?: CSSProperties }) {
  return (
    <div className="look-card" style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: compact ? 6 : 8, padding: compact ? 8 : 10, ...style }}>
      <PicTile size={compact ? 44 : 52} tile={tile} />
      <span style={{ fontSize: 15, lineHeight: 1.2, fontWeight: 700 }}>{name}</span>
      <StickerChip className="tint-study" tilt={-1.5}>
        {state}
      </StickerChip>
    </div>
  );
}

/** One thing coming up: its picture on the study tint, its words and when, on the soft yellow. */
export function ComingRow() {
  return (
    <div className="look-card" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px" }}>
      <span className="phone-pic tint-study" style={{ width: 40, height: 40 }}>
        <CalendarDays size={20} strokeWidth={2.2} aria-hidden />
      </span>
      <span style={{ minWidth: 0, flex: 1, fontSize: 15, fontWeight: 700 }}>{W.birthday}</span>
      <StickerChip className="tint-soft" tilt={2}>
        {W.inMonths}
      </StickerChip>
    </div>
  );
}

const APPS: readonly { name: string; icon: LucideIcon; tint: string; target?: string }[] = [
  { name: W.calendar, icon: CalendarDays, tint: "#1f6f78" },
  { name: W.bank, icon: Landmark, tint: "#2a8656" },
  { name: W.chats, icon: MessageCircle, tint: "#2c3f87" },
  { name: W.japa, icon: Plane, tint: "#d4602e", target: "japa" },
  { name: W.papers, icon: FolderOpen, tint: "#8a5a2b" },
  { name: W.jobs, icon: Briefcase, tint: "#b8862b" },
  { name: W.market, icon: ShoppingBag, tint: "#c2406e" },
  { name: W.lotto, icon: Ticket, tint: "#c23a2a" },
  { name: W.bills, icon: Receipt, tint: "#7a3b69" },
  { name: W.news, icon: Newspaper, tint: "#4a5068" },
  { name: W.settings, icon: Settings, tint: "#8a8378" },
];

/** The phone's home screen: the time and the day, the place on a soft pill, and the apps at the foot. */
export function HomeScreen() {
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: "var(--strong)", color: "var(--on-strong)" }}>
      <div style={{ padding: "20px 20px 0" }}>
        <div className="jc-num" style={{ fontSize: 56, lineHeight: 1, letterSpacing: "-0.03em" }}>
          8:41
        </div>
        <div style={{ marginTop: 8, fontSize: 16, fontWeight: 500, opacity: 0.85 }}>Thursday 5 November</div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "4px 12px 4px 6px", borderRadius: 9999, background: "rgba(243, 239, 230, 0.16)" }}>
          <Sticker tile="building_family-house" size={22} tilt={-6} />
          <span style={{ fontSize: 16, fontWeight: 700 }}>{W.where}</span>
        </div>
      </div>
      <ul style={{ margin: "auto 0 0", padding: "24px 16px 16px", listStyle: "none", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", rowGap: 16, columnGap: 8 }}>
        {APPS.map((app) => (
          <li key={app.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <span
              style={{ display: "flex", width: 56, height: 56, alignItems: "center", justifyContent: "center", borderRadius: 16, background: app.tint, color: "#ffffff", boxShadow: "0 0 0 3px #ffffff, 0 6px 14px rgba(10, 14, 30, 0.35)" }}
              {...(app.target === undefined ? {} : { "data-target": app.target })}
            >
              <app.icon size={24} strokeWidth={2.2} aria-hidden />
            </span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{app.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
