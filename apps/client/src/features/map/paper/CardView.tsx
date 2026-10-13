// A neighbourhood's card (docs/rules/world.md R-WORLD-015; the second design): the same painted map zoomed in on one
// district inside a white card with a navy edge, its name folded into the card's top edge as a small pill. The stickers
// are larger here, and still the pins.
import type { CSSProperties } from "react";
import { memo } from "react";

import { mapWords } from "../map.words";
import { type Card } from "./districts";
import type { Point } from "./fit";
import type { Marks, Placed } from "./stops";
import type { TileUrl } from "./useTiles";
import { type Frame, World } from "./World";

/** How far in from a card's side edges a stop picked is kept, so its name stands whole. */
const SIDE = 120;

/**
 * A card's own frame: its district's middle in the middle of the box; with a stop picked, moved so the stop stands clear
 * of the sheet below and far enough from the sides for its name.
 */
export function cardFrame(card: Card, width: number, height: number, lift: Point | null = null): Frame {
  const z = card.zoom / 100;
  let x = width / 2 - z * card.centre[0];
  let y = height / 2 - z * card.centre[1];
  if (lift !== null) {
    const down = y + lift[1] * z;
    const want = Math.round(height * 0.34);
    if (down > want) y -= down - want;
    const across = x + lift[0] * z;
    const side = Math.min(SIDE, Math.round(width / 2));
    if (across > width - side) x -= across - (width - side);
    if (across < side) x += side - across;
  }
  return { x, y, sx: z, sy: z };
}

export interface CardViewProps {
  card: Card;
  width: number;
  height: number;
  /** Whether its drawing is mounted: only the card shown and its neighbours draw. */
  drawn: boolean;
  stops: readonly Placed[];
  names: (id: string) => string;
  marks: Marks;
  tiles: TileUrl;
  route: readonly Point[] | null;
  /** The stop picked on this card, lifted clear of the sheet. */
  lift: Point | null;
  onPick: (id: string) => void;
  current: boolean;
  /** On a laptop the card is a small one in a row, and a tap frames it on the open map. */
  onCard?: () => void;
  style?: CSSProperties;
  className?: string;
}

export const CardView = memo(function CardView({ card, width, height, drawn, stops, names, marks, tiles, route, lift, onPick, current, onCard, style, className = "" }: CardViewProps) {
  const inner = { width: Math.max(1, width - 8), height: Math.max(1, height - 8) };
  const url = tiles(card.model);
  return (
    <section className={`paper-card ${className}`} style={{ width, height, ...style }} aria-label={mapWords(card.key)} data-card={card.id} data-current={current} onClick={onCard}>
      <div className="paper-card-in">
        {drawn ? <World variant="card" uid={`card-${card.id}`} frame={cardFrame(card, inner.width, inner.height, lift)} stops={stops} names={names} marks={marks} tiles={tiles} pinPx={50} route={route} onPick={onPick} /> : null}
      </div>
      <span className="paper-card-title" data-card-title>
        <span className="paper-card-tile">{url === null ? null : <img src={url} alt="" width={22} height={22} draggable={false} />}</span>
        {mapWords(card.key)}
      </span>
    </section>
  );
});
