// The map and the ride (docs/rules/world.md R-WORLD-015 to 017), composed. The city hands the pins,
// the country and its neighbours, whether WebGL draws, a ride already chosen in a place, and what to
// do on arriving and on closing; `onRide` carries the fare of the way chosen.
import { X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useView } from "../../authority/GameProvider";
import { formatMoney } from "../../shared/words/format";
import type { CountryChoice, RideChoice } from "../../shared/world/contract";
import { CityMap } from "./CityMap";
import { Countries } from "./Countries";
import { mapWords } from "./map.words";
import { type MapPin, rideChoices } from "./pins";
import { Ride } from "./Ride";
import { headingOf, RideSheet } from "./RideSheet";

export interface MapProps {
  pins: readonly MapPin[];
  country: CountryChoice;
  countries: readonly CountryChoice[];
  drawing: boolean;
  /** A ride already chosen in a place: the map opens straight into the ride to this place. */
  diveTo?: string | null;
  /** The way of a ride already chosen; a danfo when the place does not say. */
  diveBy?: RideChoice["id"];
  /** The ride is over: the place opens. */
  onGo: (id: string) => void;
  onClose: () => void;
  /** A way was chosen: the city sends `place/ride` for its fare, and answers whether it was accepted; the ride plays only then (R-PLACE-010). */
  onRide?: (choice: RideChoice, to: string) => Promise<boolean> | boolean | void;
  /** Opens another country the player may switch to. */
  onCountry?: (id: string) => void;
  /** The home of the country shown, when it is also where the player stands. */
  home?: string | null;
  /** The way to choose first on the ride sheet: the vehicle tapped in the place (R-WORLD-017). */
  by?: RideChoice["id"];
}

/** The pins as a key, so a new array with the same pins does not rebuild the city. */
function keyOf(pins: readonly MapPin[]): string {
  return pins.map((pin) => `${pin.id}:${pin.state}:${String(pin.position.latE3)}:${String(pin.position.lonE3)}:${pin.name}`).join("|");
}

export function Map({ pins, country, countries, drawing, diveTo = null, diveBy = "danfo", onGo, onClose, onRide, onCountry, home = null, by }: MapProps) {
  const view = useView();
  const have = view.pockets.NGN.cash;
  const key = keyOf(pins);
  // The pins handed in are rebuilt on every render of the city; only a change in them matters.
  const stable = useMemo(() => pins, [key]);
  const homeId = home ?? stable.find((pin) => pin.state === "home")?.id ?? null;
  const [picked, setPicked] = useState<string | null>(null);
  const [riding, setRiding] = useState<{ id: string; way: RideChoice["id"] } | null>(null);

  const here = stable.find((pin) => pin.state === "here") ?? null;
  const pin = stable.find((candidate) => candidate.id === picked) ?? null;
  const abroad = country.id === "lagos" ? null : country.id;
  const ways = useMemo(() => (pin === null || here === null ? [] : rideChoices(here.position, pin.position, abroad)), [pin, here, abroad]);

  // A ride chosen in the place plays at once, the same ride as from the map.
  useEffect(() => {
    if (diveTo === null) return;
    const to = stable.find((candidate) => candidate.id === diveTo);
    if (to === undefined) return;
    const choice = here === null ? undefined : rideChoices(here.position, to.position, abroad).find((way) => way.id === diveBy);
    setPicked(null);
    start(choice, to.id, diveBy);
    // The ride starts once for the place chosen.
  }, [diveTo]);

  /** The fare first: a ride the city refuses does not play, and the sheet closes. A city with nothing to say rides at once. */
  const start = (choice: RideChoice | undefined, to: string, way: RideChoice["id"]): void => {
    const answer = choice === undefined || onRide === undefined ? true : onRide(choice, to);
    if (answer instanceof Promise) {
      void answer.then((accepted) => {
        if (accepted) setRiding({ id: to, way });
      });
    } else if (answer !== false) {
      setRiding({ id: to, way });
    }
  };

  const go = (choice: RideChoice): void => {
    if (pin === null) return;
    const to = pin.id;
    setPicked(null);
    start(choice, to, choice.id);
  };

  const ridingTo = riding === null ? null : (stable.find((candidate) => candidate.id === riding.id) ?? null);

  return (
    <div className="fixed inset-0 z-[40] bg-[var(--land)] text-text" data-map data-picked={picked ?? ""}>
      {drawing ? <CityMap pins={stable} home={homeId} picked={picked} onPick={setPicked} /> : null}

      {/* The stops as a list: the whole map where nothing draws, and for a screen reader where it does. */}
      <ul aria-label={mapWords("map.stops")} className={drawing ? "sr-only" : "absolute inset-x-3 top-20 flex flex-col gap-1.5"}>
        {stable.map((stop) => (
          <li key={stop.id}>
            <button type="button" onClick={() => setPicked(stop.id)} data-stop={stop.id} data-state={stop.state} data-home={stop.id === homeId} className="chip press flex w-full items-center gap-2 px-3 py-2.5 text-left text-[14px] font-semibold">
              <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${dotClass(stop.state, stop.id === homeId)}`} />
              <span className="min-w-0 flex-1 truncate">{stop.id === homeId ? mapWords("map.state.home") : headingOf(stop.name)}</span>
              <span className="text-[12px] font-medium text-text-2">{mapWords(`map.state.${stop.state}`)}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(10px,env(safe-area-inset-top))]">
        <Countries country={country} countries={countries} {...(onCountry === undefined ? {} : { onCountry })} />
        <button type="button" onClick={onClose} aria-label={mapWords("map.close")} className="chip press pointer-events-auto inline-flex size-10 items-center justify-center shadow-lg" data-map-close>
          <X size={18} />
        </button>
      </div>

      {pin === null ? (
        <p className="chip pointer-events-none absolute bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 px-3 py-2 text-[13px] font-bold whitespace-nowrap" data-map-hint>
          {mapWords("map.hint")}
        </p>
      ) : (
        <RideSheet key={pin.id} pin={pin} home={pin.id === homeId} ways={ways} have={have} formatMoney={(amount) => formatMoney(amount, "NGN")} onChoose={go} onClose={() => setPicked(null)} {...(by === undefined ? {} : { by })} />
      )}

      {riding === null ? null : (
        <Ride
          way={riding.way}
          place={ridingTo === null ? "" : headingOf(ridingTo.name)}
          drawing={drawing}
          onDone={() => {
            const id = riding.id;
            setRiding(null);
            onGo(id);
          }}
        />
      )}
    </div>
  );
}

function dotClass(state: MapPin["state"], home: boolean): string {
  if (home) return "bg-strong";
  switch (state) {
    case "here":
    case "been":
      return "bg-signal";
    case "can":
      return "bg-in";
    case "not":
    case "home":
      return "bg-sheet-muted";
    default: {
      const never: never = state;
      throw new Error(`Unknown pin state: ${String(never)}`);
    }
  }
}
