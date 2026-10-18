// A sibling made from an invite: docs/rules/person.md R-PEOPLE-011, decision
// 0020. The new life begins inside the inviter's family, so its sibling slots
// are that family's: the inviter in the first, the others computer lives drawn
// as R-PEOPLE-047 draws them once the prologue closes. Pure: `newState` calls
// it on the slice `initial` built.
import type { PeopleSlice, Save } from "../engine/types";

/** The slot the inviter holds in the sibling's life. */
export const INVITER_SLOT = "sibling-1";
const SIBLING_PREFIX = "sibling-";

/**
 * The sibling slots of a life begun in the inviter's family: as many as the
 * inviter has siblings (this life is one of them, the inviter takes its
 * place), at least the inviter's own. The inviter's slot waits as a card for
 * the authority's `people/link`, which names the pair once both lives exist.
 * The new character's id, and so the pair's, is not known when the
 * state is built, so the link fills the slot as it fills any card.
 */
export function familySlots(slice: PeopleSlice, family: NonNullable<Save["family"]>): PeopleSlice {
  const slots: PeopleSlice["slots"] = {};
  for (const [key, slot] of Object.entries(slice.slots)) if (!key.startsWith(SIBLING_PREFIX)) slots[key] = slot;
  const count = Math.max(1, family.draw.siblings);
  for (let index = 1; index <= count; index += 1) {
    const key = `${SIBLING_PREFIX}${String(index)}`;
    slots[key] = key === INVITER_SLOT ? { state: "invited", bond: null, person: null, invite: { looking: "sibling", fill: null } } : { state: "computer", bond: null, person: null, invite: null };
  }
  return { ...slice, slots };
}
