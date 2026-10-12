// The live city behind the start screen and the ways in (account.md R-ACCOUNT-029), as the design
// lab has it: the map of Lagos seen from above, settled over the family house in Surulere, its built places standing
// with their boards. A picture: nothing in it is picked, and the compound with the figure comes back at the door. Loaded
// apart from the first screen's code, as the compound is.
import { content } from "@japacity/content";
import { useEffect, useState } from "react";

import { assetUrl, loadManifest } from "../../shared/three/manifest";
import { nameOf } from "../../shared/words/text";
import { CityMap } from "./CityMap";
import { type MapPin, RENTED_HOMES } from "./pins";

/** The family house, as the city places it when content gives it no position (features/city/City.tsx, FAMILY_SPOT). */
const FAMILY_HOUSE = "place.family-house";
const FAMILY_SPOT = { latE3: 6511, lonE3: 3353 };

const LAGOS = Object.values(content.place).filter((place) => place.where === "home" && place.position !== null);

/** The pins: the family house as home, and every built place of Lagos with a position. */
export function startPins(built: ReadonlySet<string> | null): MapPin[] {
  const family: MapPin = { id: FAMILY_HOUSE, name: nameOf(FAMILY_HOUSE), state: "here", position: FAMILY_SPOT, things: 0 };
  // A rented room is on the map only while lived in (R-HOME-010), never before the life begins.
  const rest = LAGOS.filter((place) => place.id !== FAMILY_HOUSE && !RENTED_HOMES.has(place.id) && (built === null || built.has(place.id))).map(
    (place): MapPin => ({ id: place.id, name: nameOf(place.id), state: "can", position: place.position ?? FAMILY_SPOT, things: place.stages.length }),
  );
  return [family, ...rest];
}

const nothing = (): void => undefined;

export default function StartCity() {
  const [pins, setPins] = useState<MapPin[] | null>(null);
  useEffect(() => {
    let alive = true;
    void loadManifest()
      .then((manifest) => {
        if (alive) setPins(startPins(new Set(LAGOS.filter((place) => assetUrl(manifest, `places/${place.assets}/place.json`) !== null).map((place) => place.id))));
      })
      .catch(() => {
        if (alive) setPins(startPins(null));
      });
    return () => {
      alive = false;
    };
  }, []);
  // The map's own ground tone behind its canvas, as the map screen has it, so the city fills the frame to every edge and
  // nothing of the scene's background shows beside or under the panel: one still colour, no cost a frame.
  return (
    <div className="size-full bg-[var(--land)]" data-start-city>
      {pins === null ? null : <CityMap pins={pins} home={FAMILY_HOUSE} picked={null} onPick={nothing} />}
    </div>
  );
}
