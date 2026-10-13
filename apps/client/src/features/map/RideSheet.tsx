// The ride sheet (docs/rules/world.md R-WORLD-017), dressed as the after set's map-stop-picked-ride-sheet: picking a
// stop raises a sheet at the foot of the map with the place's own picture, its name and state, a line about it, the
// ways to go as picture tiles with the fare and minutes under each, the balance before struck through and after, and
// one yellow Go that says the ride and its fare. The map stays in view above it.
import { Footprints } from "lucide-react";
import { useEffect, useState } from "react";

import { PressButton } from "../../shared/ui/lively/PressButton";
import { blurbOf, say, words } from "../../shared/words/text";
import { Balance, pricedLabel } from "../../shared/world/Balance";
import type { RideChoice } from "../../shared/world/contract";
import { mapWords } from "./map.words";
import { useTiles } from "./paper/useTiles";
import { PlacePicture } from "./paper/PlacePicture";
import type { MapPin } from "./pins";

export interface RideSheetProps {
  pin: MapPin;
  /** Whether the stop is the home of the country shown. */
  home: boolean;
  ways: readonly RideChoice[];
  /** The money in the wallet now, in kobo. */
  have: number;
  formatMoney: (amount: number) => string;
  onChoose: (way: RideChoice) => void;
  onClose: () => void;
  /** "Stay here" on the stop the character stands at: closes the map as well, back to the place. */
  onStay?: () => void;
  /** The way chosen first, when a vehicle in the place was tapped (R-WORLD-017). */
  by?: RideChoice["id"];
  /** Hears the way picked, from the first, so the route on the map carries its sticker. */
  onWay?: (way: RideChoice["id"]) => void;
}

/** Each way's picture: the vehicle's own tile; on foot, the footprints. */
export const WAY_MODEL: Readonly<Record<RideChoice["id"], string | null>> = { danfo: "veh_danfo", keke: "veh_keke", okada: "veh_okada", walk: null, drive: "veh_car" };

/** The first sentence of a place's blurb: a line about it. */
function firstSentence(blurb: string): string {
  const end = blurb.search(/[.?]\s/);
  return end < 0 ? blurb : blurb.slice(0, end + 1);
}

/** A line about the place: the pin's own words, else the first sentence of its blurb, else what there is to do. */
export function lineOf(pin: MapPin): string {
  if (pin.state === "not") return mapWords("map.line.not");
  if (pin.line !== undefined) return words(pin.line);
  const blurb = blurbOf(pin.id);
  if (blurb !== null && blurb.trim() !== "") return firstSentence(blurb);
  return mapWords(pin.state === "here" ? "map.line.here" : "map.line.things", { things: pin.things });
}

/** The state chip's colour: green to go, the sheet's own for a place been to or where you stand, yellow for not yet. */
function toneOf(pin: MapPin, home: boolean): string {
  if (pin.state === "not") return "ride-state-soft";
  if (pin.state === "here" || home) return "ride-state-plain";
  return pin.state === "can" ? "ride-state-good" : "ride-state-plain";
}

function tagOf(pin: MapPin, home: boolean): string {
  if (pin.state === "here") return mapWords("map.state.here");
  if (home) return mapWords("map.state.home");
  return mapWords(`map.state.${pin.state}`);
}

