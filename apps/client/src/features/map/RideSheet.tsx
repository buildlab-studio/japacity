// The ride sheet (docs/rules/world.md R-WORLD-017): picking a stop raises a card at the foot of the
// map with the place's name and a line about it, the ways to go with a fare and minutes each, and one
// main button that says what is left after. The map stays in view above it.
import { Bike, Bus, CarTaxiFront, Footprints, X } from "lucide-react";
import { useState } from "react";

import { blurbOf, say, words } from "../../shared/words/text";
import type { RideChoice } from "../../shared/world/contract";
import { mapWords } from "./map.words";
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
}

const WAY_ICON = { danfo: Bus, keke: CarTaxiFront, okada: Bike, walk: Footprints } as const;

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

function tagOf(pin: MapPin, home: boolean): string {
  if (pin.state === "here") return mapWords("map.state.here");
  if (home) return mapWords("map.state.home");
  return mapWords(`map.state.${pin.state}`);
}

/** A name as a heading: content keeps some names lower-case for the middle of a sentence. */
export function headingOf(name: string): string {
  return name.length === 0 ? name : name.charAt(0).toUpperCase() + name.slice(1);
}

export function RideSheet({ pin, home, ways, have, formatMoney, onChoose, onClose, onStay, by }: RideSheetProps) {
  const [chosen, setChosen] = useState<RideChoice["id"]>(by !== undefined && ways.some((way) => way.id === by) ? by : (ways[0]?.id ?? "danfo"));
  const way = ways.find((candidate) => candidate.id === chosen && candidate.shut === undefined) ?? ways.find((candidate) => candidate.shut === undefined);
  const here = pin.state === "here";
  const locked = pin.state === "not";
  const left = way === undefined ? have : have - way.fare;
  const short = left < 0;

  const main = (() => {
    if (here) return { label: mapWords("map.stay"), after: null, disabled: false };
    if (locked || way === undefined) return { label: mapWords("map.not-yet"), after: null, disabled: true };
    const label = way.id === "walk" ? mapWords(home ? "map.walk-home" : "map.walk") : mapWords(home ? "map.go-home" : "map.go", { way: way.label.toLowerCase() });
    if (short) return { label, after: mapWords("map.short", { amount: formatMoney(-left) }), disabled: true };
    if (way.fare === 0) return { label, after: null, disabled: false };
    return { label, after: say("ui.world.left", { amount: formatMoney(left) }), disabled: false };
  })();

  return (
    <div role="dialog" aria-label={headingOf(pin.name)} className="pointer-events-auto absolute inset-x-0 bottom-0 z-[3]" data-ride-sheet={pin.id}>
      <div className="panel rise mx-2 mb-2 overflow-hidden">
        <div className="band relative flex items-end gap-3 px-4 pt-3.5 pb-3">
          <div className="min-w-0 flex-1">
            <div className="label label-strong truncate" data-ride-tag>
              {tagOf(pin, home)}
            </div>
            <h2 className="title text-[23px] leading-tight">{headingOf(pin.name)}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={mapWords("map.not-now")} className="absolute top-2 right-2 flex size-9 items-center justify-center rounded-[5px] text-on-strong/80">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
          <p className="text-[14px] leading-snug text-text-2" data-ride-line>
            {lineOf(pin)}
          </p>
          {here || locked ? null : (
            <div role="radiogroup" aria-label={mapWords("map.ways")} className="mt-3 grid grid-cols-4 gap-1.5">
              {ways.map((choice) => {
                const Icon = WAY_ICON[choice.id];
                const on = choice.id === chosen;
                const shut = choice.shut !== undefined;
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
                    className={`press flex flex-col items-start gap-0.5 rounded-[6px] border-2 px-2.5 py-2 text-left ${on ? "border-signal bg-sheet-2" : "border-sheet-line bg-sheet"} ${shut ? "opacity-50" : ""}`}
                  >
                    <span className="flex items-center gap-1.5 text-[13px] font-bold">
                      <Icon size={15} aria-hidden />
                      {choice.label}
                    </span>
                    <span className="num text-[17px]">{choice.fare === 0 ? say(choice.id === "walk" ? "ui.world.free" : "ui.world.pass") : formatMoney(choice.fare)}</span>
                    <span className="text-[12px] text-text-2">{shut ? mapWords("map.way.walk-far") : mapWords("map.way.minutes", { minutes: choice.minutes })}</span>
                  </button>
                );
              })}
            </div>
          )}
          <button type="button" className="btn-main mt-3" disabled={main.disabled} onClick={() => (here ? (onStay ?? onClose)() : way === undefined ? undefined : onChoose(way))} data-ride-main>
            <span>{main.label}</span>
            {main.after === null ? null : <span className="text-[13px] font-semibold opacity-80">{main.after}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
