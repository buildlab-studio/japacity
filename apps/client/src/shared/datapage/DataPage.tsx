// The travel data page (prologue.md R-PROLOGUE-009; the design): who the character is, on the
// document they will leave with. The front door prints it field by field and stamps it; the band opens it for the
// rest of the life, with the age kept current, how ready they are, and a red stamp for each step taken. Pale green
// security paper with green ink of its own: like the danfo yellow on things in the world, these colours belong to the
// page and never change with the theme. No coat of arms, no issuing authority, no real layout.
import type { CSSProperties, ReactNode } from "react";

import type { LookStyle } from "../frontdoor/style";
import { say } from "../words/text";
import { usePhoto } from "./photo";

/** The page's own colours: the paper, its darker shade behind the photo, the ink, the band and the stamps' red. */
export const PAGE_COLOURS = { paper: "#e2eedd", shade: "#cde2c7", ink: "#0c3a24", band: "#0d5732", red: "#b3302a" } as const;

/** Wavy security lines and a rosette in the page's own green: stripes with hard stops, never a soft fill. */
const SECURITY = [
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='40'%3E%3Cg fill='none' stroke='%230d5732' stroke-opacity='.11'%3E%3Cpath d='M0 20 C20 0 40 40 60 20 S100 0 120 20'/%3E%3Cpath d='M0 26 C20 6 40 46 60 26 S100 6 120 26'/%3E%3Cpath d='M0 14 C20 -6 40 34 60 14 S100 -6 120 14'/%3E%3C/g%3E%3C/svg%3E\")",
  "repeating-radial-gradient(circle at 82% 40%, transparent 0 7px, rgba(13, 87, 50, 0.07) 7px 8px)",
].join(", ");

/** How far apart the fields drop in when the page prints, so they land one after another. */
const PRINT_STEP_MS = 110;

export interface PageFields {
  name: string;
  age: string;
  /** What the life was before: the tile's name or the ready life's kind. */
  path: string;
  /** How ready, as the page says it: "12%". */
  ready: string;
  /** The look's picture, the photo as made. */
  photo: string;
  /**
   * The look and the player's own colours on it (R-PROLOGUE-015): in a style, the photo is the figure rendered in it,
   * the one kept with the person where there is one, else drawn as the page prints; the look's picture until then.
   */
  wear?: { look: string; style?: LookStyle; photo?: string };
  /** One per step taken toward leaving, oldest first. */
  stamps?: readonly string[];
  /** The family the game drew, as its card's title; empty until it is drawn, absent where the page does not say it. */
  family?: string;
  /** The japa type read at the send-off and kept with its card (decision 0018); absent before then. */
  type?: { name: string; line: string };
}

function Field({ id, label, value, delay }: { id: string; label: string; value: string; delay: number | null }) {
  return (
    <div className="min-w-0" data-field={id}>
      <div className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase" style={{ opacity: 0.62 }}>
        {label}
      </div>
      <div key={value} className={`truncate text-[13px] leading-tight font-bold ${delay === null ? "" : "drop"}`} style={delay === null ? undefined : { animationDelay: `${String(delay)}ms` }}>
        {value === "" ? say("prologue.page.empty") : value}
      </div>
    </div>
  );
}

/** The photo: the figure in the player's colours where it is drawn, else the look's own picture, cropped to the face. */
function Photo({ page }: { page: PageFields }) {
  const drawn = usePhoto(page.wear?.look, page.wear?.style, page.wear?.photo);
  if (drawn !== null) return <img src={drawn} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" data-photo-made />;
  return page.photo === "" ? null : <img src={page.photo} alt="" draggable={false} className="absolute top-[-3%] left-1/2 h-[330%] max-w-none -translate-x-1/2" />;
}

/** A stamp on the page: a red box of capitals, set down a little crooked; `big`, Begin's round stamp across the page. */
export function Stamp({ words, turn, big = false, under }: { words: string; turn: number; big?: boolean; under?: string }) {
  const style: CSSProperties = { borderColor: PAGE_COLOURS.red, color: PAGE_COLOURS.red, transform: `rotate(${String(turn)}deg)` };
  if (big) {
    return (
      <span className="flex size-24 flex-col items-center justify-center rounded-full border-[3px] text-center font-mono text-[11px] leading-tight font-black tracking-[0.1em] uppercase" style={style} data-stamp data-stamp-round>
        {words}
        {under === undefined ? null : <span className="mt-0.5 text-[9px] font-bold">{under}</span>}
      </span>
    );
  }
  return (
    <span className="inline-block rounded-[3px] border-2 px-1.5 py-0.5 font-mono text-[9px] font-black tracking-[0.12em] uppercase" style={style} data-stamp>
      {words}
    </span>
  );
}

/** The page. `print` drops the fields in one after another; `stamp` lands across the page, Begin's "Ready to start". */
export function DataPage({ page, print = false, stamp }: { page: PageFields; print?: boolean; stamp?: ReactNode }) {
  let order = 0;
  const delay = (): number | null => (print ? (order += 1) * PRINT_STEP_MS : null);
  const stamps = page.stamps ?? [];
  return (
    <div className="relative overflow-hidden rounded-[10px] shadow-[0_18px_40px_rgba(10,14,30,0.35)]" style={{ backgroundColor: PAGE_COLOURS.paper, backgroundImage: SECURITY, color: PAGE_COLOURS.ink }} data-page>
      <div className="px-3 py-1.5 font-mono text-[10px] font-bold tracking-[0.25em] uppercase" style={{ background: PAGE_COLOURS.band, color: PAGE_COLOURS.paper }}>
        {say("prologue.page.head")}
      </div>
      <div className="flex gap-3 p-3">
        <div className="relative h-[128px] w-[98px] shrink-0 overflow-hidden rounded-[4px] border" style={{ background: PAGE_COLOURS.shade, borderColor: "rgba(12, 58, 36, 0.25)" }} data-photo aria-label={say("prologue.page.photo")} role="img">
          <Photo page={page} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Field id="name" label={say("prologue.page.name")} value={page.name} delay={delay()} />
          <Field id="age" label={say("prologue.page.age")} value={page.age} delay={delay()} />
          <Field id="path" label={say("prologue.page.path")} value={page.path} delay={delay()} />
          {page.type === undefined ? null : <Field id="type" label={say("prologue.page.type")} value={page.type.name} delay={delay()} />}
        </div>
      </div>
      {/* The family the game drew and how ready, in a row under the photo; ready as a big figure on the right. */}
      <div className="flex items-end gap-3 px-3 pb-3">
        <div className="min-w-0 flex-1">{page.family === undefined ? null : <Field id="family" label={say("ui.page.field.family")} value={page.family} delay={delay()} />}</div>
        <div className="shrink-0 text-right" data-field="ready">
          <div className="font-mono text-[9px] font-bold tracking-[0.2em] uppercase" style={{ opacity: 0.62 }}>
            {say("prologue.page.ready")}
          </div>
          <div key={page.ready} className="num text-[20px] leading-none">
            {page.ready === "" ? say("prologue.page.empty") : page.ready}
          </div>
        </div>
      </div>
      {stamps.length === 0 ? null : (
        <div className="flex flex-wrap gap-1.5 px-3 pb-3" data-stamps>
          {stamps.map((words, at) => (
            <Stamp key={words} words={words} turn={at % 2 === 0 ? -3 : 2.5} />
          ))}
        </div>
      )}
      {stamp === undefined || stamp === null ? null : <div className="pop pointer-events-none absolute top-8 right-4">{stamp}</div>}
    </div>
  );
}
