// The room's own arrangement: where the player set down each thing they own in a home
// of their own, by home and thing, as `[x, z, turn]` in the place's metres. What is owned is the simulation's; where it
// stands is the room's, kept on the device beside the save as a place's first names are (world.md R-WORLD-005), under
// one key of its own that goes when the life ends, with the life's scenario so another life's arrangement is never read.
// The way a wide home's view is turned is kept under the same key, by home, as a quarter from 0 to
// 3, so a reload opens the house as it was left.

/** The one localStorage key the arrangement is kept under, beside `japacity.save` and `japacity.taught`. */
export const ARRANGED_KEY = "japacity.arranged";

export type Arranged = Record<string, [number, number, number]>;

interface Kept {
  scenario: string;
  homes: Record<string, Arranged>;
  /** The quarter each wide home's view was left turned to. */
  turns?: Record<string, number>;
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

const isQuarter = (value: unknown): value is number => value === 0 || value === 1 || value === 2 || value === 3;

/** What the device keeps for this life: the homes' arrangements and their turns, each cleaned of anything malformed. */
function readKept(scenario: string, storage: Store | null): { homes: Record<string, Arranged>; turns: Record<string, number> } {
  try {
    const raw = storage?.getItem(ARRANGED_KEY) ?? null;
    if (raw === null) return { homes: {}, turns: {} };
    const kept: unknown = JSON.parse(raw);
    if (typeof kept !== "object" || kept === null) return { homes: {}, turns: {} };
    const { scenario: owner, homes, turns } = kept as Partial<Kept>;
    if (owner !== scenario) return { homes: {}, turns: {} };
    const clean: Record<string, Arranged> = {};
    for (const [home, spots] of Object.entries(typeof homes === "object" && homes !== null ? homes : {})) {
      if (typeof spots !== "object" || spots === null) continue;
      clean[home] = Object.fromEntries(Object.entries(spots as Record<string, unknown>).filter((entry): entry is [string, [number, number, number]] => isSpot(entry[1])));
    }
    const quarters = Object.fromEntries(Object.entries(typeof turns === "object" && turns !== null ? turns : {}).filter((entry): entry is [string, number] => isQuarter(entry[1])));
    return { homes: clean, turns: quarters };
  } catch {
    return { homes: {}, turns: {} };
  }
}

function read(scenario: string, storage: Store | null): Record<string, Arranged> {
  return readKept(scenario, storage).homes;
}

function write(scenario: string, kept: { homes: Record<string, Arranged>; turns: Record<string, number> }, storage: Store | null): void {
  try {
    storage?.setItem(ARRANGED_KEY, JSON.stringify({ scenario, homes: kept.homes, turns: kept.turns } satisfies Kept));
  } catch {
    // A private window may refuse storage; what was kept then lasts the visit only.
  }
}

/** Where the player set each thing down in a home, empty when they never moved one there. */
export function arrangedIn(home: string, scenario: string, storage: Store | null = browserStorage()): Arranged {
  return read(scenario, storage)[home] ?? {};
}

/** Keeps where a thing was set down in a home. */
export function keepArranged(home: string, thing: string, spot: [number, number, number], scenario: string, storage: Store | null = browserStorage()): Arranged {
  const kept = readKept(scenario, storage);
  const next: Arranged = { ...(kept.homes[home] ?? {}), [thing]: spot };
  write(scenario, { homes: { ...kept.homes, [home]: next }, turns: kept.turns }, storage);
  return next;
}

/** The quarter, 0 to 3, a wide home's view was left turned to; 0, the house as its file faces it, when never turned. */
export function turnIn(home: string, scenario: string, storage: Store | null = browserStorage()): number {
  return readKept(scenario, storage).turns[home] ?? 0;
}

/** Keeps the quarter a wide home's view was turned to. */
export function keepTurn(home: string, quarter: number, scenario: string, storage: Store | null = browserStorage()): number {
  const kept = readKept(scenario, storage);
  const clean = ((Math.round(quarter) % 4) + 4) % 4;
  write(scenario, { homes: kept.homes, turns: { ...kept.turns, [home]: clean } }, storage);
  return clean;
}

/** Drops the arrangement: a new life's rooms stand as their files set them. */
export function forgetArranged(storage: Store | null = browserStorage()): void {
  try {
    storage?.removeItem(ARRANGED_KEY);
  } catch {
    // Nothing kept, nothing to drop.
  }
}
