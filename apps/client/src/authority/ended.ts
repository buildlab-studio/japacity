// What a life keeps on the device beside its save (account.md R-ACCOUNT-030): when the life ends, all of it goes
// with it, so the next life starts at the front door filled in as a first visit is, and nothing of the old life
// (its person, its month, its days, its cards, the place it stood) shows in the new one. The settings of the
// device (the look, the sound, the graphics) stay.
import { browserStorage, CARDS_KEY, CITY_BEEN_KEY, CITY_LAST_KEY, DAYS_KEY, DOOR_KEY, MONTH_KEY, PERSON_KEY, SEEN_KEY, TAUGHT_KEY, TRAIL_KEY } from "../shared/kept/storage";

/** The keys the life is kept under beside the save. */
export const LIFE_KEYS: readonly string[] = [PERSON_KEY, MONTH_KEY, DAYS_KEY, DOOR_KEY, TRAIL_KEY, CARDS_KEY, CITY_LAST_KEY, CITY_BEEN_KEY, SEEN_KEY, TAUGHT_KEY];

type Forget = Pick<Storage, "removeItem">;

/** Drops everything the ended life kept on the device. False when a blocked storage refused a key (it kept nothing to drop). */
export function forgetLife(storage: Forget | null = browserStorage()): boolean {
  let all = true;
  for (const key of LIFE_KEYS) {
    try {
      storage?.removeItem(key);
    } catch {
      all = false;
    }
  }
  return all;
}
