// Offers: docs/rules/offer.md. Stub: none open (R-SCENARIO-002). The view
// never carries `secret` (R-OFFER-006, R-ENGINE-007).
import type { RegisteredKind } from "../engine/kind";
import { effectsNotBuilt } from "../engine/stub";
import type { OfferSlice, OfferView } from "../engine/types";
import type { OfferEvent } from "./offer.events";

export const offerKind: RegisteredKind<OfferSlice, OfferEvent> = {
  kind: "offer",
  initial: () => ({ items: {}, lastOpened: {}, timesOpened: {} }),
  effects: effectsNotBuilt(["offer/open"]),
  evolve: (slice) => slice,
  invariants(state, content) {
    const problems: string[] = [];
    for (const [id, item] of Object.entries(state.offer.items)) {
      if (item.id !== id) problems.push(`Offer ${id} is stored under the wrong key.`);
      if (content.offer[item.entry] === undefined) problems.push(`Offer ${id} names ${item.entry}, which is not in content.`);
    }
    return problems;
  },
  view: ({ state }) => ({
    offers: Object.values(state.offer.items).map(
      (item): OfferView => ({
        id: item.id,
        entry: item.entry,
        openedMonth: item.openedMonth,
        expiresMonth: item.expiresMonth,
        terms: item.terms,
        signs: item.signs,
        choices: [],
      }),
    ),
  }),
};
