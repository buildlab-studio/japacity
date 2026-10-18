// The data page in the game (prologue.md R-PROLOGUE-009): the band's name with the age opens it, and it stays with
// the character: the name, the photo, the age kept current, what the life was, how ready, and a red stamp for each
// step taken toward leaving, all read from the view as it stands. A close returns to the world.
import type { PlayerView } from "@japacity/sim";
import { X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useStore } from "zustand";

import { useGameStoreIfAny } from "../../authority/GameProvider";
import { type KeptPerson, readPerson } from "../frontdoor/person";
import type { GameStore } from "../../authority/store";
import { keptTypeOf } from "../share/kept";
import { type Archetype, archetypeOf, throughUniversity } from "../frontdoor/archetypes";
import { sixteenPath } from "../words/sixteen";
import { gateLook } from "../frontdoor/Gate";
import { lookOf } from "../frontdoor/looks";
import { AGE, pageAgeWords, yearsOf } from "../words/quality";
import { typeWords } from "../words/japaType";
import { readyPercent, readyWords } from "../words/ready";
import { hasWords, hometownWords, say } from "../words/text";
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
 * While the years still go by the life has lived none of its path, so the page names the tile until they close: read as
 * lived, a nurse at sixteen would be a trade.
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
  // The japa type kept with the send-off card stays on the page from then on (decision 0024).
  const type = keptTypeOf(view.scenario);
  const lived = archetype === null ? null : livedOtherwise(archetype, view);
  const draw = keptDraw();
  const months = view.qualities.find((quality) => quality.id === AGE)?.value ?? 0;
  // READY is Japa's own figure, one source.
  const percent = readyPercent(view) ?? 0;
  return {
    ...(type === null ? {} : { type: typeWords(type) }),
    name: nameOf(person, view),
    age: pageAgeWords(view.qualities),
    // The path and what it was: the tile's own while the life went its way, the life as lived where it did not.
    path: archetype === null ? (hasWords(kind) ? say(kind) : "") : lived === null ? say(`prologue.archetype.${archetype.id}.name`) : say(`ui.page.lived.${lived}`),
    ...(archetype === null ? {} : { was: lived === null ? say(`prologue.archetype.${archetype.id}.was`) : say(`prologue.page.lived.${lived}`) }),
    ...(draw === null ? {} : { family: familyCard(draw, archetype?.id === "water").means }),
    // Where the life is from, kept in the view after the prologue closes (R-PROLOGUE-009).
    ...(view.hometown === null ? {} : { from: hometownWords(view.hometown) }),
    ready: readyWords(percent),
    strip: { district: districtOf(view), years: yearsOf(months), percent },
    photo: lookOf(gateLook(person?.look))?.picture ?? "",
    // The player's own colours, or the look as made, and the photo drawn in them, kept with the person (R-PROLOGUE-015).
    ...(person === null ? {} : { wear: { look: person.look, ...(person.style === undefined ? {} : { style: person.style }), ...(person.photo === undefined ? {} : { photo: person.photo }), ...(person.photoPx === undefined ? {} : { photoPx: person.photoPx }) } }),
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
        <div className="band adire mb-2 flex items-center justify-between rounded-[6px] px-3 py-2">
          <h2 className="title text-[20px] leading-none">{say("prologue.door.page.title")}</h2>
          <button type="button" className="press flex size-9 items-center justify-center rounded-[6px] bg-white/15" onClick={onClose} aria-label={say("prologue.page.close")} autoFocus>
            <X size={18} />
          </button>
        </div>
        <DataPage page={page} />
        <p className="band adire mt-2 rounded-[6px] px-3 py-2 text-[12px] leading-snug">{say(stamps.length === 0 ? "ui.page.stamps.none" : "ui.page.stamps.some")}</p>
      </div>
    </div>,
    document.body,
  );
}

/** The body's word, only when it complains (R-QUALITY-007): "Hungry", "Tired", never a number; a sticker chip in the body's tint. */
function Body({ body }: { body: string | null | undefined }) {
  if (body === null || body === undefined) return null;
  return (
    <span key={body} className="sticker-chip pop shrink-0 bg-tint-body" style={{ rotate: "-3deg" }} data-band-body={body}>
      {body}
    </span>
  );
}

/** The band's second line: the age, then the place small beside it, the band's heading (R-WORLD-002). */
function Under({ age, place }: { age: ReactNode; place: string }) {
  return (
    <div className="mt-0.5 flex min-w-0 items-baseline gap-1 text-[11px] leading-tight text-text-2">
      {age}
      {age === null ? null : <span aria-hidden>·</span>}
      <h2 className="min-w-0 truncate font-medium">{place}</h2>
    </div>
  );
}

/** The band's person outside a game: the age with the place, the part of the day and the body beside it. */
function Plain({ when, place, body = null, part = null }: { when: string; place: string; body?: string | null; part?: ReactNode }) {
  return (
    <div className="min-w-0 flex-1 leading-none">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="num truncate text-[16px] leading-tight">{when}</span>
        {part}
        <Body body={body} />
      </div>
      <Under age={null} place={place} />
    </div>
  );
}

function Opener({ store, when, place, body = null, part = null }: { store: GameStore; when: string; place: string; body?: string | null; part?: ReactNode }) {
  const view = useStore(store, (state) => state.view);
  const [open, setOpen] = useState(false);
  if (view === null) return <Plain when={when} place={place} body={body} part={part} />;
  const name = nameOf(readPerson(), view);
  const show = (): void => setOpen(true);
  return (
    <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,auto)_auto_1fr] items-center gap-x-1.5 leading-none" data-band-person>
      {/* The lively band: the name with the part of the day beside it, the age and the place small under it. The name and the
          age open the page; the place's name does nothing (R-WORLD-002, R-PROLOGUE-009). The age comes before the part of
          the day to a screen reader and the keyboard, as before; the grid lays them out. */}
      {name === "" ? null : (
        <button type="button" tabIndex={-1} aria-hidden className="col-start-1 row-start-1 min-w-0 truncate text-left text-[16px] leading-tight font-bold" onClick={show}>
          {name}
        </button>
      )}
      <div className="col-span-3 col-start-1 row-start-2 min-w-0">
        <Under
          age={
            <button type="button" className="press num shrink-0 text-left font-bold" onClick={show} aria-label={say("prologue.page.open")} data-page-open>
              {when}
            </button>
          }
          place={place}
        />
      </div>
      <div className={`${name === "" ? "col-start-1" : "col-start-2"} row-start-1 flex min-w-0 items-center gap-1.5`}>
        {part}
        <Body body={body} />
      </div>
      {open ? <PageSheet view={view} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

/**
 * The band's clock and place (R-WORLD-002, R-PROLOGUE-009): in a game, the name with the place over the age, the
 * name and the age opening the page; outside one, the age over the place's name.
 */
export function BandPerson({ when, place, body = null, part = null }: { when: string; place: string; body?: string | null; part?: ReactNode }) {
  const store = useGameStoreIfAny();
  if (store === null) return <Plain when={when} place={place} body={body} part={part} />;
  return <Opener store={store} when={when} place={place} body={body} part={part} />;
}
