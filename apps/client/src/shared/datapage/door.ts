// The front door's run as answered so far (prologue.md R-PROLOGUE-009): the step it is at and every answer, kept on
// the device under one key of its own, so a reload at any step comes back to that step. The life itself is written
// only at Begin (the authority keeps the save unwritten until a life is chosen).

/** The one localStorage key the run is kept under. */
export const DOOR_KEY = "japacity.door";

/**
 * The steps of the run, in order (R-PROLOGUE-013): `you` (the name and the look), `life` (the tiles and the age under
 * them), `page`; `ready` is the ready lives' list in the place of the tiles, for a run Settings asked for; `begun` once
 * Begin was pressed.
 */
export const DOOR_STAGES = ["you", "life", "ready", "page", "begun"] as const;
export type DoorStage = (typeof DOOR_STAGES)[number];

export interface DoorDraft {
  stage: DoorStage;
  /** A shipped person's file name, `chr_ada`. */
  look: string;
  /** The tile picked, or null. */
  archetype: string | null;
  /** The ready life picked instead of a tile, or null. */
  ready: string | null;
  /** The name as it stands: filled from the pool, or typed. */
  name: string;
  /** True once the player typed the name: a new look then keeps it, where a filled one follows the look's sex. */
  typed?: boolean;
  /** True for a run Settings asked for: its second screen lists the ready lives in the place of the tiles. */
  asked?: boolean;
  /** Where the life starts (R-PROLOGUE-013): the home step's answer, the tile's own until the player picks the other. */
  home?: string;
  /** True once the player picked the home: a new tile or age keeps it while the life can still move in. */
  homePicked?: boolean;
  /** Which three names the pool suggests. */
  roll: number;
  /** Years from the tile's own age (R-PROLOGUE-009): negative is younger. */
  age: number;
}

type Read = Pick<Storage, "getItem">;
type Write = Pick<Storage, "setItem">;

function browserStorage(): (Read & Write) | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Some browsers throw on access when storage is blocked.
    return null;
  }
}

function isDraft(value: unknown): value is DoorDraft {
  if (typeof value !== "object" || value === null) return false;
  const { stage, look, archetype, ready, name, roll, age, typed, asked, home, homePicked } = value as Record<string, unknown>;
  return (
    typeof stage === "string" &&
    (DOOR_STAGES as readonly string[]).includes(stage) &&
    typeof look === "string" &&
    (archetype === null || typeof archetype === "string") &&
    (ready === null || typeof ready === "string") &&
    typeof name === "string" &&
    typeof roll === "number" &&
    Number.isInteger(roll) &&
    typeof age === "number" &&
    Number.isInteger(age) &&
    (typed === undefined || typeof typed === "boolean") &&
    (asked === undefined || typeof asked === "boolean") &&
    (home === undefined || typeof home === "string") &&
    (homePicked === undefined || typeof homePicked === "boolean")
  );
}

/** The run kept on this device, or null when none is, or what is kept cannot be read. */
export function readDoor(storage: Read | null = browserStorage()): DoorDraft | null {
  try {
    const raw = storage?.getItem(DOOR_KEY) ?? null;
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function keepDoor(draft: DoorDraft, storage: Write | null = browserStorage()): void {
  try {
    storage?.setItem(DOOR_KEY, JSON.stringify(draft));
  } catch {
    // A private window may refuse storage; the run then lasts the visit only.
  }
}
