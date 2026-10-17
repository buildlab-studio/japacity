// The fold (docs/rules/world.md R-WORLD-015): one map at two zooms with the strip as the hinge. The
// strip is the whole map folded at the top; a tap on it, or a drag down far enough, unfolds it into the open map while
// the card slides away; a tap on a district or a pin of the open map folds it back while that neighbourhood's card
// rises; folded, the cards swipe sideways. Plain states and events, whole numbers, so every step is tested. A card is
// named by its id, whichever painted city it belongs to (R-WORLD-038).
type CardId = string;

export type Phase = "folded" | "opening" | "open" | "closing";

export interface FoldState {
  phase: Phase;
  /** The neighbourhood whose card shows when folded, and rises when the map folds back. */
  card: CardId;
  /** How far a drag down on the strip has pulled the map open, from 0 to 100. */
  pull: number;
}

export type FoldEvent =
  | { type: "tap-strip" }
  | { type: "drag"; dy: number }
  | { type: "release" }
  | { type: "settled" }
  | { type: "tap-district"; card: CardId }
  | { type: "swipe"; card: CardId };

/** A drag of this many pixels opens the map all the way. */
export const DRAG_FULL = 320;
/** Let go past this much of the pull, the map opens; short of it, it folds back. */
export const PULL_OPENS = 25;
/** The fold's motion, in milliseconds: under 300 (R-WORLD-023). */
export const FOLD_MS = 280;

export function folded(card: CardId): FoldState {
  return { phase: "folded", card, pull: 0 };
}

export function fold(state: FoldState, event: FoldEvent): FoldState {
  switch (event.type) {
    case "tap-strip":
      return state.phase === "folded" ? { ...state, phase: "opening", pull: 0 } : state;
    case "drag":
      if (state.phase !== "folded") return state;
      return { ...state, pull: Math.min(100, Math.max(0, Math.round((event.dy * 100) / DRAG_FULL))) };
    case "release":
      if (state.phase !== "folded") return state;
      return state.pull >= PULL_OPENS ? { ...state, phase: "opening", pull: 0 } : { ...state, pull: 0 };
    case "settled":
      if (state.phase === "opening") return { ...state, phase: "open" };
      if (state.phase === "closing") return { ...state, phase: "folded" };
      return state;
    case "tap-district":
      return state.phase === "open" || state.phase === "opening" ? { ...state, phase: "closing", card: event.card } : state;
    case "swipe":
      return state.phase === "folded" ? { ...state, card: event.card } : state;
    default: {
      const never: never = event;
      throw new Error(`Unknown fold event: ${String(never)}`);
    }
  }
}

/** Whether the open map is on the screen (opening, open or folding back). */
export function unfolded(state: FoldState): boolean {
  return state.phase !== "folded" || state.pull > 0;
}

/**
 * The card the map opens on: the stop picked first (the nudge's step elsewhere), else the step's place while a step is
 * live, else where the player stands.
 */
export function openingCard({ picked, step, here, fallback }: { picked: CardId | null; step: CardId | null; here: CardId | null; fallback: CardId }): CardId {
  return picked ?? step ?? here ?? fallback;
}
