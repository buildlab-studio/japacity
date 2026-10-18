// The cards a player has had, kept on this device only (docs/rules/share.md
// R-SHARE-011: a card is never stored on the server). A card goes in when it is
// closed, once.
import type { JapaType } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import type { ShareCard } from "../../shared/card/face";
import { cardKey } from "../../shared/ui/stage";
import type { Seat } from "../../shared/world/sendOff";

export interface Kept {
  key: string;
  scenario: Id<"scenario">;
  card: ShareCard;
  /** The japa type read when the send-off was due, kept with that card (decision 0024); absent on every other card. */
  type?: JapaType;
  /** The seat the counter gave at the send-off (share.md R-SHARE-015), kept with that card for its stub; absent on every other card. */
  seat?: Seat;
}

interface Gallery {
  kept: Kept[];
  keep: (scenario: Id<"scenario">, card: ShareCard, type?: JapaType | null, seat?: Seat | null) => void;
  clear: () => void;
}

const STORAGE = "japacity.cards";
const MOST_KEPT = 60;

function load(): Kept[] {
  try {
    const stored = localStorage.getItem(STORAGE);
    if (stored === null) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? (parsed as Kept[]) : [];
  } catch {
    return [];
  }
}

function save(kept: Kept[]): void {
  try {
    localStorage.setItem(STORAGE, JSON.stringify(kept));
  } catch {
    // A full or blocked store keeps the gallery for this visit only.
  }
}

export const gallery = createStore<Gallery>()((set, get) => ({
  kept: load(),
  keep(scenario, card, type = null, seat = null) {
    const key = cardKey(card);
    if (key === null || get().kept.some((entry) => entry.key === key && entry.scenario === scenario)) return;
    const kept = [{ key, scenario, card, ...(type === null ? {} : { type }), ...(seat === null || card.kind !== "send-off" ? {} : { seat }) }, ...get().kept].slice(0, MOST_KEPT);
    save(kept);
    set({ kept });
  },
  clear() {
    save([]);
    set({ kept: [] });
  },
}));

/**
 * The cards of this life, newest first: the same character, and no card from
 * later than the month the life is in, which a new life of the same character
 * has not reached.
 */
export function useKept(scenario: Id<"scenario">, month: number): Kept[] {
  const kept = useStore(gallery, (state) => state.kept);
  return kept.filter((entry) => entry.scenario === scenario && entry.card.months <= month);
}
