// What still waits on the player once an ask answered at its place is done (docs/rules/world.md R-WORLD-006;
// : the asks still open, by name, and one button to them.
import type { PlayerView } from "@japacity/sim";

import { nameOf } from "../../shared/words/text";
import { cityWords } from "./city.words";

type Offer = PlayerView["offers"][number];

/** The offers still open beyond the ones a sheet shows. */
export function stillWaiting(offers: readonly Offer[], shown: readonly string[]): Offer[] {
  return offers.filter((offer) => !shown.includes(offer.entry));
}

export function StillWaiting({ offers, onOpen }: { offers: readonly Offer[]; onOpen: () => void }) {
  if (offers.length === 0) return null;
  return (
    <div className="flex flex-col gap-2" data-still-waiting>
      <p className="text-[14px] text-text-2">{cityWords("city.asks.still", { what: offers.map((offer) => nameOf(offer.entry)).join(", ") })}</p>
      <button type="button" className="btn-main" onClick={onOpen} data-still-open>
        {cityWords("city.asks.see")}
      </button>
    </div>
  );
}
