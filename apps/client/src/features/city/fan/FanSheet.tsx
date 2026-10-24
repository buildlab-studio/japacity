// The fan's acts as a small sheet (docs/design/09-the-games-look.md section 3; world:fan-of-sticker-buttons): when the free side
// of the screen cannot hold a thing's fan, or its acts are a long list, the same buttons open as a sheet of sticker cards,
// each the tap the fan's button is: the same picture, the same name, the same price pill or refusal, the same act on
// arrival. A thing whose acts are all the simulation's own opens their activity sheet instead (City's fallback).
import { useState } from "react";

import { cue } from "../../../shared/sound/cues";
import { Tile } from "../../../shared/tiles/Tile";
import { LookSheet } from "../../../shared/ui/look/LookSheet";
import { Sticker } from "../../../shared/ui/look/Sticker";
import { TINTS } from "../../../shared/ui/look/tint";
import { say } from "../../../shared/words/text";
import type { FanEntry } from "./fanActs";
import "./fan.css";

export interface FanSheetProps {
  /** The thing's id, on the sheet for the tests and the play driver. */
  thing: string;
  title: string;
  entries: readonly FanEntry[];
  /** A card tapped that can be had: as the fan's button, the caller walks to the thing and its act follows. */
  onAct: (entry: FanEntry) => void;
  onClose: () => void;
  /** The entry walked to now, pressed until its act lands. */
  going?: string | null;
}

export function FanSheet({ thing, title, entries, onAct, onClose, going = null }: FanSheetProps) {
  const [shaking, setShaking] = useState<{ id: string; n: number } | null>(null);
  const tap = (entry: FanEntry): void => {
    cue(entry.refusal !== null ? "no" : "tap");
    if (entry.refusal !== null) {
      setShaking((was) => ({ id: entry.id, n: (was?.n ?? 0) + 1 }));
      return;
    }
    onAct(entry);
  };
  return (
    <LookSheet open onOpenChange={(open) => (open ? undefined : onClose())} title={title}>
      <ul className="flex flex-col gap-2.5" data-fan-sheet={thing}>
        {entries.map((entry, index) => (
          <li key={entry.id} data-fan-act={entry.id} data-fan-from={entry.from} data-fan-kind={entry.kind} {...(entry.refusal === null ? {} : { "data-fan-refused": entry.refusal.kind })} {...(going === entry.id ? { "data-fan-going": "" } : {})}>
            <button
              key={shaking?.id === entry.id ? `shake-${String(shaking.n)}` : "still"}
              type="button"
              onClick={() => tap(entry)}
              aria-label={entry.refusal !== null || entry.price !== null || entry.free === true ? `${entry.name}: ${entry.refusal?.words ?? entry.price ?? say("ui.world.free")}` : (entry.label ?? entry.name)}
              {...(entry.refusal === null ? {} : { "aria-disabled": true })}
              className={`look-card flex w-full items-center gap-3 p-2.5 text-left active:translate-y-px ${shaking?.id === entry.id ? "fan-shake" : ""}`}
            >
              <span className={`inline-flex size-14 shrink-0 items-center justify-center rounded-[16px] ${TINTS[entry.tint]}`} aria-hidden>
                <Sticker alt={entry.name} tilt={index % 2 === 0 ? -4 : 4}>
                  <Tile of={entry.picture} size={38} />
                </Sticker>
              </span>
              <span className="min-w-0 flex-1 text-body font-bold">{entry.name}</span>
              {entry.refusal !== null ? (
                <span className={`sticker-chip bg-sheet-2 text-[12px] ${entry.refusal.kind === "short" ? "num text-[var(--out)]" : "text-text-2"}`} data-fan-refusal={entry.refusal.kind}>
                  {entry.refusal.words}
                </span>
              ) : entry.price !== null || entry.free === true ? (
                <span className="fan-sheet-price num" data-fan-price>
                  {entry.price ?? say("ui.world.free")}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </LookSheet>
  );
}
