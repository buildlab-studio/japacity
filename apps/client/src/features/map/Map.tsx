// The map and the ride (world:map-is-painted-lagos, world:one-country-at-a-time and world:ride-sheet-shows-fares), composed. The city hands the pins,
// the country and its neighbours, whether WebGL draws (for the ride's scene), a ride already chosen in a
// place, the step's place, and what to do on arriving and on closing; `onRide` carries the fare of the way
// chosen. Lagos, London, Calgary, Dubai and Castel Volturno are painted maps, folding between the strip and the cards
// (paper/PaperMap.tsx), the same on every device (world:painted-maps-abroad); the stops stay as a list for a screen reader.
import { X } from "lucide-react";
import "./map.css";

import { lazy, type ReactNode, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { useView } from "../../authority/GameProvider";
import { LEVEL, useBackHold, useBackLayer } from "../../shared/back/back";
import { Loader } from "../../shared/ui/Loader";
import { formatMoney } from "../../shared/words/format";
import type { CountryChoice, RideChoice } from "../../shared/world/contract";
import { Countries } from "./Countries";
import { mapWords } from "./map.words";
import { fareWords, type MapPin, rideChoices, waysAbroad, withHomeWalk } from "./pins";
import { ownLook, preloadRide, Ride } from "./Ride";
import { headingOf, RideSheet, WAY_MODEL } from "./RideSheet";
import { RouteVehicle } from "./paper/routeVehicle";
import { type AbroadVehicle, vehicleFor, wayModelFor } from "./rideVehicles";

/** The painted map, its own chunk: a first visit downloads none of it until the map is opened. */
const PaperMap = lazy(() => import("./paper/PaperMap").then((paper) => ({ default: paper.PaperMap })));
/**
 * The painted maps abroad (world:painted-maps-abroad): the same folding map handed London, Calgary, Dubai or Castel
 * Volturno, each drawing a chunk of its own, loaded only when the map shows that country.
 */
const PAINTED_ABROAD: Readonly<Record<string, typeof PaperMap>> = {
  "country.uk": lazy(() => import("./paper/london").then((london) => ({ default: london.LondonPaperMap }))),
  "country.canada": lazy(() => import("./paper/calgary").then((calgary) => ({ default: calgary.CalgaryPaperMap }))),
  "country.uae": lazy(() => import("./paper/dubai").then((dubai) => ({ default: dubai.DubaiPaperMap }))),
  "country.italy": lazy(() => import("./paper/castel").then((castel) => ({ default: castel.CastelPaperMap }))),
};

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
  /** A way was chosen: the city sends `place/ride` for its fare, and answers whether it was accepted; the ride plays only then (place:rides-between-city-places). */
  onRide?: (choice: RideChoice, to: string) => Promise<boolean> | boolean | void;
  /** Turn back on a ride: the character gets down at the next stop and walks back to `from`, the fare gone (world:ride-sheet-shows-fares). */
  onTurnBack?: (from: string, to: string) => void;
  /** Opens another country the player may switch to. */
  onCountry?: (id: string) => void;
  /** The home of the country shown, when it is also where the player stands. */
  home?: string | null;
  /** The way to choose first on the ride sheet: the vehicle tapped in the place (world:ride-sheet-shows-fares). */
  by?: RideChoice["id"];
  /** A stop to open picked, with its ride sheet up: the nudge's step elsewhere (world:nudge-says-one-thing). */
  pickFirst?: string | null;
  /** The place the live step points to: the map opens on its neighbourhood, its sticker ringed and named. */
  step?: string | null;
  /** The dedication page and its glow, handed in by the shell: the lantern canoe on the open map opens it (world:lantern-canoe-on-map). */
  dedication?: MapDedication | null;
}

/**
 * What the shell hands the map for the lantern canoe (world:lantern-canoe-on-map, account:dedication-page-and-its-doors): the dedication
 * page drawn open or closed with its way to close, and the glow's fill, the two lights' one glow, so this feature
 * imports neither.
 */
export interface MapDedication {
  page: (open: boolean, onClose: () => void) => ReactNode;
  glow: (alpha: number) => string;
}

/** The pins as a key, so a new array with the same pins does not rebuild the city. */
function keyOf(pins: readonly MapPin[]): string {
  return pins.map((pin) => `${pin.id}:${pin.state}:${String(pin.position.latE3)}:${String(pin.position.lonE3)}:${pin.name}`).join("|");
}

