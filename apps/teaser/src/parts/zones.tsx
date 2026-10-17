// The zones of a phone's feed that the portrait teaser obeys at every frame. Above 220 stand the phone's status bar and
// the feed's header, below 1540 the feed's caption, buttons and progress: nothing of ours stands in either. Between them,
// each piece has its own band of the frame. Every piece the portrait teaser draws stands in a box of its own, named for its
// zone, with its place and size given in pixels, so a test can walk the cut and prove where each one stands.
import type { CSSProperties, ReactNode } from "react";

export const ZONES = {
  /** The band, where the game's band stands under the notch. */
  band: [220, 320],
  /** The picture's focus and the bubbles over heads. */
  picture: [320, 1180],
  /** The beat's words, one big chip, where a viewer's eye rests. */
  words: [1180, 1360],
  /** The cards: the passbook, the ways out, the brief's chip. */
  cards: [1000, 1540],
  /** Anything else of ours (the opening, the flight's cards, the end card): clear of the feed's own bars. */
  safe: [220, 1540],
} as const satisfies Record<string, readonly [number, number]>;

export type Zone = keyof typeof ZONES;

/** The feed's own bars, top and bottom, which a still can draw over the frame to show what they cover. */
export const FEED_BARS = { top: 220, bottom: 1540 } as const;

/** A piece of the portrait teaser in its box: left and top in the tall frame's pixels, and its size where it is known. */
export function Piece({ zone, name, left, top, width, height, style, children }: { zone: Zone; name: string; left?: number; top: number; width?: number; height: number; style?: CSSProperties; children: ReactNode }) {
  return (
    <div data-piece={name} data-zone={zone} style={{ position: "absolute", left, top, width, height, ...style }}>
      {children}
    </div>
  );
}
