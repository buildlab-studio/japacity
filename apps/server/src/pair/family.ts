// person:family-requests-shared: a family request shared between siblings who are both
// players. A request that opens in one life opens in every linked sibling's
// life at home with the same terms; the first copy paid closes the others,
// each told it was handled. Carried in the same transaction as the command
// that opened or paid it.
import type { BaseEvent, OfferState, Terms } from "@japacity/sim";
import { flip, side } from "@japacity/sim";

import type { Live } from "../authority/load";
import type { Scope } from "./carry";
import { openBond, sendTo, sideLive } from "./step";

type OfferEvent = { type: "offer/opened"; item: OfferState } | { type: "offer/taken"; id: string; entry: OfferState["entry"]; choice: string };

/** The linked sibling lives held in this transaction, each with an open bond to `live`. */
function siblingsOf(scope: Scope, live: Live): Live[] {
  const found: Live[] = [];
  for (const key of scope.book.keys()) {
    const record = scope.book.get(key);
    if (record === null || record.ended !== null || record.role !== "sibling" || (record.a !== live.id && record.b !== live.id) || openBond(live.state, key) === null) continue;
    const other = sideLive(scope.lives, record, flip(side(record, live.id)));
    if (other !== null) found.push(other);
  }
  return found;
}

/** A choice that takes money: the paying choice person:family-requests-shared means. */
function pays(live: Live, entry: OfferState["entry"], choice: string): boolean {
  return live.content.offer[entry]?.choices.find((each) => each.id === choice)?.effects.some((effect) => effect.type === "money/take") ?? false;
}

/**
 * Sends the copies and the handled notices for the offer events of one
 * accepted command. A sibling whose life refuses the copy (its
 * prologue open, the same request open already) is left out and the command
 * still goes, since the request was the opener's own.
 */
export function shareFamily(scope: Scope, live: Live, events: readonly BaseEvent[]): void {
  for (const event of events as readonly (BaseEvent & Partial<OfferEvent>)[]) {
    if (event.type === "offer/opened" && event.item !== undefined && live.content.offer[event.item.entry]?.group === "family") {
      const { entry, terms } = event.item;
      for (const sibling of siblingsOf(scope, live)) {
        if (sibling.state.place.where === "home") sendTo(scope.turn, sibling, { type: "people/family-request", offer: entry, terms });
      }
    }
    if (event.type === "offer/taken" && event.entry !== undefined && event.choice !== undefined && live.content.offer[event.entry]?.group === "family" && pays(live, event.entry, event.choice)) {
      const entry = event.entry;
      for (const sibling of siblingsOf(scope, live)) {
        const copy = Object.values(sibling.state.offer.items).find((item) => item.entry === entry);
        if (copy !== undefined) sendTo(scope.turn, sibling, { type: "people/family-request", offer: entry, terms: copy.terms satisfies Terms, handled: true });
      }
    }
  }
}
