// The brief last handed (docs/design/13-the-lively-layer.md section 4): once the mission card's Let's go
// is pressed, the brief is carried, and the phone's Japa app takes a dot until it is next opened (the app's seen mark,
// features/phone/seen.ts). Kept on the device with the life's scenario, so another life's brief is never read as this one's.
import { useSyncExternalStore } from "react";
import { BRIEF_KEY, browserStorage } from "../kept/storage";

interface Kept {
  scenario: string;
  /** Every chapter whose brief has been handed in this life, in the order handed. */
  handed: string[];
}

const listeners = new Set<() => void>();
let cache: { raw: string | null; kept: Kept | null } = { raw: null, kept: null };

function read(): Kept | null {
  try {
    const raw = browserStorage()?.getItem(BRIEF_KEY) ?? null;
    if (raw === cache.raw) return cache.kept;
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    const kept = typeof parsed === "object" && parsed !== null && typeof (parsed as Kept).scenario === "string" && Array.isArray((parsed as Kept).handed) ? (parsed as Kept) : null;
    cache = { raw, kept };
    return kept;
  } catch {
    return null;
  }
}

/** The chapters whose brief this life has been handed. */
function briefsHanded(scenario: string): readonly string[] {
  const kept = read();
  return kept?.scenario === scenario ? kept.handed : [];
}

/** True when this life has been handed the chapter's brief. */
export function briefHanded(scenario: string, chapter: string): boolean {
  return briefsHanded(scenario).includes(chapter);
}

/** Keeps that the brief was handed: the Japa app's dot shows until it is opened. */
export function handBrief(scenario: string, chapter: string): void {
  const handed = briefsHanded(scenario);
  if (handed.includes(chapter)) return;
  try {
    browserStorage()?.setItem(BRIEF_KEY, JSON.stringify({ scenario, handed: [...handed, chapter] } satisfies Kept));
  } catch {
    // A private window may refuse storage; the brief is then carried for the visit only.
  }
  for (const listener of listeners) listener();
}

/** The Japa app's mark: the brief handed last, so a new one brings the dot back (R-WORLD-018). */
export function japaMark(scenario: string): string {
  return briefsHanded(scenario).at(-1) ?? "";
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The Japa mark, kept current as a brief is handed. */
export function useJapaMark(scenario: string): string {
  return useSyncExternalStore(
    subscribe,
    () => japaMark(scenario),
    () => japaMark(scenario),
  );
}
