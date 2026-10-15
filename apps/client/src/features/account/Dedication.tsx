// The dedication page (docs/rules/account.md R-ACCOUNT-032): the light large on navy with "soksonjr" under it
// from content (city.md R-CITY-021 keeps it there, apart from the words tables), "Sun re o." under it, one button, and a
// close. Reached from the third light on the start screen's wire and from the five taps on Settings' version line,
// online or not; the shell hands it to Settings, so the phone never imports this feature. Nothing about it is counted
// or sent.
//
// "Light one for yours" (R-ACCOUNT-033, picture `03-your-light`) opens a small sheet: a name and, if wanted, the years.
// The light then hangs beside the big one with its name under it, for this visit (the server keeps it in round 2),
// one per device; a tap on it offers "Put it out". The page is always the night's navy, whatever the hour.
import { checkLight, DEDICATION, DEDICATION_NICKNAME, LIGHT_FIRST_YEAR, LIGHT_NAME_CHARACTERS, type Light, type LightAsked, lightWords, lightYears } from "@japacity/content";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { type FormEvent, useState } from "react";

import { say } from "../../shared/words/text";
import { Bulb, capTop, Glow } from "./bulb";

/** The page's stage, in the design's own units: one pixel each, centred; a wider phone shows more of the wire. */
const W = 390;
const H = 340;

/** The big light alone, as `02-dedication-page` hangs it, and beside a player's own, as `03-your-light` does. */
const ALONE = { x: 195, y: 216, r: 36 };
const BESIDE = { x: 150, y: 214, r: 36 };
const OWN = { x: 280, y: 227, r: 11 };
/** The player's light breathes half a breath after the big one, as the design has it. */
const BREATH_OFFSET = 2_000;

function wireAlone(): string {
  return `M-60 20 Q${String(ALONE.x)} 300 450 20`;
}

function wireBeside(): string {
  const big = capTop(BESIDE.y, BESIDE.r);
  const own = capTop(OWN.y, OWN.r);
  return `M-60 30 C 60 140, 120 ${String(big)}, ${String(BESIDE.x)} ${String(big)} C 200 ${String(big)}, 245 ${String(own)}, ${String(OWN.x)} ${String(own)} C 325 ${String(own)}, 370 170, 450 110`;
}

/** The small bulb drawn on the button, as the design's pill carries it. */
function BulbMark() {
  return (
    <svg width="18" height="20" viewBox="0 0 18 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M9 0v3" />
      <rect x="6" y="3" width="6" height="4.5" rx="1" />
      <circle cx="9" cy="13" r="5.5" />
    </svg>
  );
}

/**
 * the owner's line in rows, as the design sets it: after its first comma, before a bracket, and after a closing bracket's
 * full stop. Cut from content's own words, never retyped: the rows joined are the line, and a line with none of those
 * marks stands as one row.
 */
export function lineRows(line: string): string[] {
  return line
    .split(/(?<=^[^,]*, )|(?= \()|(?<=\)\. )/u)
    .filter((row) => row !== "");
}

const EMPTY: LightAsked = { name: "", from: "", to: "" };

/** The device's year: a light's years run up to it. */
function thisYear(): number {
  return new Date().getFullYear();
}

