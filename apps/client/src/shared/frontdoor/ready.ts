// The ready lives behind Settings (prologue.md R-PROLOGUE-013): the door never offers them. Settings' "Start from a
// ready life" asks the next door to open on their list, once, and a test asks the same way.

/** The one localStorage key that asks the door to open on the ready lives. */
export const READY_ASK_KEY = "japacity.door.ready";

type Kept = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): Kept | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Some browsers throw on access when storage is blocked.
    return null;
  }
}

/** Asks the next door to open on the ready lives. */
export function askReadyLives(storage: Pick<Kept, "setItem"> | null = browserStorage()): void {
  try {
    storage?.setItem(READY_ASK_KEY, "1");
  } catch {
    // A private window may refuse storage; the door then opens as it always does.
  }
}

/** True when the door was asked to open on the ready lives; reading the ask spends it. */
export function takeReadyAsk(storage: Pick<Kept, "getItem" | "removeItem"> | null = browserStorage()): boolean {
  try {
    if ((storage?.getItem(READY_ASK_KEY) ?? null) === null) return false;
    storage?.removeItem(READY_ASK_KEY);
    return true;
  } catch {
    return false;
  }
}
