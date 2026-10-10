// What a life keeps on the device beside its save (account.md R-ACCOUNT-030): when the life ends, all of it goes
// with it, so the next life starts at the front door filled in as a first visit is, and nothing of the old life
// (its person, its month, its days, its cards, the place it stood) shows in the new one. The settings of the
// device (the look, the sound, the graphics) stay.
import { KEPT_CARDS } from "../shared/card/kept";
import { DOOR_KEY } from "../shared/datapage/door";
import { CITY_LAST_KEY } from "../shared/days/standing";
import { SEEN_KEY } from "../shared/phone/newsSeen";
import { PERSON_KEY } from "./person";

/**
 * The keys the life is kept under beside the save. The days (`shared/days/days.store.ts`), the years' trail
 * (`features/prologue/years.ts`) and the places been (`features/city/City.tsx`) are named here as written there,
 * since those modules reach back into the store; a test holds the first two to their own constants.
 */
export const LIFE_KEYS: readonly string[] = [PERSON_KEY, "japacity.month", "japacity.days", DOOR_KEY, "japacity.door.years", KEPT_CARDS, CITY_LAST_KEY, "japacity.city.been", SEEN_KEY];

type Forget = Pick<Storage, "removeItem">;

function browserStorage(): Forget | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Some browsers throw on access when storage is blocked.
    return null;
  }
}

/** Drops everything the ended life kept on the device. */
export function forgetLife(storage: Forget | null = browserStorage()): void {
  for (const key of LIFE_KEYS) {
    try {
      storage?.removeItem(key);
    } catch {
      // A blocked storage kept nothing to drop.
    }
  }
}
