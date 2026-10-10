// The data page in the game (prologue.md R-PROLOGUE-009): the band's name with the age opens it, and it stays with
// the character: the name, the photo, the age kept current, what the life was, how ready, and a red stamp for each
// step taken toward leaving, all read from the view as it stands. A close returns to the world.
import type { PlayerView } from "@japacity/sim";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "zustand";

import { useGameStoreIfAny } from "../../authority/GameProvider";
import { type KeptPerson, readPerson } from "../../authority/person";
import type { GameStore } from "../../authority/store";
import { archetypeOf } from "../frontdoor/archetypes";
import { gateLook } from "../frontdoor/Gate";
import { lookOf } from "../frontdoor/looks";
import { clockWords } from "../words/quality";
import { hasWords, say } from "../words/text";
import { DataPage, type PageFields } from "./DataPage";
import { stampsOf } from "./stamps";

/** The character's first name: the one built at the door, else the ready life's own. */
function nameOf(person: KeptPerson | null, view: Pick<PlayerView, "scenario">): string {
  if (person !== null && person.name !== "") return person.name;
  const own = `${view.scenario}.name`;
  return hasWords(own) ? (say(own).split(/\s+/)[0] ?? "") : "";
}

/** The page's fields from the view as it stands and the person kept beside the save. */
export function pageOf(view: PlayerView, person: KeptPerson | null = readPerson()): PageFields {
  const archetype = archetypeOf(person?.archetype);
  const kind = `${view.scenario}.kind`;
  return {
    name: nameOf(person, view),
    age: clockWords(view.qualities),
    path: archetype !== null ? say(`prologue.archetype.${archetype.id}.name`) : hasWords(kind) ? say(kind) : "",
    ready: say("prologue.page.ready.figure", { percent: view.japacity.percent ?? 0 }),
    photo: lookOf(gateLook(person?.look))?.picture ?? "",
    stamps: stampsOf(view),
  };
}

/** The page over the world, from the bottom, with a close. */
export function PageSheet({ view, onClose }: { view: PlayerView; onClose: () => void }) {
  const page = pageOf(view);
  const stamps = page.stamps ?? [];
  useEffect(() => {
    const close = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  return createPortal(
    <div className="fixed inset-0 z-[70] bg-scrim" onClick={onClose} data-page-sheet>
      <div role="dialog" aria-modal="true" aria-label={say("prologue.door.page.title")} className="rise absolute inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] mx-auto max-w-[420px]" onClick={(event) => event.stopPropagation()}>
        <div className="band mb-2 flex items-center justify-between rounded-[6px] px-3 py-2">
          <h2 className="title text-[20px] leading-none">{say("prologue.door.page.title")}</h2>
          <button type="button" className="press flex size-9 items-center justify-center rounded-[6px] bg-white/15" onClick={onClose} aria-label={say("prologue.page.close")} autoFocus>
            <X size={18} />
          </button>
        </div>
        <DataPage page={page} />
        <p className="band mt-2 rounded-[6px] px-3 py-2 text-[12px] leading-snug">{say(stamps.length === 0 ? "prologue.page.stamps.none" : "prologue.page.stamps.some")}</p>
      </div>
    </div>,
    document.body,
  );
}

function Opener({ store, when }: { store: GameStore; when: string }) {
  const view = useStore(store, (state) => state.view);
  const [open, setOpen] = useState(false);
  if (view === null) return <div className="label label-strong truncate text-[9px] tabular-nums">{when}</div>;
  const name = nameOf(readPerson(), view);
  return (
    <>
      <button type="button" className="press label label-strong block max-w-full truncate text-left text-[9px] tabular-nums" onClick={() => setOpen(true)} aria-label={say("prologue.page.open")} data-page-open>
        {name === "" ? when : say("prologue.page.band", { name, age: when })}
      </button>
      {open ? <PageSheet view={view} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/** The band's top line (R-WORLD-002, R-PROLOGUE-009): in a game, the name with the age, which opens the page; outside one, the age alone. */
export function BandPerson({ when }: { when: string }) {
  const store = useGameStoreIfAny();
  if (store === null) return <div className="label label-strong truncate text-[9px] tabular-nums">{when}</div>;
  return <Opener store={store} when={when} />;
}
