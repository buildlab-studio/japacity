// "Make it yours" under the look strip (prologue.md R-PROLOGUE-015): a skin tone, a hair colour and a top colour from
// small round swatches (a ring and a tick on the one chosen), and on a printed top its fabric, each starting as the look
// was made, with the way back to as made.
// The rows follow what the figure on the plinth read of its look, so a head under a cap shows no hair row and a plain
// top no fabric; where no figure is drawn there is nothing to see recoloured, and nothing shows.
import type { PaletteName } from "@japacity/assets";
import { Check } from "lucide-react";
import { useRef } from "react";

import { say } from "../words/text";
import { FABRICS, isMade, type LookStyle, type OwnColours, type Part, pickStyle, swatchCss, swatchesFor, useOwnColours } from "./style";
import { bringIntoView } from "./view";

/** A swatch light enough that its tick is drawn dark. */
const LIGHT = new Set<PaletteName>(["white", "cream", "gold", "skin8", "khaki", "tan", "sand"]);

function Swatches({ part, own, chosen, onPick }: { part: Part; own: PaletteName; chosen: PaletteName; onPick: (colour: PaletteName) => void }) {
  const name = say(`ui.door.yours.${part}`);
  return (
    <div className="flex flex-wrap gap-[7px]" role="radiogroup" aria-label={name} data-swatches={part}>
      {swatchesFor(part, own).map((colour, at) => {
        const on = colour === chosen;
        return (
          <button
            key={colour}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={say(colour === own ? "ui.door.yours.swatch.made" : "ui.door.yours.swatch", { part: name, n: at + 1 })}
            data-swatch={colour}
            onClick={() => onPick(colour)}
            className={`press flex size-8 items-center justify-center rounded-full border border-sheet-line ${on ? "ring-[3px] ring-strong ring-offset-2 ring-offset-sheet" : ""}`}
            style={{ background: swatchCss(colour) }}
          >
            {on ? <Check size={16} strokeWidth={3} aria-hidden color={swatchCss(LIGHT.has(colour) ? "black" : "white")} /> : null}
          </button>
        );
      })}
    </div>
  );
}

function Row({ part, own, style, onStyle }: { part: Part; own: OwnColours; style: LookStyle | undefined; onStyle: (style: LookStyle) => void }) {
  const made = own[part];
  if (made === null) return null;
  return (
    <div className="mt-3.5" data-yours-row={part}>
      <h3 className="label mb-1.5 text-text-2">{say(`ui.door.yours.${part}`)}</h3>
      <Swatches part={part} own={made} chosen={style?.[part] ?? made} onPick={(colour) => onStyle(pickStyle(style, own, part, colour))} />
    </div>
  );
}

/**
 * `heading`: the rows' own heading; the door's first screen heads them with its own disclosure button instead.
 * `follow`: each pick brings the next row shown into view, so the next part to choose is never out of sight (R-PROLOGUE-013).
 */
export function OwnColoursRows({ look, style, onStyle, heading = true, follow = false }: { look: string; style: LookStyle | undefined; onStyle: (style: LookStyle) => void; heading?: boolean; follow?: boolean }) {
  const own = useOwnColours(look);
  const rows = useRef<HTMLElement>(null);
  if (own === null) return null;
  const fabric = style?.fabric ?? own.fabric;
  const picked = (part: Part | "fabric", next: LookStyle): void => {
    onStyle(next);
    if (!follow) return;
    const shown = [...(rows.current?.querySelectorAll("[data-yours-row]") ?? [])];
    const at = shown.findIndex((row) => row.getAttribute("data-yours-row") === part);
    if (at >= 0) bringIntoView(shown[at + 1]);
  };
  return (
    <section ref={rows} className={heading ? "mt-3.5" : ""} aria-label={say("ui.door.yours")} data-yours>
      <div className="flex items-baseline justify-between gap-2">
        {heading ? <h2 className="text-[15px] font-extrabold">{say("ui.door.yours")}</h2> : <span />}
        {isMade(style) ? null : (
          <button type="button" className="press text-[12px] font-bold text-text-2 underline" onClick={() => onStyle({})} data-yours-made>
            {say("ui.door.yours.made")}
          </button>
        )}
      </div>
      <Row part="skin" own={own} style={style} onStyle={(next) => picked("skin", next)} />
      <Row part="hair" own={own} style={style} onStyle={(next) => picked("hair", next)} />
      <Row part="top" own={own} style={style} onStyle={(next) => picked("top", next)} />
      {own.fabric === null ? null : (
        <div className="mt-3.5" data-yours-row="fabric">
          <h3 className="label mb-1.5 text-text-2">{say("ui.door.yours.fabric")}</h3>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={say("ui.door.yours.fabric")} data-fabrics>
            {FABRICS.map((one) => {
              const on = one === fabric;
              return (
                <button
                  key={one}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-fabric={one}
                  onClick={() => picked("fabric", pickStyle(style, own, "fabric", one))}
                  className={`press h-9 rounded-[6px] px-3 text-[13px] font-bold ${on ? "bg-pick text-on-pick" : "bg-sheet-muted"}`}
                >
                  {say(`ui.door.fabric.${one}`)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
