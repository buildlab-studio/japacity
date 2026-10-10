// The days of the month as the interface keeps them (docs/rules/world.md R-WORLD-030): one record
// for the month in hand, kept on the device beside the month's plan (the store's own memory) so a
// reload lands on the same day, and replaced when the month turns. The game store is watched for
// what moves them; nothing here sends a command or touches the view.
import { useEffect, useSyncExternalStore } from "react";

import { useGameStoreIfAny } from "../../authority/GameProvider";
import type { GameStore } from "../../authority/store";
import { type MonthDays, stepDays } from "./days";

export const DAYS_KEY = "japacity.days";

function read(): MonthDays | null {
  try {
    const kept = localStorage.getItem(DAYS_KEY);
    if (kept === null) return null;
    const parsed: unknown = JSON.parse(kept);
    if (typeof parsed !== "object" || parsed === null) return null;
    const days = parsed as MonthDays;
    if (typeof days.day !== "number" || typeof days.month !== "number" || typeof days.scenario !== "string" || !Array.isArray(days.told)) return null;
    return { ...days, since: typeof days.since === "object" && days.since !== null ? days.since : {} };
  } catch {
    return null;
  }
}

let held: MonthDays | null | undefined;
const listeners = new Set<() => void>();

export function currentDays(): MonthDays | null {
  if (held === undefined) held = read();
  return held;
}

function keep(next: MonthDays | null): void {
  if (next === currentDays()) return;
  held = next;
  try {
    if (next === null) localStorage.removeItem(DAYS_KEY);
    else localStorage.setItem(DAYS_KEY, JSON.stringify(next));
  } catch {
    // A private window: the days last for this visit only.
  }
  for (const listener of listeners) listener();
}

/** Drops the days kept: a new life, or a test's own start. */
export function forgetDays(): void {
  keep(null);
  held = undefined;
}

/** Marks lines as told on the phone, so they no longer wait. */
export function tellSignals(keys: readonly string[]): void {
  const days = currentDays();
  if (days === null) return;
  const fresh = keys.filter((key) => !days.told.includes(key));
  if (fresh.length > 0) keep({ ...days, told: [...days.told, ...fresh] });
}

/** One watch per store, however many screens ask for the days, so a move counts once. */
const watched = new WeakMap<GameStore, { count: number; stop: () => void }>();

/** Counts the days from the store's moves until the returned function is called. */
export function watchDays(store: GameStore): () => void {
  const held = watched.get(store);
  if (held !== undefined) {
    held.count += 1;
  } else {
    const stop = store.subscribe((state, before) => {
      if (state.view === before.view && state.plan === before.plan && state.lines === before.lines) return;
      keep(stepDays(currentDays(), before, state));
    });
    // The month in hand gets its record (and its job its first day) as soon as it is watched.
    const state = store.getState();
    keep(stepDays(currentDays(), { view: null, plan: [], lines: [] }, state));
    watched.set(store, { count: 1, stop });
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    const entry = watched.get(store);
    if (entry === undefined) return;
    entry.count -= 1;
    if (entry.count === 0) {
      entry.stop();
      watched.delete(store);
    }
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The days kept, counted from the game store in hand while a screen shows them. */
export function useMonthDays(): MonthDays | null {
  const store = useGameStoreIfAny();
  useEffect(() => (store === null ? undefined : watchDays(store)), [store]);
  return useSyncExternalStore(subscribe, currentDays, currentDays);
}