export function Map({ pins, country, countries, drawing, diveTo = null, diveBy = "danfo", onGo, onClose, onRide, onTurnBack, onCountry, home = null, by, pickFirst = null, step = null, dedication = null }: MapProps) {
  const view = useView();
  // The ways where the character is (place:rides-between-city-places): abroad, the country's from the view; with none listed, the single way
  // at no fare.
  const abroadWays = view.place.where === "abroad" ? (view.place.ways ?? []) : [];
  // The country the life is in and the stops its employer's shuttle serves, for the pills and the vehicles (place:employer-shuttle-rides-free).
  const placeCountry = view.place.where === "abroad" ? view.place.country : null;
  const shuttles: readonly string[] = view.place.shuttles ?? [];
  const currency = abroadWays[0]?.currency ?? "NGN";
  // All the money of the country's currency: the fare leaves cash first and the bank for the rest (place:rides-between-city-places).
  const pocket = view.pockets[currency];
  const have = pocket.cash + pocket.bank;
  const key = keyOf(pins);
  // The pins handed in are rebuilt on every render of the city; only a change in them matters.
  const stable = useMemo(() => pins, [key]);
  const homeId = home ?? stable.find((pin) => pin.state === "home")?.id ?? null;
  const [picked, setPicked] = useState<string | null>(pickFirst);
  const [riding, setRiding] = useState<{ id: string; way: RideChoice["id"]; long: boolean; fare?: string; vehicle: AbroadVehicle | null; label?: string } | null>(null);
  // The way picked on the ride sheet: its vehicle rides the route on the map, the danfo when none or on foot.
  const [wayShown, setWayShown] = useState<RideChoice["id"]>("danfo");
  const routeVehicle = wayModelFor(placeCountry, wayShown, false) ?? WAY_MODEL[wayShown] ?? "vehicle_danfo";

  const here = stable.find((pin) => pin.state === "here") ?? null;
  const pin = stable.find((candidate) => candidate.id === picked) ?? null;
  const abroad = country.id === "lagos" ? null : country.id;
  // To or from home a walk stays open however far while no fare is in hand (world:ride-sheet-shows-fares).
  // While the life's car stands at home the sheet offers Drive.
  const drive = view.things.drive;
  const choicesTo = (to: MapPin, at: MapPin): RideChoice[] =>
    withHomeWalk(
      abroadWays.length > 0
        ? waysAbroad(abroadWays, { from: at.id, to: to.id }, { from: at.position, to: to.position }, to.id === homeId || at.id === homeId, view.place.fareBp, { country: placeCountry, shuttles })
        : rideChoices(at.position, to.position, abroad, view.place.fareBp, to.id === homeId || at.id === homeId, { from: at.id, to: to.id }, drive),
      have,
    );
  const ways = useMemo(() => (pin === null || here === null ? [] : choicesTo(pin, here)), [pin, here, abroad, view.place.fareBp, homeId, drive, abroadWays, have]);

  // A ride chosen in the place plays at once, the same ride as from the map.
  useEffect(() => {
    if (diveTo === null) return;
    const to = stable.find((candidate) => candidate.id === diveTo);
    if (to === undefined) return;
    const choice = here === null ? undefined : choicesTo(to, here).find((way) => way.id === diveBy);
    setPicked(null);
    start(choice, to.id, diveBy);
    // The ride starts once for the place chosen.
  }, [diveTo]);

  /**
   * A fare as words: the country's pass or its shuttle by name ("£0, bus pass", "C$0, transit pass", "AED 0, site bus",
   * place:country-pass-covers-ways, place:employer-shuttle-rides-free), else the fare in the country's money.
   */
  const fareOf = (choice: RideChoice): string =>
    choice.pill ?? (choice.passed === true ? mapWords("map.way.passed", { amount: formatMoney(0, currency) }) : fareWords(choice.fare, currency));

  /** The fare first: a ride the city refuses does not play, and the sheet closes. A city with nothing to say rides at once. */
  const start = (choice: RideChoice | undefined, to: string, way: RideChoice["id"]): void => {
    const answer = choice === undefined || onRide === undefined ? true : onRide(choice, to);
    const long = choice?.long === true;
    // Abroad the ride carries its fare as a pill, in the country's money (world:ride-abroad-and-workplace); on foot nothing is paid.
    const fare = abroadWays.length === 0 || choice === undefined || choice.id === "walk" ? {} : { fare: fareOf(choice) };
    // The country's own vehicle (world:ride-abroad-and-workplace): the labour bus or the van on the shuttle's bus, else the way's.
    const shuttle = choice?.shuttle === true || (way === "bus" && here !== null && (shuttles.includes(here.id) || shuttles.includes(to)));
    const ridden = { vehicle: vehicleFor(placeCountry, way, shuttle), ...(choice === undefined || placeCountry === null ? {} : { label: choice.label }) };
    if (answer instanceof Promise) {
      void answer.then((accepted) => {
        if (accepted) setRiding({ id: to, way, long, ...fare, ...ridden });
      });
    } else if (answer !== false) {
      setRiding({ id: to, way, long, ...fare, ...ridden });
    }
  };

  const go = (choice: RideChoice): void => {
    if (pin === null) return;
    const to = pin.id;
    setPicked(null);
    start(choice, to, choice.id);
  };

  // The character as the city shows them (City.tsx), and a seed so the same ride says the same line.
  const own = ownLook();
  useEffect(() => {
    if (drawing) preloadRide(own);
  }, [drawing, own]);

  const ridingTo = riding === null ? null : (stable.find((candidate) => candidate.id === riding.id) ?? null);
  // world:back-closes-topmost: the map is a layer Back and Escape close, and the scene under it is inert (world:reach-and-read);
  // a ride under way is not closed by Back.
  useBackLayer(true, onClose, { level: LEVEL.map, cover: true });
  useBackHold(riding !== null);

  const lagos = country.id === "lagos";
  const abroadPaper = PAINTED_ABROAD[country.id];
  const painted = lagos || abroadPaper !== undefined;
  const Paper = lagos || abroadPaper === undefined ? PaperMap : abroadPaper;
  const closeButton = (
    <button type="button" onClick={onClose} aria-label={mapWords("map.close")} className="map-round press pointer-events-auto inline-flex size-[42px] items-center justify-center" data-map-close>
      <X size={20} strokeWidth={2.5} />
    </button>
  );
  // The menu's list opens away from the edge its pill stands on: upward from the folded map's foot, downward from the top
  // of the open map and of the list abroad, so every country stays on the screen (world:one-country-at-a-time).
  const countryMenu = (up: boolean) => <Countries country={country} countries={countries} up={up} {...(onCountry === undefined ? {} : { onCountry })} />;
  const named = useCallback((id: string): string => stable.find((candidate) => candidate.id === id)?.name ?? id, [stable]);
  // world:lantern-canoe-on-map: the canoe opens the dedication page over the map, and closing it leaves the map as it was.
  const [dedicated, setDedicated] = useState(false);
  const canoe = useMemo(() => (dedication === null ? null : { glow: dedication.glow, onOpen: () => setDedicated(true) }), [dedication?.glow]);

  return (
    <div className="fixed inset-0 z-[40] bg-sheet text-text" data-map data-picked={picked ?? ""}>
      {/* The stops as a list: for a screen reader, beside the painted map of every country (world:painted-maps-abroad). */}
      <ul aria-label={mapWords("map.stops")} className={painted ? "sr-only" : "absolute inset-x-3 top-20 flex flex-col gap-1.5"}>
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

      {/* While a ride plays the painted map is put away: the ride fills the screen, and nothing under it keeps drawing. */}
      {painted && riding === null ? (
        <Suspense fallback={<MapWaiting close={closeButton} />}>
          <RouteVehicle value={routeVehicle}>
            <Paper pins={stable} home={homeId} picked={picked} step={step} names={named} onPick={setPicked} country={countryMenu} close={closeButton} sheetUp={pin !== null} canoe={canoe} />
          </RouteVehicle>
        </Suspense>
      ) : painted ? null : (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(10px,env(safe-area-inset-top))]">
          {countryMenu(false)}
          {closeButton}
        </div>
      )}

      {pin === null ? (
        painted ? null : (
          <p className="chip pointer-events-none absolute bottom-[max(16px,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 px-3 py-2 text-[13px] font-bold whitespace-nowrap" data-map-hint>
            {mapWords("map.hint")}
          </p>
        )
      ) : (
        <RideSheet
          key={pin.id}
          pin={pin}
          home={pin.id === homeId}
          ways={ways}
          have={have}
          formatMoney={(amount) => formatMoney(amount, currency)}
          formatFare={(amount) => fareWords(amount, currency)}
          onChoose={go}
          onClose={() => setPicked(null)}
          onStay={onClose}
          onWay={setWayShown}
          wayModel={(choice) => wayModelFor(placeCountry, choice.id, choice.shuttle === true)}
          {...(by === undefined ? {} : { by })}
        />
      )}

      {riding === null ? null : (
        <Ride
          way={riding.way}
          vehicle={riding.vehicle}
          {...(riding.label === undefined ? {} : { wayName: riding.label })}
          long={riding.long}
          place={ridingTo === null ? "" : ridingTo.name}
          drawing={drawing}
          own={own}
          seed={seedOf(`${riding.id}:${String(view.month)}`)}
          {...(here === null ? {} : { from: here.name })}
          {...(riding.fare === undefined ? {} : { fare: riding.fare })}
          onDone={() => {
            const id = riding.id;
            setRiding(null);
            onGo(id);
          }}
          {...(onTurnBack === undefined || here === null
            ? {}
            : {
                onTurnBack: () => {
                  const id = riding.id;
                  setRiding(null);
                  onTurnBack(here.id, id);
                },
              })}
        />
      )}
      {dedication === null || !lagos ? null : dedication.page(dedicated, () => setDedicated(false))}
    </div>
  );
}

/** A small whole number from a string, the same every time. */
function seedOf(key: string): number {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) hash = (hash * 31 + key.charCodeAt(index)) % 1000003;
  return hash;
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

/**
 * The painted map's own chunk on its way: the bar alone, small, running beside the map's close where the close
 * stands, so the player can still leave; the one look every wait takes (shared/ui/Loader), never a spinner.
 */
export function MapWaiting({ close }: { close: ReactNode }) {
  return (
    <div className="absolute top-3 right-3 flex items-center gap-3" data-map-waiting>
      <Loader label={mapWords("map.loading")} small />
      {close}
    </div>
  );
}
