// The travel data page (prologue.md R-PROLOGUE-009): the design's page, line for line. The
// header with its type line, the photo, the name, the nationality beside the age, the path and what the life was so
// far, where the life is from and the family beside how ready as the big figure (FROM), and the
// machine-readable strip at the foot, built from the game's own data. It prints on the door, after Begin and on the
// band's page. No stamp lands on it until a visa is granted:
// the visa's is the first, round and red, and the steps after it stamp beneath. Pale green security paper with green
// ink of its own: like the danfo yellow on things in the world, these colours belong to the page and never change with
// the theme. Never a real number, a coat of arms or an issuing authority, and the country code is the game's own
// made-up "JPC", never a real one. A faint JAPACITY mark runs across the paper, so a picture of it reads as the game's.
import type { CSSProperties } from "react";

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

/** The game's own made-up country code, in the type line and the strip: never a real one. */
export const PAGE_CODE = "JPC";

/** How far apart the fields drop in when the page prints, so they land one after another. */
const PRINT_STEP_MS = 110;

export interface PageFields {
  name: string;
  age: string;
  /** The path: the tile's name, the life as lived where the years went another way, or the ready life's kind. */
  path: string;
  /** What the life was so far, in one line: the tile's own, or the life as lived; absent where there is none. */
  was?: string;
  /** What the strip at the foot is built from: the home's district, the age in years and months, how ready. */
  strip?: Strip;
  /** How ready, as the page says it: "12%". */
  ready: string;
  /** The look's picture, the photo as made. */
  photo: string;
  /**
   * The look and the player's own colours on it (R-PROLOGUE-015): in a style, the photo is the figure rendered in it,
   * the one kept with the person where there is one, else drawn as the page prints; the look's picture until then.
   */
  wear?: { look: string; style?: LookStyle; photo?: string; photoPx?: number };
  /** The stamps, oldest first: none before the visa; the visa's first, then each step after it (`stampsOf`). */
  stamps?: readonly PageStamp[];
  /** The family the game drew, its means in a few words; empty until it is drawn, absent where the page does not say it. */
  family?: string;
  /**
   * Where the life is from, as a passport names a place of birth (R-PROLOGUE-009): the hometown's
   * name; empty until the family is drawn, absent where the page does not say it.
   */
  from?: string;
  /** The japa type read at the send-off and kept with its card (decision 0018); absent before then. */
  type?: { name: string; line: string };
}

/** A stamp on the page: its words, and for the visa's the way under them. */
export interface PageStamp {
  words: string;
  under?: string;
}

/** What the machine-readable strip is built from; a part not known yet prints as fillers. */
export interface Strip {
  district: string;
  /** Whole years only, "26Y": the page carries no months (R-PROLOGUE-009). */
  years: number | null;
  percent: number | null;
}

/** A field of the strip: capitals and digits, anything else a filler, padded with fillers to its length. */
export function mrz(words: string, length: number): string {
  const plain = words.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (plain.toUpperCase().replace(/[^A-Z0-9]/g, "<") + "<".repeat(length)).slice(0, length);
}

/** The strip's two lines: the name after the page's own code, then the district, the age and how ready. */
export function stripLines(name: string, strip: Strip): [string, string] {
  const age = strip.years === null ? "" : `${String(strip.years)}Y`;
  return [`P<${PAGE_CODE}${mrz(name, 25)}`, mrz(`${strip.district}<<${age}<<${strip.percent === null ? "" : String(strip.percent)}`, 30)];
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
  const drawn = usePhoto(page.wear?.look, page.wear?.style, page.wear?.photo, page.wear?.photoPx);
  if (drawn !== null) return <img src={drawn} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" data-photo-made />;
  return page.photo === "" ? null : <img src={page.photo} alt="" draggable={false} className="absolute top-[-3%] left-1/2 h-[330%] max-w-none -translate-x-1/2" />;
}

