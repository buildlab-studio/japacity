// The acts' glyphs (world:fan-of-sticker-buttons, the fan for every thing): an act that is no activity of the simulation (a pose, the bed's
// Sleep, a bill, the papers, the bag, the door, a word with someone) still carries a picture on its fan button. Each is a
// small drawing in the layer's sticker manner (docs/design/09-the-lively-layer.md section 2): flat shapes in the system's
// colours with a navy edge, the white cut and the tilt added by the Sticker round it. The colours are the drawing's own, so
// the sticker reads the same in both paints, as a model's tile does.
import type { ReactNode } from "react";

import type { ActGlyph } from "./tiles.data";

const INK = "#1c2a5e";
const YELLOW = "#f2b705";
const WHITE = "#ffffff";
const LILAC = "#c9b8ec";
const GREEN = "#2a8656";
const MINT = "#dcf5e6";
const ROSE = "#f4a6bd";
const BLUE = "#2c3f87";
const RED = "#c23a2a";
const SKIN = "#8a5a3b";

/** The edge every shape takes: the navy line of the layer's stickers. */
const edge = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" } as const;

const DRAWINGS: Readonly<Record<ActGlyph, ReactNode>> = {
  // A plastic chair, the yellow one of every compound.
  sit: (
    <>
      <path d="M15 7h18a3 3 0 0 1 3 3v15H12V10a3 3 0 0 1 3-3z" fill={YELLOW} {...edge} />
      <path d="M17 12h14M17 17h14" stroke={INK} strokeWidth={2} strokeLinecap="round" />
      <rect x="9" y="25" width="30" height="6" rx="2.5" fill={YELLOW} {...edge} />
      <path d="M13 31l-2 11M35 31l2 11M19 31l-1 8M29 31l1 8" fill="none" {...edge} />
    </>
  ),
  // Someone lying on a bed under a lilac cloth, the head on a white pillow.
  lie: (
    <>
      <path d="M6 15v26M42 27v14" fill="none" {...edge} />
      <rect x="6" y="27" width="36" height="8" rx="2" fill={BLUE} {...edge} />
      <ellipse cx="13" cy="24" rx="6" ry="3.5" fill={WHITE} {...edge} />
      <path d="M17 21h19a5 5 0 0 1 5 5v1H17z" fill={LILAC} {...edge} />
      <circle cx="13" cy="20" r="4.5" fill={SKIN} {...edge} />
    </>
  ),
  // The moon of a night's sleep, with its two small z's.
  sleep: (
    <>
      <path d="M27 9a15 15 0 1 0 13 22A12 12 0 0 1 27 9z" fill={YELLOW} {...edge} />
      <path d="M30 8h7l-7 8h7" fill="none" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      <path d="M38 19h5l-5 6h5" fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </>
  ),
  // A naira note with a coin on it: money paid.
  pay: (
    <>
      <rect x="5" y="11" width="34" height="22" rx="3" fill={MINT} {...edge} />
      <circle cx="22" cy="22" r="6.5" fill={WHITE} stroke={GREEN} strokeWidth={2} />
      <path d="M19.5 26v-8l5 8v-8M18 21h8M18 23.5h8" fill="none" stroke={GREEN} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="35" cy="34" r="8" fill={YELLOW} {...edge} />
      <circle cx="35" cy="34" r="4" fill="none" stroke={INK} strokeWidth={1.8} />
    </>
  ),
  // A paper with its lines and a stamp: the papers.
  papers: (
    <>
      <path d="M11 6h18l9 9v27H11z" fill={WHITE} {...edge} />
      <path d="M29 6v9h9" fill="none" {...edge} />
      <path d="M16 20h16M16 26h16M16 32h9" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
      <circle cx="32" cy="35" r="5" fill="none" stroke={GREEN} strokeWidth={2.2} />
    </>
  ),
  // The travel bag, packed, with its strap and a tag.
  pack: (
    <>
      <path d="M18 14v-4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4" fill="none" {...edge} />
      <rect x="8" y="14" width="32" height="26" rx="5" fill={BLUE} {...edge} />
      <path d="M8 24h32" stroke={YELLOW} strokeWidth={3} />
      <rect x="27" y="28" width="8" height="7" rx="1.5" fill={WHITE} {...edge} />
      <path d="M14 40v3M34 40v3" {...edge} />
    </>
  ),
  // The door open, an arrow leaving through it.
  out: (
    <>
      <rect x="7" y="6" width="22" height="36" rx="2" fill={WHITE} {...edge} />
      <path d="M7 6l12 4v36L7 42z" fill={YELLOW} {...edge} />
      <circle cx="16" cy="27" r="1.5" fill={INK} />
      <path d="M26 24h16M36 18l6 6-6 6" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // The door open, an arrow going in.
  in: (
    <>
      <rect x="19" y="6" width="22" height="36" rx="2" fill={WHITE} {...edge} />
      <path d="M41 6l-12 4v36l12-4z" fill={YELLOW} {...edge} />
      <circle cx="32" cy="27" r="1.5" fill={INK} />
      <path d="M5 24h18M17 18l6 6-6 6" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // Two speech bubbles, a word each way.
  talk: (
    <>
      <path d="M8 8h22a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H17l-6 5v-5H8a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" fill={WHITE} {...edge} />
      <path d="M22 22h18a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4h-2v5l-6-5H22a4 4 0 0 1-4-4v-8a4 4 0 0 1 4-4z" fill={ROSE} {...edge} />
      <circle cx="26" cy="31" r="1.6" fill={INK} />
      <circle cx="31" cy="31" r="1.6" fill={INK} />
      <circle cx="36" cy="31" r="1.6" fill={INK} />
    </>
  ),
  // An eye: have a look.
  look: (
    <>
      <path d="M4 24c5-9 12-13 20-13s15 4 20 13c-5 9-12 13-20 13S9 33 4 24z" fill={WHITE} {...edge} />
      <circle cx="24" cy="24" r="8" fill={GREEN} {...edge} />
      <circle cx="24" cy="24" r="3.5" fill={INK} />
      <circle cx="26.5" cy="21.5" r="1.6" fill={WHITE} />
    </>
  ),
  // A danfo, yellow with its black bands.
  ride: (
    <>
      <path d="M6 14a4 4 0 0 1 4-4h22c4 0 7 4 9 9l2 5v11H6z" fill={YELLOW} {...edge} />
      <path d="M10 15h7v7h-7zM20 15h8v7h-8zM31 15h4l3 7h-7z" fill={WHITE} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <path d="M6 27h37" stroke={INK} strokeWidth={2.5} />
      <circle cx="14" cy="35" r="4.5" fill={INK} />
      <circle cx="34" cy="35" r="4.5" fill={INK} />
      <circle cx="14" cy="35" r="1.6" fill={WHITE} />
      <circle cx="34" cy="35" r="1.6" fill={WHITE} />
    </>
  ),
  // A house with the green and white flag over it: the way home.
  home: (
    <>
      <path d="M8 22L24 9l16 13v19H8z" fill={WHITE} {...edge} />
      <path d="M5 24L24 8l19 16" fill="none" stroke={BLUE} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
      <rect x="19" y="29" width="10" height="12" rx="1.5" fill={YELLOW} {...edge} />
      <path d="M34 15V3" {...edge} />
      <rect x="34" y="3" width="12" height="7" fill={WHITE} stroke={INK} strokeWidth={1.5} />
      <rect x="34" y="3" width="4" height="7" fill={GREEN} />
      <rect x="42" y="3" width="4" height="7" fill={GREEN} />
    </>
  ),
  // A stop sign: take it out of the plan.
  stop: (
    <>
      <path d="M17 5h14l10 10v14L31 39H17L7 29V15z" fill={RED} {...edge} />
      <rect x="14" y="19" width="20" height="6" rx="2" fill={WHITE} />
      <path d="M24 39v6" {...edge} />
    </>
  ),
  // A clock: shut for now, open at its hour.
  shut: (
    <>
      <circle cx="24" cy="25" r="17" fill={WHITE} {...edge} />
      <path d="M24 14v11l7 5" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="25" r="2" fill={INK} />
      <path d="M12 6l-5 5M36 6l5 5" stroke={INK} strokeWidth={3} strokeLinecap="round" />
    </>
  ),
};

/** An act's glyph, a square of `size` CSS pixels, silent to a screen reader since words beside it carry the meaning. */
export function Glyph({ glyph, size }: { glyph: ActGlyph; size: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false" className="block" data-glyph-drawing={glyph}>
      {DRAWINGS[glyph]}
    </svg>
  );
}
