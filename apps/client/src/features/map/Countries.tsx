// One country at a time (docs/rules/world.md R-WORLD-016): the country shown is the button; the
// others are listed locked with the reason. A locked one shakes and stays shut.
import { Check, ChevronDown, Lock } from "lucide-react";
import { useRef, useState } from "react";

import { words } from "../../shared/words/text";
import type { CountryChoice } from "../../shared/world/contract";
import { mapWords } from "./map.words";

export interface CountriesProps {
  country: CountryChoice;
  countries: readonly CountryChoice[];
  /** Opens another country the player may switch to. Never called for a locked one. */
  onCountry?: (id: string) => void;
}

/** A reason is a words key in the contract; the city may hand words already, which show as they are. */
function reasonWords(reason: string): string {
  return words(reason);
}

function shake(element: HTMLElement | null): void {
  if (element === null || typeof element.animate !== "function") return;
  const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;
  element.animate([{ transform: "translateX(0)" }, { transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "translateX(-4px)" }, { transform: "translateX(0)" }], { duration: 320, easing: "ease-out" });
}

export function Countries({ country, countries, onCountry }: CountriesProps) {
  const [open, setOpen] = useState(false);
  const [shaken, setShaken] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLButtonElement>());

  const choose = (choice: CountryChoice): void => {
    if (choice.locked !== null) {
      setShaken(choice.id);
      shake(rows.current.get(choice.id) ?? null);
      return;
    }
    setOpen(false);
    if (choice.id !== country.id) onCountry?.(choice.id);
  };

  return (
    <div className="pointer-events-auto relative" data-country-menu>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((was) => !was)} className="btn-dark press inline-flex h-10 items-center gap-1.5 px-3 text-[14px] shadow-lg" data-country={country.id}>
        {country.name}
        <ChevronDown size={15} />
      </button>
      {open ? (
        <ul role="listbox" aria-label={mapWords("map.country")} className="panel drop absolute top-full left-0 mt-1.5 flex min-w-64 flex-col gap-0.5 p-1.5">
          {countries.map((choice) => {
            const shown = choice.id === country.id;
            const locked = choice.locked !== null;
            return (
              <li key={choice.id} role="option" aria-selected={shown} aria-disabled={locked}>
                <button
                  type="button"
                  ref={(element) => {
                    if (element === null) rows.current.delete(choice.id);
                    else rows.current.set(choice.id, element);
                  }}
                  onClick={() => choose(choice)}
                  data-country-option={choice.id}
                  data-locked={locked}
                  data-shake={shaken === choice.id}
                  className={`flex w-full items-center gap-2 rounded-[4px] px-3 py-2 text-left text-[14px] font-semibold ${shown ? "bg-sheet-muted" : ""} ${locked ? "text-text-2" : "text-text"}`}
                >
                  {locked ? <Lock size={13} aria-hidden /> : shown ? <Check size={13} aria-hidden /> : null}
                  <span className="whitespace-nowrap">{choice.name}</span>
                  <span className="ml-auto text-[12px] font-medium whitespace-nowrap text-text-2">{shown ? mapWords("map.state.here") : choice.locked === null ? "" : reasonWords(choice.locked)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
