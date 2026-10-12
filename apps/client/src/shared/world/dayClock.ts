// The world's own clock on the device (docs/rules/clock.md R-CLOCK-033; decision 0036): the game's day, the same moment
// for everyone, read from the authority's last reply and between replies from the device's time with the same pure
// function. The band says its part of the day in words and the night asks for bed; never a time with digits.
import { type DayPart, type WorldClock, worldClockAt } from "@japacity/sim";
import { useEffect, useState, useSyncExternalStore } from "react";

import { useGameStoreIfAny } from "../../authority/GameProvider";
import type { GameStore } from "../../authority/store";

/** The device reads the world's clock again this often between replies: a part of the day lasts half a real hour. */
export const DAY_CLOCK_MS = 60_000;

const PARTS: readonly DayPart[] = ["morning", "afternoon", "evening", "night"];

/**
 * The part of the day a development build was asked to stand at (`?clock=night`), for pictures and play at any hour;
 * null otherwise, and always null in a build for players.
 */
export function devClockPart(search: string, dev: boolean = import.meta.env.DEV): DayPart | null {
  if (!dev) return null;
  const asked = new URLSearchParams(search).get("clock");
  return PARTS.find((part) => part === asked) ?? null;
}

/** The world's clock as it stands: the reply's reading until the device's next one, a development switch over both. */
export function dayClockOf(served: WorldClock | null, device: WorldClock, asked: DayPart | null): WorldClock {
  const clock = served ?? device;
  return asked === null ? clock : { ...clock, part: asked };
}

function search(): string {
  return typeof location === "undefined" ? "" : location.search;
}

/** The store's last served clock, or null outside a game or before a reply. */
function useServed(store: GameStore | null): WorldClock | null {
  return useSyncExternalStore(
    (listener) => store?.subscribe(listener) ?? (() => undefined),
    () => store?.getState().clock?.world ?? null,
  );
}

/**
 * The world's clock, moving on the device every minute (R-CLOCK-033): a reply's reading wins as it lands, and the
 * device's own reading takes over at the next minute.
 */
export function useDayClock(): WorldClock & { served: boolean } {
  const store = useGameStoreIfAny();
  const served = useServed(store);
  const [reading, setReading] = useState<{ served: WorldClock | null; device: WorldClock }>(() => ({ served, device: worldClockAt(Date.now()) }));
  useEffect(() => {
    setReading((held) => (held.served === served ? held : { served, device: held.device }));
  }, [served]);
  useEffect(() => {
    const timer = window.setInterval(() => setReading({ served: null, device: worldClockAt(Date.now()) }), DAY_CLOCK_MS);
    return () => window.clearInterval(timer);
  }, []);
  // `served`: a reply has given the world's clock; before one, the device's reading stands in for the sky but nothing
  // that changes what the player is told (the night's nudge) rests on it.
  return { ...dayClockOf(reading.served, reading.device, devClockPart(search())), served: reading.served !== null || devClockPart(search()) !== null };
}
