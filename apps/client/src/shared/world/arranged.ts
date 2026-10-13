// The room's own arrangement: where the player set down each thing they own in a home
// of their own, by home and thing, as `[x, z, turn]` in the place's metres. What is owned is the simulation's; where it
// stands is the room's, kept on the device beside the save as a place's first names are (world.md R-WORLD-005), under
// one key of its own that goes when the life ends, with the life's scenario so another life's arrangement is never read.

/** The one localStorage key the arrangement is kept under, beside `japacity.save` and `japacity.taught`. */
export const ARRANGED_KEY = "japacity.arranged";

export type Arranged = Record<string, [number, number, number]>;

interface Kept {
  scenario: string;
  homes: Record<string, Arranged>;
}

type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): Store | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Some browsers throw on access when storage is blocked.
    return null;
  }
}

function isSpot(value: unknown): value is [number, number, number] {
  return Array.isArray(value) && value.length === 3 && value.every((side) => typeof side === "number" && Number.isFinite(side));
}

function read(scenario: string, storage: Store | null): Record<string, Arranged> {
  try {
    const raw = storage?.getItem(ARRANGED_KEY) ?? null;
    if (raw === null) return {};
    const kept: unknown = JSON.parse(raw);
    if (typeof kept !== "object" || kept === null) return {};
    const { scenario: owner, homes } = kept as Partial<Kept>;
    if (owner !== scenario || typeof homes !== "object" || homes === null) return {};
    const clean: Record<string, Arranged> = {};
    for (const [home, spots] of Object.entries(homes)) {
      if (typeof spots !== "object" || spots === null) continue;
      clean[home] = Object.fromEntries(Object.entries(spots as Record<string, unknown>).filter((entry): entry is [string, [number, number, number]] => isSpot(entry[1])));
    }
    return clean;
  } catch {
    return {};
  }
}

/** Where the player set each thing down in a home, empty when they never moved one there. */
export function arrangedIn(home: string, scenario: string, storage: Store | null = browserStorage()): Arranged {
  return read(scenario, storage)[home] ?? {};
}

/** Keeps where a thing was set down in a home. */
export function keepArranged(home: string, thing: string, spot: [number, number, number], scenario: string, storage: Store | null = browserStorage()): Arranged {
  const homes = read(scenario, storage);
  const next: Arranged = { ...(homes[home] ?? {}), [thing]: spot };
  try {
    storage?.setItem(ARRANGED_KEY, JSON.stringify({ scenario, homes: { ...homes, [home]: next } } satisfies Kept));
  } catch {
    // A private window may refuse storage; the arrangement then lasts the visit only.
  }
  return next;
}

/** Drops the arrangement: a new life's rooms stand as their files set them. */
export function forgetArranged(storage: Store | null = browserStorage()): void {
  try {
    storage?.removeItem(ARRANGED_KEY);
  } catch {
    // Nothing kept, nothing to drop.
  }
}
