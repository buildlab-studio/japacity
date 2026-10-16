// A painted city (docs/rules/world.md R-WORLD-015, R-WORLD-038): everything the folding map needs to draw one city
// on its paper, so the same strip, cards and open map draw Lagos or London. Lagos's lives in lagos.tsx; London's in its
// own chunk (london.tsx), loaded only when the map shows the UK, so a first visit at home carries none of it.
import type { ReactNode } from "react";

import type { Card } from "./districts";
import type { Drawing, DrawSource } from "./draw";
import type { Point, Position } from "./fit";
import type { Decor, Label } from "./geometry";
import type { Placer } from "./stops";

/** A small picture that stays standing on the folded paper. */
export interface Mini {
  model: string;
  at: Point;
  size: number;
}

/** A landmark standing upright on the strip, drawn at its own shape inside a small box. */
export interface StripMark {
  id: string;
  at: Point;
  draw: () => ReactNode;
}

export interface PaperCity extends Placer {
  id: string;
  /** The paper's own extent, in paper units. */
  paper: { width: number; height: number };
  fromPaper: (point: Point) => Position;
  draw: DrawSource;
  /** Where the open sea's darker blue starts down the paper, or null for a city with no sea. */
  seaFrom: number | null;
  /** The parks, as [x, y, rx, ry] on the paper. */
  parks: readonly (readonly [number, number, number, number])[];
  labels: readonly Label[];
  waterLabels: readonly Label[];
  decor: readonly Decor[];
  /** The neighbourhood cards in the swipe's order, and the one to fall back on. */
  cards: readonly Card[];
  fallbackCard: string;
  strip: { top: number; bottom: number; minis: readonly Mini[]; landmarks: readonly StripMark[] };
  /** The city's own drawings on the whole paper, under the water's names and over them. */
  under: (uid: string, drawn: Drawing) => ReactNode;
  over: (drawn: Drawing) => ReactNode;
  /** How far the open map's first look stands from the card's middle, on a phone and on a laptop, in paper units. */
  opening: { phone: Point; wide: Point };
  /** Where the lantern canoe floats, or null where there is none (R-WORLD-036 is Lagos's alone). */
  canoe: Point | null;
  /** The city's own words: its districts, cards and water, then the map's. */
  words: (key: string, params?: Record<string, string | number>) => string;
  /** How much larger than the rest a place's sticker stands, by id. */
  sizes: Readonly<Record<string, number>>;
}
