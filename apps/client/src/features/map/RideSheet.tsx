// The ride sheet (docs/rules/world.md R-WORLD-017): picking a stop raises a card at the foot of the
// map with the place's name and a line about it, the ways to go with a fare and minutes each, and one
// main button that says what is left after. The map stays in view above it.
import { X } from "lucide-react";
import { useState } from "react";

import { Tile } from "../../shared/tiles/Tile";
import { PressButton } from "../../shared/ui/lively/PressButton";
import { blurbOf, say, words } from "../../shared/words/text";
import { Balance, CENTRED, pricedLabel } from "../../shared/world/Balance";
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

/** The ways' pictures, stand-ins until the danfo, the keke, the okada and a walker have tiles of their own. */
const WAY_PICTURE = { danfo: "🚐", keke: "🛺", okada: "🏍️", walk: "🚶" } as const;

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

/**
 * The way the sheet opens on: the vehicle tapped in the place, else the first way open whose fare the money held pays,
 * so a stop in walking distance with no fare in hand opens on Walk; else the first way.
 */
export function firstWay(ways: readonly RideChoice[], have: number, by?: RideChoice["id"]): RideChoice["id"] {
  if (by !== undefined && ways.some((way) => way.id === by)) return by;
  return ways.find((way) => way.shut === undefined && way.fare <= have)?.id ?? ways[0]?.id ?? "danfo";
}

export function RideSheet({ pin, home, ways, have, formatMoney, onChoose, onClose, onStay, by }: RideSheetProps) {
  const [chosen, setChosen] = useState<RideChoice["id"]>(() => firstWay(ways, have, by));
  const way = ways.find((candidate) => candidate.id === chosen && candidate.shut === undefined) ?? ways.find((candidate) => candidate.shut === undefined);
  const here = pin.state === "here";
  const locked = pin.state === "not";
  const left = way === undefined ? have : have - way.fare;
  const short = left < 0;

  const main = (() => {
    if (here) return { label: mapWords("map.stay"), after: null, disabled: false };
    if (locked || way === undefined) return { label: mapWords("map.not-yet"), after: null, disabled: true };
    const label = way.id === "walk" ? mapWords(home ? "map.walk-home" : "map.walk") : mapWords(home ? "map.go-home" : "map.go", { way: way.label.toLowerCase() });
    if (way.fare === 0) return { label, after: null, disabled: false };
    // R-WORLD-006: the button says the ride and its fare; short, it says how much instead, the one exception.
    const priced = pricedLabel(label, formatMoney(way.fare));
    if (short) return { label: priced, after: mapWords("map.short", { amount: formatMoney(-left) }), disabled: true };
    return { label: priced, after: null, disabled: false };
  })();
  // The balance before the fare, struck, and after it, under the button; nothing moves until the tap.
  const balance = here || locked || way === undefined || way.fare === 0 || short ? null : { before: have, after: left };

  return (
    // The lively ride sheet: the place's picture and name with its state as a
    // chip and a line, the four ways as picture tiles with the fare under each, the balance before struck and after, and
    // one Go. A component of its own, so the map that holds it can be any map (folding map mounts it).
    <div role="dialog" aria-label={headingOf(pin.name)} className="pointer-events-auto absolute inset-x-0 bottom-0 z-[3]" data-ride-sheet={pin.id}>
      <div className="rise mx-auto w-full max-w-[430px] overflow-hidden rounded-t-[26px] bg-sheet px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))] text-text shadow-[0_-10px_30px_rgba(0,0,0,0.22)]">
        <div className="relative">
          <span aria-hidden className="mx-auto mb-2 block h-[5px] w-10 rounded-[3px] bg-text/25" />
          <button type="button" onClick={onClose} aria-label={mapWords("map.not-now")} className="press absolute top-0 right-0 flex size-9 items-center justify-center rounded-[12px] text-text-2">
            <X size={18} />
          </button>
        </div>
        <div className="flex items-center gap-3 pr-8">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-[16px] bg-tint-plain">
            <span className="sticker-cut wobble-in" style={{ rotate: "-6deg" }}>
              <Tile of={pin.id} size={46} />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-title leading-tight font-bold">{headingOf(pin.name)}</h2>
              <span className={`sticker-chip ${pin.state === "not" ? "bg-sheet-2" : "bg-tint-money"}`} style={{ rotate: "-2deg", ...(pin.state === "not" ? {} : { color: "var(--money-ink)" }) }} data-ride-tag>
                {tagOf(pin, home)}
              </span>
            </div>
            <p className="mt-0.5 text-[15px] leading-snug text-text-2" data-ride-line>
              {lineOf(pin)}
            </p>
          </div>
        </div>
        {here || locked ? null : (
          <div role="radiogroup" aria-label={mapWords("map.ways")} className="mt-3 grid grid-cols-4 gap-2">
            {ways.map((choice, index) => {
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
                  className={`ride-way press flex flex-col items-center gap-0.5 rounded-[18px] px-1 pt-2 pb-2 text-center ${on ? "ride-way-on" : ""} ${shut ? "opacity-50" : ""}`}
                >
                  <span className="sticker-cut text-[30px] leading-none" style={{ rotate: `${String(index % 2 === 0 ? -5 : 4)}deg` }} aria-hidden>
                    {WAY_PICTURE[choice.id]}
                  </span>
                  <span className="mt-1 text-[15px] leading-tight font-bold">{choice.label}</span>
                  <span className="num text-[17px] leading-tight">{choice.fare === 0 ? say(choice.id === "walk" ? "ui.world.free" : "ui.world.pass") : formatMoney(choice.fare)}</span>
                  <span className="text-[12px] leading-tight text-text-2">{shut ? mapWords("map.way.walk-far") : mapWords("map.way.minutes", { minutes: choice.minutes })}</span>
                </button>
              );
            })}
          </div>
        )}
        {balance === null ? null : <Balance className="mt-3 justify-center" before={{ amount: balance.before, words: formatMoney(balance.before) }} after={{ amount: balance.after, words: formatMoney(balance.after) }} />}
        <PressButton className="mt-3 w-full" style={main.after === null ? CENTRED : undefined} disabled={main.disabled} onClick={() => (here ? (onStay ?? onClose)() : way === undefined ? undefined : onChoose(way))} data-ride-main>
          <span>{main.label}</span>
          {main.after === null ? null : <span className="text-[13px] font-semibold opacity-80">{main.after}</span>}
        </PressButton>
      </div>
    </div>
  );
}