/** R-ACCOUNT-033: the sheet. A name of at most four words and forty characters, the years if wanted, and Light it. */
function LightSheet({ open, onClose, year, onLit }: { open: boolean; onClose: () => void; year: number; onLit: (light: Light) => void }) {
  const [asked, setAsked] = useState<LightAsked>(EMPTY);
  const checked = checkLight(asked, year);
  // A field says what is wrong only once something is in it; an empty name simply keeps Light it from working.
  const problems = checked.ok ? [] : checked.problems.filter((problem) => problem !== "name-empty");
  const light = (event: FormEvent): void => {
    event.preventDefault();
    if (!checked.ok) return;
    onLit(checked.light);
    setAsked(EMPTY);
    onClose();
  };
  const field = "bg-transparent text-[18px] font-semibold text-text outline-hidden placeholder:text-text-2";
  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <Dialog.Portal>
        <Dialog.Backdrop className="motion-scrim fixed inset-0 z-[85] bg-black/50 data-ending-style:pointer-events-none data-closed:pointer-events-none" />
        <Dialog.Popup
          data-paint="night"
          className="motion-sheet data-ending-style:pointer-events-none data-closed:pointer-events-none fixed inset-x-0 bottom-0 z-[86] mx-auto flex max-h-[88dvh] max-w-[480px] flex-col gap-4 overflow-y-auto rounded-t-[20px] border border-sheet-line bg-sheet px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-text outline-hidden"
          data-light-sheet
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="text-[22px] font-bold">{say("ui.dedication.sheet")}</Dialog.Title>
            <Dialog.Close aria-label={say("ui.dedication.close")} className="-mt-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md opacity-80 focus-visible:outline-2 focus-visible:outline-text">
              <X size={20} aria-hidden />
            </Dialog.Close>
          </div>
          <form className="flex flex-col gap-3" onSubmit={light} noValidate>
            <label className="flex flex-col gap-1 rounded-[12px] border border-sheet-line bg-sheet-2 px-4 py-2.5">
              <span className="text-[13px] text-text-2">{say("ui.dedication.name")}</span>
              <input
                className={`${field} w-full`}
                type="text"
                value={asked.name}
                maxLength={LIGHT_NAME_CHARACTERS}
                autoComplete="off"
                autoCapitalize="words"
                enterKeyHint="done"
                onChange={(event) => setAsked({ ...asked, name: event.target.value })}
                data-light-name
              />
            </label>
            <fieldset className="flex flex-col gap-1 rounded-[12px] border border-sheet-line bg-sheet-2 px-4 py-2.5">
              <legend className="float-left text-[13px] text-text-2">{say("ui.dedication.years")}</legend>
              <div className="clear-left flex items-center gap-3">
                <input className={`${field} w-[4.5ch] tabular-nums`} type="text" inputMode="numeric" maxLength={4} value={asked.from} aria-label={say("ui.dedication.from")} onChange={(event) => setAsked({ ...asked, from: event.target.value })} data-light-from />
                <span className="text-[18px] font-semibold text-text-2" aria-hidden>
                  {say("ui.dedication.between")}
                </span>
                <input className={`${field} w-[4.5ch] tabular-nums`} type="text" inputMode="numeric" maxLength={4} value={asked.to} aria-label={say("ui.dedication.to")} onChange={(event) => setAsked({ ...asked, to: event.target.value })} data-light-to />
              </div>
            </fieldset>
            <div aria-live="polite" className="flex flex-col gap-1" data-light-problems>
              {problems.map((problem) => (
                <p key={problem} className="text-[14px] font-semibold text-signal" data-light-problem={problem}>
                  {say(`ui.dedication.problem.${problem}`, { first: String(LIGHT_FIRST_YEAR), year: String(year) })}
                </p>
              ))}
            </div>
            <p className="text-center text-[14px] text-text-2">{say("ui.dedication.kept")}</p>
            <button type="submit" className="btn-main justify-center" disabled={!checked.ok} data-light-it>
              {say("ui.dedication.light-it")}
            </button>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** The player's own light on the page: beside the big one, its name under it; a tap on it offers "Put it out". */
function OwnOnPage({ light, onPutOut }: { light: Light; onPutOut: () => void }) {
  const [offered, setOffered] = useState(false);
  const words = lightWords(light, say("ui.dedication.between"));
  const years = lightYears(light, say("ui.dedication.between"));
  return (
    <>
      <button
        type="button"
        className="absolute size-11 rounded-md focus-visible:outline-2 focus-visible:outline-text"
        style={{ left: OWN.x - 22, top: OWN.y - 26 }}
        aria-label={words}
        aria-expanded={offered}
        onClick={() => setOffered((was) => !was)}
        data-own-light="page"
      />
      {/* Under its own light, as a light in the field carries its name: the name, and the years on a row of their own. */}
      <div className="absolute flex w-[170px] -translate-x-1/2 flex-col items-center gap-1 text-center" style={{ left: OWN.x, top: OWN.y + OWN.r + 12 }}>
        <p className="text-[14px] leading-snug text-balance text-text" data-own-light-words>
          <span className="block font-medium">{light.name}</span>
          {years === null ? null : (
            <>
              <span className="sr-only">, </span>
              <span className="block text-text-2 tabular-nums">{years}</span>
            </>
          )}
        </p>
        {offered ? (
          <button
            type="button"
            className="motion-in-fade min-h-11 px-1 text-[14px] font-semibold text-text-2 underline underline-offset-4"
            onClick={() => {
              setOffered(false);
              onPutOut();
            }}
            data-put-out
          >
            {say("ui.dedication.put-out")}
          </button>
        ) : null}
      </div>
    </>
  );
}

export interface DedicationProps {
  open: boolean;
  onClose: () => void;
  /** A seam for tests: the current year the sheet's years run up to; the device's own when left out. */
  year?: number;
}

/** R-ACCOUNT-032: the page, over everything, the night's navy at any hour. */
export function Dedication({ open, onClose, year }: DedicationProps) {
  const [own, setOwn] = useState<Light | null>(null);
  const [sheet, setSheet] = useState(false);
  const big = own === null ? ALONE : BESIDE;
  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <Dialog.Portal>
        <Dialog.Popup
          aria-label={say("ui.dedication.page")}
          data-paint="night"
          className="motion-scrim data-ending-style:pointer-events-none data-closed:pointer-events-none fixed inset-0 z-[80] overflow-x-hidden overflow-y-auto bg-sheet pb-[max(24px,env(safe-area-inset-bottom))] text-text outline-hidden"
          data-dedication-page
        >
          <div className="relative left-1/2 -translate-x-1/2" style={{ width: W, height: H }}>
            <Glow x={big.x} y={big.y} radius={170} alpha={0.62} name="big" />
            {own === null ? null : <Glow x={OWN.x} y={OWN.y} radius={60} alpha={0.7} offsetMs={BREATH_OFFSET} name="own" />}
            <svg className="absolute inset-0 overflow-visible" width={W} height={H} viewBox={`0 0 ${String(W)} ${String(H)}`} aria-hidden>
              <path d={own === null ? wireAlone() : wireBeside()} fill="none" stroke="#c9c2b2" strokeOpacity="0.5" strokeWidth="1.6" />
              <Bulb x={big.x} y={big.y} r={big.r} />
              {own === null ? null : <Bulb x={OWN.x} y={OWN.y} r={OWN.r} />}
            </svg>
            {/* The big light carries its name under it, as a light carries one (R-ACCOUNT-032): exactly as the owner wrote it. */}
            <p className="absolute -translate-x-1/2 text-[15px] font-medium tracking-wide text-text" style={{ left: big.x, top: big.y + big.r + 14 }} data-dedication-name>
              {DEDICATION_NICKNAME}
            </p>
            {own === null ? null : <OwnOnPage light={own} onPutOut={() => setOwn(null)} />}
          </div>
          <div className="mx-auto flex max-w-[330px] flex-col items-center px-2 text-center">
            <p className="text-[18px] leading-[1.55] font-medium text-balance" data-dedication-line>
              {lineRows(DEDICATION).map((row, at) => (
                <span key={at} className="block">
                  {row}
                </span>
              ))}
            </p>
            <p className="mt-7 text-[16px] font-bold" data-dedication-rest>
              {say("ui.dedication.rest")}
            </p>
            {own === null ? (
              <button
                type="button"
                className="pill-button mt-16"
                style={{ background: "var(--on-strong)", color: "var(--strong)", borderColor: "var(--on-strong)", boxShadow: "none" }}
                onClick={() => setSheet(true)}
                data-light-one
              >
                <BulbMark />
                {say("ui.dedication.light-one")}
              </button>
            ) : (
              <p className="mt-16 text-[13px] text-text-2" data-dedication-kept>
                {say("ui.dedication.kept")}
              </p>
            )}
          </div>
          <Dialog.Close
            aria-label={say("ui.dedication.close")}
            className="absolute top-[max(14px,env(safe-area-inset-top))] right-[14px] inline-flex size-11 items-center justify-center rounded-md opacity-80 focus-visible:outline-2 focus-visible:outline-text"
            data-dedication-close
          >
            <X size={22} aria-hidden />
          </Dialog.Close>
          <LightSheet open={sheet} onClose={() => setSheet(false)} year={year ?? thisYear()} onLit={setOwn} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
