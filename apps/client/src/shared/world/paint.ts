// The two paints of the lively layer (docs/design/09-the-lively-layer.md, section 2; decision 0025): one system, the day's
// pale sky and the night's navy, driven by what already drives the sky, the world's clock (clock:game-day-on-real-time). One
// attribute on <html> switches the role tokens in index.css; nothing is remembered, since the clock says it every time.
import type { DayPart } from "@japacity/sim";
import { useEffect } from "react";

import { pageSearch, useDayClock } from "./dayClock";

export type Paint = "day" | "night";

const PAINTS: readonly Paint[] = ["day", "night"];

/** The paint a part of the world's day takes: the night's at night, the day's otherwise. */
export function paintOf(part: DayPart): Paint {
  return part === "night" ? "night" : "day";
}

/**
 * The paint a development build was asked to stand in (`?paint=night`), beside `?clock=`, for pictures and play at any
 * hour; null otherwise, and always null in a build for players.
 */
export function devPaint(search: string, dev: boolean = import.meta.env.DEV): Paint | null {
  if (!import.meta.env.DEV || !dev) return null;
  const asked = new URLSearchParams(search).get("paint");
  return PAINTS.find((paint) => paint === asked) ?? null;
}

/** Sets the paint on the root. */
export function applyPaint(paint: Paint, root: Pick<HTMLElement, "dataset"> = document.documentElement): void {
  root.dataset.paint = paint;
}

/**
 * Whether the night paint follows the clock for players (design page 09, section 2, "Night"): the
 * surfaces over the world read in both paints. `?paint=` still stands either paint in, in development.
 */
export const NIGHT_PAINT_LIVE = true;

/** Keeps the root's paint with the world's clock while it is mounted; gone, the root goes back to the day's. */
export function usePaint(live: boolean = NIGHT_PAINT_LIVE): Paint {
  const clock = useDayClock();
  const paint = devPaint(pageSearch()) ?? (live ? paintOf(clock.part) : "day");
  useEffect(() => {
    applyPaint(paint);
  }, [paint]);
  useEffect(
    () => () => {
      delete document.documentElement.dataset.paint;
    },
    [],
  );
  return paint;
}
