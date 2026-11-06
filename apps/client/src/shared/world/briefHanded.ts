// The brief last handed (docs/design/09-the-games-look.md section 4): once the mission card's Let's go
// is pressed, the brief is carried, and the phone's Japa app takes a dot until it is next opened (the app's seen mark,
// features/phone/seen.ts). Kept on the device with the life's scenario, so another life's brief is never read as this one's.
import { useSyncExternalStore } from "react";
import { BRIEF_KEY, browserStorage } from "../storage/storage";
import { listeners } from "../listeners/listeners";

interface Kept {
  scenario: string;
  /** Every chapter whose brief has been handed in this life, in the order handed. */
  handed: string[];
  /** By chapter, the things already met as its brief was handed (chapter:first-chapter-mission-card). */
  before?: Record<string, string[]>;
}

const { subscribe, notify } = listeners();
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

/**
 * The things of a chapter already met as its brief was handed, kept with the mark (chapter:first-chapter-mission-card); null when the
 * brief is not yet handed in this life, or was handed before the mark kept them.
 */
export function briefBefore(scenario: string, chapter: string): readonly string[] | null {
  const kept = read();
  if (kept?.scenario !== scenario || !kept.handed.includes(chapter)) return null;
  const before = kept.before?.[chapter];
  return Array.isArray(before) && before.every((id) => typeof id === "string") ? before : null;
}

/** Keeps that the brief was handed, and what of it was met by then: the Japa app's dot shows until it is opened. */
export function handBrief(scenario: string, chapter: string, before: readonly string[] = []): void {
  const handed = briefsHanded(scenario);
  if (handed.includes(chapter)) return;
  const kept = read();
  const earlier = kept?.scenario === scenario ? (kept.before ?? {}) : {};
  try {
    browserStorage()?.setItem(BRIEF_KEY, JSON.stringify({ scenario, handed: [...handed, chapter], before: { ...earlier, [chapter]: [...before] } } satisfies Kept));
  } catch {
    // A private window may refuse storage; the brief is then carried for the visit only.
  }
  notify();
}

/** The Japa app's mark: the brief handed last, so a new one brings the dot back (world:phone-rises-over-scene). */
export function japaMark(scenario: string): string {
  return briefsHanded(scenario).at(-1) ?? "";
}

/** The Japa mark, kept current as a brief is handed. */
export function useJapaMark(scenario: string): string {
  return useSyncExternalStore(
    subscribe,
    () => japaMark(scenario),
    () => japaMark(scenario),
  );
}
