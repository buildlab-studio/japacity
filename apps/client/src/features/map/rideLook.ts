// The player's own person as a ride shows them, kept apart from the ride itself so the map can name it while the ride's own part,
// with its scene, is fetched only when a ride is near (world:lazy-part-fails-softly, engine:first-download-has-budget).
import { DEFAULT_LOOK } from "../../shared/front-door/looks";
import { keptLookFile } from "../../shared/front-door/person";

/** The look the city falls back to when the life's own person is not shipped (City.tsx). */
export const FALLBACK_OWN = `shared/person/${DEFAULT_LOOK}.glb`;

/** The player's own person file as the city names it (City.tsx): the look built at the front door (prologue:front-door-builds-a-person), else the city's own, since a ready life has no person of its own (scenario.md); the ride settles it against what is shipped. */
export function ownLook(kept: string | null = keptLookFile()): string {
  return kept ?? FALLBACK_OWN;
}
