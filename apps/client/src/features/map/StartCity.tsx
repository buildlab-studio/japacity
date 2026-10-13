// The live city behind the start screen and the ways in (account.md R-ACCOUNT-029): the painted map
// of Lagos (paper/), open over the family house in Surulere, its built places standing as their stickers. A picture:
// nothing in it is picked, and the compound with the figure comes back at the door. Loaded apart from the first
// screen's code, as the compound is.
import { content } from "@japacity/content";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./paper/paper.css";

import { assetUrl, loadManifest } from "../../shared/three/manifest";
import { nameOf } from "../../shared/words/text";
import { toPaper } from "./paper/fit";
import { placeStops } from "./paper/stops";
import { useTiles } from "./paper/useTiles";
import { World } from "./paper/World";
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

/** The map's zoom behind the start screen: the family house's streets, the lagoon and the bridge in one look. */
const ZOOM = 1.2;

/** The painted map, still, centred a little north east of the family house so the lagoon and its bridge show. */
function StillMap({ pins }: { pins: readonly MapPin[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 390, height: 844 });
  const tiles = useTiles();
  useLayoutEffect(() => {
    const rect = box.current?.getBoundingClientRect();
    if (rect !== undefined && rect.width > 0) setSize({ width: rect.width, height: rect.height });
  }, []);
  const stops = placeStops(pins.map((pin) => ({ id: pin.id, state: pin.state, position: pin.position })));
  const [cx, cy] = toPaper({ latE3: FAMILY_SPOT.latE3 - 6, lonE3: FAMILY_SPOT.lonE3 + 18 });
  return (
    <div ref={box} className="paper absolute inset-0 overflow-hidden" style={{ background: "var(--sea)" }} aria-hidden>
      <World variant="open" uid="start" frame={{ x: size.width / 2 - ZOOM * cx, y: size.height / 2 - ZOOM * cy, sx: ZOOM, sy: ZOOM }} stops={stops} names={nameOf} marks={{ home: FAMILY_HOUSE, picked: null, step: null }} tiles={tiles} pinPx={34} />
    </div>
  );
}

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
  // The sea's tone under the paper, so the city fills the frame to every edge while the published pictures load.
  return (
    <div className="paper relative size-full" style={{ background: "var(--sea)" }} data-start-city>
      {pins === null ? null : <StillMap pins={pins} />}
    </div>
  );
}
