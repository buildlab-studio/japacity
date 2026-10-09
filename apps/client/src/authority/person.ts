// The person built at the front door (prologue.md R-PROLOGUE-009, 010): a look, a first name and an
// archetype. The simulation holds none of them: they are kept on the device beside the save, under one
// key of their own, and the city and the rides draw the character in the look. Online, presence already
// carries a look; the server would keep these three beside the character the same way.

/** The one localStorage key the person is kept under, beside `japacity.save`. */
export const PERSON_KEY = "japacity.person";

export interface KeptPerson {
  /** A shipped person's file name, `chr_ada`: a whole look, never a stat. */
  look: string;
  /** The character's first name, from the pool. Never the account's. */
  name: string;
  /** The archetype whose preset the prologue plays, or null for a ready life. */
  archetype: string | null;
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

function isPerson(value: unknown): value is KeptPerson {
  if (typeof value !== "object" || value === null) return false;
  const { look, name, archetype } = value as Record<string, unknown>;
  return typeof look === "string" && /^chr_[a-z_]+$/.test(look) && typeof name === "string" && (archetype === null || typeof archetype === "string");
}

/** The person kept on this device, or null when none is, or what is kept cannot be read. */
export function readPerson(storage: Read | null = browserStorage()): KeptPerson | null {
  try {
    const raw = storage?.getItem(PERSON_KEY) ?? null;
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPerson(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function keepPerson(person: KeptPerson, storage: Write | null = browserStorage()): void {
  try {
    storage?.setItem(PERSON_KEY, JSON.stringify(person));
  } catch {
    // A private window may refuse storage; the person then lasts the visit only.
  }
}

/** The kept look as a shipped file, `shared/chr/chr_ada.glb`, or null when no look is kept. */
export function keptLookFile(storage: Read | null = browserStorage()): string | null {
  const person = readPerson(storage);
  return person === null ? null : `shared/chr/${person.look}.glb`;
}
