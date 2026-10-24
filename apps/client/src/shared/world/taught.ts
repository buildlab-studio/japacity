// What a life has been shown once (chapter:first-chapter-mission-card; world:top-band-is-a-pill, world:things-are-tappable-models, world:sleep-ends-the-month;
// home:moves-carry-cost-and-reason): the first chapter's title, the Calendar's teach card, a place's labels on its first entry, a home's
// blurb and the first night's card. Kept on the device beside the save and the person, under one key of its own that goes when the life ends
// (authority/ended.ts), so a reload never shows a mark again and a new life starts with none. The life's scenario is
// kept with the marks, so marks left by another life are never read as this one's.
import { browserStorage, TAUGHT_KEY } from "../storage/storage";

/** The marks: the first chapter's title, the Calendar's teach card, a place's labels, a home's blurb, the first night. */
export type TaughtMark = "title" | "calendar" | "night" | `place:${string}` | `home:${string}`;

interface Kept {
  scenario: string;
  marks: string[];
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function read(scenario: string, storage: Store | null): string[] {
  try {
    const raw = storage?.getItem(TAUGHT_KEY) ?? null;
    if (raw === null) return [];
    const kept: unknown = JSON.parse(raw);
    if (typeof kept !== "object" || kept === null) return [];
    const { scenario: owner, marks } = kept as Partial<Kept>;
    if (owner !== scenario || !Array.isArray(marks)) return [];
    return marks.filter((mark): mark is string => typeof mark === "string");
  } catch {
    return [];
  }
}

/** True when this life has already been shown the mark. */
export function wasTaught(mark: TaughtMark, scenario: string, storage: Store | null = browserStorage()): boolean {
  return read(scenario, storage).includes(mark);
}

/** Keeps that this life has been shown the mark, so it never shows again in it. */
export function markTaught(mark: TaughtMark, scenario: string, storage: Store | null = browserStorage()): void {
  const marks = read(scenario, storage);
  if (marks.includes(mark)) return;
  try {
    storage?.setItem(TAUGHT_KEY, JSON.stringify({ scenario, marks: [...marks, mark] } satisfies Kept));
  } catch {
    // A private window may refuse storage; the mark then lasts the visit only.
  }
}

/** Drops every mark: a new life is taught afresh. */
export function forgetTaught(storage: Store | null = browserStorage()): void {
  try {
    storage?.removeItem(TAUGHT_KEY);
  } catch {
    // Nothing kept, nothing to drop.
  }
}
