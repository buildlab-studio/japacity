// advert:real-name-only-by-agreement: the real names live campaigns put on private places, written
// into the world of each tick. Public content never holds them.
import type { World } from "@japacity/sim";

import { statusAt } from "./campaign";
import type { AdvertsDeps } from "./serve";

/** The overlay of real names at a moment. Two campaigns on one place: the first by id wins. */
export async function placeNamesAt(deps: Pick<AdvertsDeps, "stores">, at: number): Promise<World["placeNames"]> {
  const names: World["placeNames"] = {};
  for (const campaign of await deps.stores.adverts.campaigns()) {
    if (campaign.place === null || statusAt(campaign, at) !== "live" || campaign.place.place in names) continue;
    names[campaign.place.place] = { name: campaign.place.name, sign: campaign.place.sign };
  }
  return names;
}
