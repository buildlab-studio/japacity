// world:lazy-part-fails-softly: a mark in the browser's storage that a life opened here, so the next load fetches the life's screens at
// once, as for a kept person, even where only the account knows the character. The mark holds no account data. It is set when a life
// opens, from a kept person or from the account's character, and goes when the browser is left with no life to open: signed out (by
// the player, by a deletion or by the server), told the account has no character, or a life ended with none chosen after it. Only the
// fetches ahead read it (the page's hint and App.tsx); no screen is chosen on it, so a stale mark costs one early download of the life's
// screens and never a wrong screen.
import { browserStorage, LIFE_MARK_KEY } from "../shared/storage/storage";
import type { GameState, GameStore } from "./store";

type Kept = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** True when this browser marked a life opened here; storage that cannot be read counts as no mark. */
export function lifeMarked(storage: Pick<Storage, "getItem"> | null = browserStorage()): boolean {
  try {
    return storage?.getItem(LIFE_MARK_KEY) === "1";
  } catch {
    return false;
  }
}

/** Whether the state shows a life open, no life to open, or neither yet (the first view still coming). */
function lifeIn(state: Pick<GameState, "view" | "signedOut" | "choosingLife">): "open" | "none" | null {
  if (state.signedOut) return "none";
  if (state.view !== null) return "open";
  if (state.choosingLife) return "none";
  return null;
}

/** Keeps the mark with the store: set as a life opens, gone once there is none. Writes only when it changes. Returns the unsubscribe. */
export function followLifeMark(store: GameStore, storage: Kept | null = browserStorage()): () => void {
  let marked = lifeMarked(storage);
  const follow = (state: GameState) => {
    const life = lifeIn(state);
    if (life === null || (life === "open") === marked) return;
    try {
      if (life === "open") storage?.setItem(LIFE_MARK_KEY, "1");
      else storage?.removeItem(LIFE_MARK_KEY);
    } catch {
      // Storage refused (a private window): nothing is kept, so the life's screens come as they would with no mark, and the next change tries again.
      return;
    }
    marked = life === "open";
  };
  follow(store.getState());
  return store.subscribe(follow);
}
