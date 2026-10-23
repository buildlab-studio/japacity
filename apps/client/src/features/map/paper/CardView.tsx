// A neighbourhood's card (world:map-is-painted-lagos): the same painted map zoomed in on one
// district inside a white card with a navy edge, its name folded into the card's top edge as a small pill. The stickers
// are larger here, and still the pins.
import type { CSSProperties } from "react";
import { memo, useMemo } from "react";

import { mapWords } from "../map.words";
import { type Card } from "./districts";
import type { Point } from "./fit";
import { LABELS, type Label } from "./geometry";
import { usePaperCity } from "./lagos";
import type { Marks, Placed } from "./stops";
import type { TileUrl } from "./useTiles";
import { type Frame, World } from "./World";

/** The card's own tile in its title pill, across in CSS pixels. */
const CARD_TILE_PX = 22;

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

/** The card's title pill on the paper's box, in the box's pixels: it stands over the card's top edge at its left. */
export function titleBox(title: string): readonly [number, number, number, number] {
  // paper.css: the pill sits 14 px in and 14 px above the card's edge, the paper's box 4 px inside the card; the tile,
  // the gaps and each letter of the name at 14 px make its width.
  return [10, -18, 10 + 44 + Math.ceil(title.length * 8.4), 12];
}

/**
 * The district names a card paints (world:map-is-painted-lagos): each one whole on the card's paper, clear of its edges and of its
 * title pill, so no name runs under the pill nor is cut by the card's edge. A name's box is reckoned from its letters
 * at its own size on the screen, turned by its tilt.
 */
export function cardLabels(frame: Frame, width: number, height: number, title: string, words: (key: string) => string = mapWords, labels: readonly Label[] = LABELS): Set<string> {
  const pill = titleBox(title);
  const keep = 4;
  const shown = new Set<string>();
  for (const label of labels) {
    const text = words(label.key);
    const across = text.length * label.size * 0.62 + 6;
    const tall = label.size * 1.25;
    const turn = (Math.abs(label.tilt) * Math.PI) / 180;
    const halfX = (across * Math.cos(turn) + tall * Math.sin(turn)) / 2;
    const halfY = (across * Math.sin(turn) + tall * Math.cos(turn)) / 2;
    // The text stands on its baseline, centred across: its middle is a third of its size above the point.
    const x = frame.x + label.at[0] * frame.sx;
    const y = frame.y + label.at[1] * frame.sy - label.size * 0.35;
    const whole = x - halfX >= keep && x + halfX <= width - keep && y - halfY >= keep && y + halfY <= height - keep;
    const underPill = x - halfX < pill[2] + keep && x + halfX > pill[0] - keep && y - halfY < pill[3] + keep && y + halfY > pill[1] - keep;
    if (whole && !underPill) shown.add(label.key);
  }
  return shown;
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
  const offered = tiles(card.model, CARD_TILE_PX);
  const frame = cardFrame(card, inner.width, inner.height, lift);
  // The card never pans, so only the paper inside it (and a little round it) is drawn.
  const within = [Math.floor(-frame.x / frame.sx) - 20, Math.floor(-frame.y / frame.sy) - 20, Math.ceil((inner.width - frame.x) / frame.sx) + 20, Math.ceil((inner.height - frame.y) / frame.sy) + 20] as const;
  const city = usePaperCity();
  const title = city.words(card.key);
  const labels = useMemo(() => cardLabels(frame, inner.width, inner.height, title, city.words, city.labels), [frame.x, frame.y, frame.sx, frame.sy, inner.width, inner.height, title, city]);
  return (
    <section className={`paper-card ${className}`} style={{ width, height, ...style }} aria-label={title} data-card={card.id} data-current={current} onClick={onCard}>
      <div className="paper-card-in">
        {drawn ? <World variant="card" uid={`card-${card.id}`} frame={frame} within={within} stops={stops} names={names} marks={marks} tiles={tiles} pinPx={50} route={route} onPick={onPick} labels={labels} /> : null}
      </div>
      <span className="paper-card-title" data-card-title>
        <span className="paper-card-tile">{offered === null ? null : <img {...offered} alt="" width={CARD_TILE_PX} height={CARD_TILE_PX} draggable={false} />}</span>
        {title}
      </span>
    </section>
  );
});
