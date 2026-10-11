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
import { keptTypeOf } from "../card/kept";
import { type Archetype, archetypeOf, throughUniversity } from "../frontdoor/archetypes";
import { sixteenPath } from "../words/sixteen";
import { gateLook } from "../frontdoor/Gate";
import { lookOf } from "../frontdoor/looks";
import { AGE, clockWords, yearsOf } from "../words/quality";
import { typeWords } from "../words/japaType";
import { readyPercent } from "../words/ready";
import { hasWords, say } from "../words/text";
import { DataPage, type PageFields } from "./DataPage";
import { familyCard, keptDraw } from "./family";
import { stampsOf } from "./stamps";

/** The character's first name: the one built at the door, else the ready life's own. */
function nameOf(person: KeptPerson | null, view: Pick<PlayerView, "scenario">): string {
  if (person !== null && person.name !== "") return person.name;
  const own = `${view.scenario}.name`;
  return hasWords(own) ? (say(own).split(/\s+/)[0] ?? "") : "";
}

/**
 * The years as lived where they went another way than the tile's (R-PROLOGUE-011, 014), else null: the tile's own.
 * While the years still go by the life has lived none of its path, so the page names the tile until they close: a
 * nurse at sixteen read as lived is a trade.
 */
function livedOtherwise(archetype: Archetype, view: PlayerView): ReturnType<typeof sixteenPath> {
  if (view.prologue !== null) return null;
  const lived = sixteenPath(view);
  return lived === null || (lived === "degree") === throughUniversity(archetype) ? null : lived;
}

/** The home's district, for the page's strip: Surulere, Ojuelegba or Makoko, as the door names it. */
function districtOf(view: Pick<PlayerView, "home">): string {
  const place = view.home.place;
  if (place === null) return "";
  const key = `ui.door.home.where.${place.slice("place.".length)}`;
  return hasWords(key) ? say(key) : "";
}

/** The page's fields from the view as it stands and the person kept beside the save. */
export function pageOf(view: PlayerView, person: KeptPerson | null = readPerson()): PageFields {
  const archetype = archetypeOf(person?.archetype);
  const kind = `${view.scenario}.kind`;
  // The japa type kept with the send-off card stays on the page from then on (decision 0018).
  const type = keptTypeOf(view.scenario);
  const lived = archetype === null ? null : livedOtherwise(archetype, view);
  const draw = keptDraw();
  const months = view.qualities.find((quality) => quality.id === AGE)?.value ?? 0;
  // READY is Japa's own figure, one source.
  const percent = readyPercent(view) ?? 0;
  return {
    ...(type === null ? {} : { type: typeWords(type) }),
    name: nameOf(person, view),
    age: clockWords(view.qualities),
    // The path and what it was: the tile's own while the life went its way, the life as lived where it did not.
    path: archetype === null ? (hasWords(kind) ? say(kind) : "") : lived === null ? say(`prologue.archetype.${archetype.id}.name`) : say(`ui.page.lived.${lived}`),
    ...(archetype === null ? {} : { was: lived === null ? say(`prologue.archetype.${archetype.id}.was`) : say(`prologue.page.lived.${lived}`) }),
    ...(draw === null ? {} : { family: familyCard(draw, archetype?.id === "water").title }),
    ready: say("prologue.page.ready.figure", { percent }),
    strip: { district: districtOf(view), years: yearsOf(months), months: months - yearsOf(months) * 12, percent },
    photo: lookOf(gateLook(person?.look))?.picture ?? "",
    // The player's own colours, and the photo drawn in them, kept with the person (R-PROLOGUE-015).
    ...(person?.style === undefined ? {} : { wear: { look: person.look, style: person.style, ...(person.photo === undefined ? {} : { photo: person.photo }), ...(person.photoPx === undefined ? {} : { photoPx: person.photoPx }) } }),
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
        <p className="band mt-2 rounded-[6px] px-3 py-2 text-[12px] leading-snug">{say(stamps.length === 0 ? "ui.page.stamps.none" : "ui.page.stamps.some")}</p>
      </div>
    </div>,
    document.body,
  );
}

/** The band's clock and place as they were before the page: the age small over the place's name. */
function Plain({ when, place }: { when: string; place: string }) {
  return (
    <div className="min-w-0 flex-1 leading-none">
      <div className="label label-strong truncate text-[9px] tabular-nums">{when}</div>
      <h2 className="title mt-0.5 truncate text-[16px] leading-tight">{place}</h2>
    </div>
  );
}

function Opener({ store, when, place }: { store: GameStore; when: string; place: string }) {
  const view = useStore(store, (state) => state.view);
  const [open, setOpen] = useState(false);
  if (view === null) return <Plain when={when} place={place} />;
  const name = nameOf(readPerson(), view);
  const show = (): void => setOpen(true);
  return (
    <div className="min-w-0 flex-1 leading-none" data-band-person>
      {/* The design's bar: the name with the place small, over the age. The name and the age open the page; the place's name does nothing (R-WORLD-002). */}
      {/* The name and the place run on as one line of text that wraps to a second, never a column of words: a home's
          place line ("Your room, a compound in Ojuelegba", R-WORLD-002) fits in up to three short lines beside the clock, the place in sentence case so it reads as a line, not a label (the twelfth
          review). */}
      <div className="label label-strong line-clamp-3 min-w-0 text-[9px] leading-none">
        {name === "" ? null : (
          <>
            <button type="button" tabIndex={-1} aria-hidden className="inline text-left uppercase" onClick={show}>
              {name}
            </button>
            <span aria-hidden className="px-1">
              ·
            </span>
          </>
        )}
        <h2 className="inline text-[10px] tracking-normal normal-case">{place}</h2>
      </div>
      <button type="button" className="press title num mt-0.5 block max-w-full truncate text-left text-[16px] leading-[1.1]" onClick={show} aria-label={say("prologue.page.open")} data-page-open>
        {when}
      </button>
      {open ? <PageSheet view={view} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

/**
 * The band's clock and place (R-WORLD-002, R-PROLOGUE-009): in a game, the name with the place over the age, as the
 * the design's bar has it, the name and the age opening the page; outside one, the age over the place's name.
 */
export function BandPerson({ when, place }: { when: string; place: string }) {
  const store = useGameStoreIfAny();
  if (store === null) return <Plain when={when} place={place} />;
  return <Opener store={store} when={when} place={place} />;
}
