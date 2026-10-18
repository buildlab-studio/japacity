// The game's lockup and seal (account:start-screen-over-live-city): the J in two rings with two bulbs on a
// wire across the top, warm for home and cool for abroad, beside the name in the plain bold face. The files are
// drawn in public/brand/ (their notes in brand/README.md, out of the served folder), one for each ground: a light
// ground is the sheet, a dark one the band or the sky behind the figure. The seal has three drawings: the full one,
// the medium one from 48 to 192 pixels, and the small one up to 48, where the bulbs are plain discs.
import { say } from "../words/text";

export type Ground = "light" | "dark";

/** The lockup's file for a ground, under the published root. */
export function wordmarkFile(ground: Ground): string {
  return `${import.meta.env.BASE_URL}brand/japacity-lockup-${ground}.svg`;
}

/** The seal's file for a ground, the drawing that suits its size in pixels (small to 48, medium to 192, else the full one). */
export function markFile(ground: Ground, px = 32): string {
  const drawing = px <= 48 ? "-small" : px <= 192 ? "-medium" : "";
  return `${import.meta.env.BASE_URL}brand/japacity-mark${drawing}-${ground}.svg`;
}

/**
 * The lockup at the top of a screen, with air around it; its words are the game's name. Over the scene it stands a
 * little taller than on a sheet, since the figure is the only thing near it there.
 */
export function Wordmark({ ground, align = "center", compact = false, className = "" }: { ground: Ground; align?: "center" | "start"; compact?: boolean; className?: string }) {
  const height = compact ? "h-8" : ground === "dark" ? "h-10" : "h-9";
  return <img src={wordmarkFile(ground)} alt={say("ui.game")} draggable={false} className={`${align === "center" ? "mx-auto " : ""}block w-auto ${height} ${className}`} data-wordmark={ground} />;
}

/** The seal alone, square at `px` pixels, for a corner or a footer. */
export function Mark({ ground, px = 32, className = "" }: { ground: Ground; px?: number; className?: string }) {
  return <img src={markFile(ground, px)} alt={say("ui.game")} width={px} height={px} draggable={false} className={`block shrink-0 ${className}`} data-mark={ground} />;
}

/**
 * The seal as a picture behind an empty box, for a place where the game's name stands beside it in words and the card
 * is type alone, with no image element (the share card's footer).
 */
export function Seal({ ground, px = 32, className = "" }: { ground: Ground; px?: number; className?: string }) {
  return <span aria-hidden className={`block shrink-0 bg-contain bg-no-repeat ${className}`} style={{ width: px, height: px, backgroundImage: `url(${markFile(ground, px)})` }} data-seal={ground} />;
}