/** A name as a heading: content keeps some names lower-case for the middle of a sentence. */
export function headingOf(name: string): string {
  return name.length === 0 ? name : name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * The way the sheet opens on: the vehicle tapped in the place, else the first way open whose fare the money held pays,
 * so a stop in walking distance with no fare in hand opens on Walk; else the first way.
 */
export function firstWay(ways: readonly RideChoice[], have: number, by?: RideChoice["id"]): RideChoice["id"] {
  if (by !== undefined && ways.some((way) => way.id === by)) return by;
  return ways.find((way) => way.shut === undefined && way.fare <= have)?.id ?? ways[0]?.id ?? "danfo";
}

export function RideSheet({ pin, home, ways, have, formatMoney, onChoose, onClose, onStay, by, onWay }: RideSheetProps) {
  const [chosen, setChosen] = useState<RideChoice["id"]>(() => firstWay(ways, have, by));
  useEffect(() => onWay?.(chosen), [chosen, onWay]);
  const way = ways.find((candidate) => candidate.id === chosen && candidate.shut === undefined) ?? ways.find((candidate) => candidate.shut === undefined);
  const here = pin.state === "here";
  const locked = pin.state === "not";
  const left = way === undefined ? have : have - way.fare;
  const short = left < 0;

  const main = (() => {
    if (here) return { label: mapWords("map.stay"), after: null, disabled: false };
    if (locked || way === undefined) return { label: mapWords("map.not-yet"), after: null, disabled: true };
    const label =
      way.id === "walk" ? mapWords(home ? "map.walk-home" : "map.walk") : way.id === "drive" ? mapWords(home ? "map.drive-home" : "map.drive") : mapWords(home ? "map.go-home" : "map.go", { way: way.label.toLowerCase() });
    if (way.fare === 0) return { label, after: null, disabled: false };
    // R-WORLD-006: the button says the ride and its fare; short, it says how much instead, the one exception.
    const priced = pricedLabel(label, formatMoney(way.fare));
    if (short) return { label: priced, after: mapWords("map.short", { amount: formatMoney(-left) }), disabled: true };
    return { label: priced, after: null, disabled: false };
  })();
  // The balance before the fare, struck, and after it, under the button; nothing moves until the tap.
  const balance = here || locked || way === undefined || way.fare === 0 || short ? null : { before: have, after: left };

  const tiles = useTiles();

  return (
    <div role="dialog" aria-label={headingOf(pin.name)} className="pointer-events-auto absolute inset-x-0 bottom-0 z-[3]" data-ride-sheet={pin.id}>
      <div className="rise mx-auto max-w-[430px] rounded-t-[26px] border-t-[length:var(--edge-width)] border-edge bg-sheet px-4 pt-1 pb-[max(20px,env(safe-area-inset-bottom))] text-text shadow-[0_-10px_30px_rgba(0,0,0,0.18)]">
        <button type="button" onClick={onClose} aria-label={mapWords("map.not-now")} className="mx-auto flex h-7 w-20 items-center justify-center rounded-[10px] outline-none focus-visible:ring-2 focus-visible:ring-text/40" data-ride-close>
          <span className="h-[5px] w-10 rounded-[3px] bg-text/25" />
        </button>
        <div className="mb-3 flex items-center gap-3">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-[16px] bg-sheet-muted" style={{ rotate: "-5deg" }} aria-hidden>
            <PlacePicture id={pin.id} size={56} tiles={tiles} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h2 className="text-[22px] leading-tight font-semibold">{headingOf(pin.name)}</h2>
              <span className={`ride-state ${toneOf(pin, home)}`} data-ride-tag>
                {tagOf(pin, home)}
              </span>
            </div>
            <p className="mt-0.5 text-[14px] leading-snug text-text-2" data-ride-line>
              {lineOf(pin)}
            </p>
          </div>
        </div>
        {here || locked ? null : (
          <div role="radiogroup" aria-label={mapWords("map.ways")} className={`mb-3.5 grid gap-2 ${ways.length > 4 ? "grid-cols-5" : "grid-cols-4"}`}>
            {ways.map((choice) => {
              const on = choice.id === chosen;
              const shut = choice.shut !== undefined;
              const model = WAY_MODEL[choice.id];
              const url = model === null ? null : tiles(model);
              return (
                <button
                  key={choice.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={shut}
                  onClick={() => setChosen(choice.id)}
                  data-way={choice.id}
                  data-shut={choice.shut}
                  className={`ride-way press flex flex-col items-center gap-0.5 rounded-[16px] px-1 pt-2 pb-2 text-center ${on ? "ride-way-on" : ""} ${shut ? "opacity-50" : ""}`}
                >
                  <span className="flex h-[46px] items-center" aria-hidden>
                    {model === null ? (
                      <span className="sticker-cut text-text" style={{ rotate: on ? "-6deg" : "-3deg" }}>
                        <Footprints size={34} strokeWidth={2.2} />
                      </span>
                    ) : (
                      <span className="sticker-cut" style={{ rotate: on ? "-6deg" : "-3deg" }}>
                        {url === null ? <span className="block size-11" /> : <img src={url} alt="" width={44} height={44} draggable={false} className="block object-contain" />}
                      </span>
                    )}
                  </span>
                  <span className="text-[13px] font-semibold">{choice.label}</span>
                  <span className="text-[14px] font-semibold">{choice.fare === 0 ? say(choice.id === "walk" ? "ui.world.free" : "ui.world.pass") : formatMoney(choice.fare)}</span>
                  <span className="text-[11px] leading-tight text-text-2">{shut ? mapWords("map.way.walk-far") : mapWords("map.way.minutes", { minutes: choice.minutes })}</span>
                </button>
              );
            })}
          </div>
        )}
        {balance === null ? null : <Balance className="mb-2.5 justify-center text-[13px]" before={{ amount: balance.before, words: formatMoney(balance.before) }} after={{ amount: balance.after, words: formatMoney(balance.after) }} />}
        <PressButton className="w-full flex-col gap-0" disabled={main.disabled} onClick={() => (here ? (onStay ?? onClose)() : way === undefined ? undefined : onChoose(way))} data-ride-main>
          <span>{main.label}</span>
          {main.after === null ? null : <span className="text-[13px] font-semibold opacity-80">{main.after}</span>}
        </PressButton>
      </div>
    </div>
  );
}