/** A stamp on the page: a red box of capitals, set down a little crooked; `big`, the visa's round stamp. */
export function Stamp({ words, turn, big = false, under }: { words: string; turn: number; big?: boolean; under?: string }) {
  const style: CSSProperties = { borderColor: PAGE_COLOURS.red, color: PAGE_COLOURS.red, transform: `rotate(${String(turn)}deg)` };
  if (big) {
    return (
      <span className="flex size-24 flex-col items-center justify-center rounded-full border-[3px] px-1 text-center font-mono text-[11px] leading-tight font-black tracking-[0.1em] uppercase" style={style} data-stamp data-stamp-round>
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

const LABEL = "font-mono text-[9px] font-bold tracking-[0.2em] uppercase";

/** The page. `print` drops the fields in one after another. */
export function DataPage({ page, print = false }: { page: PageFields; print?: boolean }) {
  let order = 0;
  const delay = (): number | null => (print ? (order += 1) * PRINT_STEP_MS : null);
  const [visa, ...after] = page.stamps ?? [];
  const lines = page.strip === undefined ? null : stripLines(page.name, page.strip);
  return (
    <div className="relative overflow-hidden rounded-[10px] shadow-[0_18px_40px_rgba(10,14,30,0.35)]" style={{ backgroundColor: PAGE_COLOURS.paper, backgroundImage: SECURITY, color: PAGE_COLOURS.ink }} data-page>
      <div className="flex items-center justify-between px-3 py-1.5 font-mono text-[10px] uppercase" style={{ background: PAGE_COLOURS.band, color: PAGE_COLOURS.paper }}>
        <span className="font-bold tracking-[0.25em]">{say("prologue.page.head")}</span>
        <span className="tracking-[0.2em]" style={{ opacity: 0.8 }} data-page-type>
          {say("ui.page.type-line")}
        </span>
      </div>
      <div className="flex gap-3 p-3">
        <div className="relative h-[128px] w-[98px] shrink-0 overflow-hidden rounded-[4px] border" style={{ background: PAGE_COLOURS.shade, borderColor: "rgba(12, 58, 36, 0.25)" }} data-photo aria-label={say("prologue.page.photo")} role="img">
          <Photo page={page} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Field id="name" label={say("prologue.page.name")} value={page.name} delay={delay()} />
          <div className="flex gap-3">
            <Field id="nationality" label={say("ui.page.field.nationality")} value={say("ui.page.nationality")} delay={delay()} />
            <Field id="age" label={say("prologue.page.age")} value={page.age} delay={delay()} />
          </div>
          <Field id="path" label={say("ui.page.field.path")} value={page.path} delay={delay()} />
          {page.was === undefined ? null : <Field id="was" label={say("prologue.page.path")} value={page.was} delay={delay()} />}
          {page.type === undefined ? null : <Field id="type" label={say("prologue.page.type")} value={page.type.name} delay={delay()} />}
        </div>
      </div>
      {/* Where the life is from, the family the game drew and how ready beside them, in a row under the photo; ready as the big figure. */}
      <div className="flex gap-3 px-3 pb-2">
        {page.from === undefined ? null : (
          <div className="max-w-[40%] shrink-0">
            <Field id="from" label={say("ui.page.field.from")} value={page.from} delay={delay()} />
          </div>
        )}
        <div className="min-w-0">{page.family === undefined ? null : <Field id="family" label={say("ui.page.field.family")} value={page.family} delay={delay()} />}</div>
        <div className="shrink-0 text-right" data-field="ready">
          <div className={LABEL} style={{ opacity: 0.62 }}>
            {say("prologue.page.ready")}
          </div>
          <div key={page.ready} className="num text-[20px] leading-none">
            {page.ready === "" ? say("prologue.page.empty") : page.ready}
          </div>
        </div>
      </div>
      {after.length === 0 ? null : (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2.5" data-stamps>
          {after.map((one, at) => (
            <Stamp key={one.words} words={one.words} turn={at % 2 === 0 ? -3 : 2.5} />
          ))}
        </div>
      )}
      {/* The game's mark, faint across the paper, as designed. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden data-page-mark>
        <span className="-rotate-[18deg] font-mono text-[44px] font-black tracking-[0.3em] whitespace-nowrap uppercase" style={{ color: PAGE_COLOURS.ink, opacity: 0.07 }}>
          {say("ui.game")}
        </span>
      </div>
      {lines === null ? null : (
        <div className="px-3 py-2 font-mono text-[11px] leading-snug tracking-[0.12em]" style={{ background: "rgba(12, 58, 36, 0.07)", color: "rgba(12, 58, 36, 0.8)" }} data-page-strip aria-hidden>
          <div className="truncate">{lines[0]}</div>
          <div className="truncate">{lines[1]}</div>
        </div>
      )}
      {/* The visa's stamp, the first the page takes: round and red across the page. */}
      {visa === undefined ? null : (
        <div className="pop pointer-events-none absolute top-8 right-4" data-stamp-visa>
          <Stamp words={visa.words} turn={-12} big {...(visa.under === undefined ? {} : { under: visa.under })} />
        </div>
      )}
    </div>
  );
}
