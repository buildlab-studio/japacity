// The game's pieces as the stage shows them, copied from the client (apps/client/src) since its own components read the
// game's stores: the picture cut as a sticker, the sticker chip, a person's name pill, the band, the brief's chip and
// toast, the thumbs, the yellow action, the handset with an app's head, and the savings bar. The words come from
// words.ts; the looks from look.css.
import { ArrowRight, ChevronLeft, Eye, Maximize2, Plane, X } from "lucide-react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import { PLAYER, W } from "./words";

/** A model's tile from public/tiles, as the game publishes it, beside the page in the public folder. */
export function tileSrc(name: string): string {
  return `../tiles/${name}.webp`;
}

/** A model's tile cut as a sticker, tilted a little as the game tilts it. */
export function Sticker({ tile, size, tilt = 0, style }: { tile: string; size: number; tilt?: number; style?: CSSProperties }) {
  return (
    <span className="sticker-cut" style={{ rotate: `${String(tilt)}deg`, ...style }}>
      <img className="jc-tile" src={tileSrc(tile)} alt="" width={size} height={size} draggable={false} />
    </span>
  );
}

/** A stand-in picture where the game has no model, drawn from its attribute as the game draws one. */
export function DrawnPic({ pic, size }: { pic: string; size: number }) {
  return <span className="drawn-pic" data-pic={pic} style={{ width: size, height: size, fontSize: Math.round(size * 0.62) }} aria-hidden />;
}

export function StickerChip({ tint, tilt = -2, className = "", style, children, ...rest }: { tint?: string; tilt?: number; className?: string; style?: CSSProperties; children: ReactNode } & Omit<HTMLAttributes<HTMLSpanElement>, "style" | "className" | "children">) {
  return (
    <span {...rest} className={`sticker-chip ${tint === undefined ? "" : `tint-${tint}`} ${className}`} style={{ rotate: `${String(tilt)}deg`, ...style }}>
      {children}
    </span>
  );
}

const FACE_COLOURS = 6;
const LEAD_WORDS = /^(your|the|a|an)\s+/i;

/** A name's mark: its first letter after "your", "the", "a" or "an", and the mark colour its letters pick, as the game picks it. */
export function faceMark(name: string): { initial: string; colour: string } {
  const letters = [...name.normalize("NFC").trim()];
  const initial = [...name.normalize("NFC").trim().replace(LEAD_WORDS, "")][0]?.toLocaleUpperCase() ?? "?";
  const sum = letters.reduce((total, letter) => total + (letter.codePointAt(0) ?? 0), 0);
  return { initial, colour: `var(--face-${String((sum % FACE_COLOURS) + 1)})` };
}

export function Face({ name, size = 14 }: { name: string; size?: number }) {
  const mark = faceMark(name);
  return (
    <span className="pill" style={{ fontSize: size }}>
      <span className="face-mark" style={{ background: mark.colour }}>
        {mark.initial}
      </span>
      {name}
    </span>
  );
}

/** The band: the sky, the player's name with the part of the day, the age and the place under it, and the money. */
export function Band({ age, place, money }: { age: string; place: string; money: ReactNode }) {
  return (
    <div className="band-pill">
      <span className="band-sky drawn-pic" data-pic="🌤️" aria-hidden />
      <div className="band-person">
        <div>
          <span className="band-name">{PLAYER}</span> <span className="band-part">{W.morning}</span>
        </div>
        <div className="band-where">
          {age} · {place}
        </div>
      </div>
      <div className="band-money jc-num">{money}</div>
    </div>
  );
}

export type Dot = "done" | "now" | "later";

/** The brief's chip under the band: the picture of the thing to do now, the brief's title and a dot for each thing. */
export function BriefChip({ dots }: { dots: readonly Dot[] }) {
  return (
    <span className="brief-chip">
      <span className="chip-pic">
        <Sticker tile="prop_long-desk" size={24} tilt={-8} />
      </span>
      <span>{W.brief}</span>
      <span className="brief-dots" aria-hidden>
        {dots.map((dot, index) => (
          <i key={index} className="brief-dot" data-dot={dot} />
        ))}
      </span>
    </span>
  );
}

/** The giver's toast under the chip when a thing is done: the brief's picture, the giver's name and the line in their voice. */
export function BriefToast() {
  return (
    <div className="brief-toast" role="status">
      <span className="brief-toast-pic">
        <Sticker tile="prop_long-desk" size={34} tilt={-5} />
      </span>
      <div style={{ minWidth: 0 }}>
        <Face name={W.giver} size={13} />
        <p className="brief-toast-words" style={{ margin: "4px 0 0" }}>
          {W.toast}
        </p>
      </div>
    </div>
  );
}

/** A thumb at the foot of the world: a round white button with its picture and its word inside, the edge and its underside. */
export function Thumb({ pic, label, target }: { pic: string; label: string; target?: string }) {
  return (
    <span className="thumb-round" {...(target === undefined ? {} : { "data-target": target })}>
      <DrawnPic pic={pic} size={24} />
      <span style={{ fontSize: 12, lineHeight: 1, fontWeight: 700 }}>{label}</span>
    </span>
  );
}

/** The one yellow action: the act on the left, where it leads on the right, or the act alone in the middle. */
export function MainButton({ act, then, target }: { act: string; then?: string; target?: string }) {
  return (
    <span className="press-button" style={{ justifyContent: then === undefined ? "center" : "space-between" }} {...(target === undefined ? {} : { "data-target": target })}>
      <span>{act}</span>
      {then === undefined ? null : (
        <span className="btn-main-then">
          {then} <ArrowRight size={16} strokeWidth={2.4} aria-hidden />
        </span>
      )}
    </span>
  );
}

/** The game's phone over the world: the device round its glass, risen, or dropped below the screen when put away. */
export function Handset({ style, away, children }: { style: CSSProperties; away: boolean; children: ReactNode }) {
  return (
    <div className="handset" style={style} {...(away ? { "data-away": "" } : {})}>
      <div className="handset-glass">{children}</div>
    </div>
  );
}

/** An app on the phone: its head (back, its tile, its name, the grow button), what it holds, and the home bar. */
export function AppScreen({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="app-head">
        <span className="phone-round" aria-hidden>
          <ChevronLeft size={22} strokeWidth={2.4} />
        </span>
        <span className="app-tile" style={{ background: "var(--app-japa)" }} aria-hidden>
          <Plane size={20} strokeWidth={2.4} />
        </span>
        <span className="app-name" style={{ flex: 1 }}>
          {W.japa}
        </span>
        <span className="phone-round" aria-hidden>
          <Maximize2 size={18} strokeWidth={2.4} />
        </span>
      </div>
      <div className="app-body">{children}</div>
      <div className="home-bar" aria-hidden>
        <span />
      </div>
    </>
  );
}

/** The sheet's close in its corner. */
export function SheetClose() {
  return (
    <span className="sheet-close" aria-hidden>
      <X size={20} strokeWidth={2.4} />
    </span>
  );
}

/** The look on an ask that may be a scam: free, and it finds every sign the ask carries. */
export function LookCloser({ target }: { target: string }) {
  return (
    <span className="sticker-chip tint-plain" style={{ rotate: "-1deg", fontSize: 14, padding: "7px 9px" }} data-target={target}>
      <Eye size={16} strokeWidth={2.4} aria-hidden />
      {W.look}
    </span>
  );
}
