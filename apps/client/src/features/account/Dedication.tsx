// The dedication page (account:dedication-page-and-its-doors): a full screen of night over
// the lagoon, strings of small lights held up by canoes, the owner's light large on the top string with "soksonjr"
// under it, and every light anyone has lit along the strings, the approved ones carrying their names. At the top the
// true count and "on the water tonight"; at the foot content's short line and "Sun re o.", then "Light one for yours"
// or the account's own light named with its line. Reached from the lantern canoe on the map (world:lantern-canoe-on-map) and
// from the five taps on Settings' version line (city:credits-screen-attributions), handed in by the shell, and from nowhere else.
//
// "Light one for yours" (account:name-a-light-for-yours) names the unlit light beside the owner's in
// place: two boxes drawn alike with the label inside, and "Light it", which sends `PUT /api/dedication/light`; the
// reply's light shows at once. "Put it out" sends `DELETE`. Offline, or when the read fails, the owner's light, the
// strings bare, no count, and the button closed with its line.
//
// Cheap on a phone: one SVG for the strings, the canoes, the bulbs and the dots; glow layers only for the owner's light,
// the account's own and the named ones, each breathing by opacity alone and still under reduced motion (world.md
// world:motions-under-half-second); the dots are plain circles with no glow and no filter. Never counted, never sent but the light itself.
import type { MyLight, SharedLight } from "@japacity/api";
import { checkLight, DEDICATION_NICKNAME, DEDICATION_SHORT, LIGHT_FIRST_YEAR, LIGHT_NAME_CHARACTERS, type LightAsked, type LightProblem, lightWords, lightYears } from "@japacity/content";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { lightOne, putOutMine, readLights, useWater } from "../../shared/dedication/lights";
import { say, sayCount } from "../../shared/words/text";
import { Bulb, capTop, Glow } from "./bulb";

/** The page's stage in the design's own units, one pixel each and centred; a wider phone shows more of the night. */
export const STAGE = { width: 390, height: 680 } as const;

/** account:dedication-page-and-its-doors: the most lights the page draws on a phone; the count says the true number whatever is drawn. */
export const MOST_DRAWN = 240;

/** A string: a quadratic curve from `a` through the pull of `c` to `b`. */
interface Rope {
  a: readonly [number, number];
  c: readonly [number, number];
  b: readonly [number, number];
}

function rope(a: readonly [number, number], c: readonly [number, number], b: readonly [number, number]): Rope {
  return { a, c, b };
}

function point(line: Rope, t: number): [number, number] {
  const u = 1 - t;
  return [u * u * line.a[0] + 2 * u * t * line.c[0] + t * t * line.b[0], u * u * line.a[1] + 2 * u * t * line.c[1] + t * t * line.b[1]];
}

/** Where the string passes at `x`, found along its curve (it runs left to right). */
export function ropeAt(line: Rope, x: number): number {
  let low = 0;
  let high = 1;
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2;
    if (point(line, middle)[0] < x) low = middle;
    else high = middle;
  }
  return point(line, (low + high) / 2)[1];
}

function pathOf(line: Rope): string {
  const f = (n: number) => String(Math.round(n * 10) / 10);
  return `M${f(line.a[0])} ${f(line.a[1])} Q${f(line.c[0])} ${f(line.c[1])} ${f(line.b[0])} ${f(line.b[1])}`;
}

/** The top string, the owner's: two lights to his left, his, the account's own beside him, two more. */
const TOP = rope([40, 150], [195, 220], [350, 150]);
const HIS_X = 172.9;
const HIS_R = 15;
const OWN_X = 217.1;
const TOP_XS = [84.3, 128.6, 261.4, 305.7] as const;
/** The two strings under it, and the two over the water held by canoes, in the design's places. */
const NEAR: readonly { line: Rope; xs: readonly number[] }[] = [
  { line: rope([-20, 270], [140, 320], [300, 250]), xs: [15.6, 51.1, 86.7, 122.2, 157.8, 193.3, 228.9, 264.4] },
  { line: rope([120, 356], [265, 404], [410, 346]), xs: [152.2, 184.4, 216.7, 248.9, 281.1, 313.3, 345.6, 377.8] },
  { line: rope([40.8, 516], [197.8, 558], [354.8, 512]), xs: [72.2, 103.6, 135, 166.4, 197.8, 229.2, 260.6, 292, 323.4] },
  { line: rope([175.2, 600], [297.6, 613], [420, 590]), xs: [210.2, 245.1, 280.1, 315.1, 350.1, 385] },
];
/** The canoes holding the water's strings up, each with its pole's top where the string is tied. */
const CANOES: readonly { x: number; y: number }[] = [
  { x: 40.8, y: 516 },
  { x: 354.8, y: 512 },
  { x: 175.2, y: 600 },
];
/** Where the water begins, and its few quiet waves: [x, y, width]. */
const HORIZON = 540;
const WAVES: readonly (readonly [number, number, number])[] = [
  [40, 572, 60],
  [236, 586, 80],
  [112, 622, 50],
  [300, 634, 60],
];
/** The far strings, receding into the dark toward the horizon: how many dots each carries, its height and its dots' size. */
const FAR: readonly { y: number; sag: number; dots: number; r: number; light: number }[] = [
  { y: 436, sag: 18, dots: 12, r: 2.6, light: 0.9 },
  { y: 451, sag: 16, dots: 15, r: 2.3, light: 0.85 },
  { y: 464, sag: 14, dots: 18, r: 2.1, light: 0.8 },
  { y: 476, sag: 12, dots: 21, r: 1.9, light: 0.74 },
  { y: 486, sag: 11, dots: 24, r: 1.7, light: 0.68 },
  { y: 495, sag: 10, dots: 27, r: 1.5, light: 0.62 },
  { y: 503, sag: 8, dots: 30, r: 1.35, light: 0.56 },
  { y: 510, sag: 7, dots: 33, r: 1.2, light: 0.5 },
  { y: 516, sag: 6, dots: 36, r: 1.05, light: 0.45 },
];

/** A light's place on the page: a bulb on a near string or a dot on a far one. */
export interface Placed {
  light: SharedLight;
  kind: "bulb" | "dot";
  /** A bulb on the owner's own string, whose name keeps to one row above his. */
  top?: boolean;
  /** A named bulb's row for its name, alternating among the named so neighbours' names keep apart. */
  row?: 0 | 1;
  x: number;
  y: number;
  r: number;
  light01: number;
}

/**
 * The bulbs' places, in the order lights fill them: the two strings under the owner's, where names have room, then the
 * strings over the water, then the owner's own string round his name.
 */
function bulbPlaces(withOwnSlot: boolean): { x: number; y: number; top: boolean }[] {
  const top = (withOwnSlot ? TOP_XS : [TOP_XS[0], TOP_XS[1], OWN_X, TOP_XS[2], TOP_XS[3]]).map((x) => ({ x, y: ropeAt(TOP, x), top: true }));
  return [...NEAR.flatMap(({ line, xs }) => xs.map((x) => ({ x, y: ropeAt(line, x), top: false }))), ...top];
}

/** The far strings' dots, the nearest row first. */
function dotPlaces(): { x: number; y: number; r: number; light01: number }[] {
  return FAR.flatMap((row, index) => {
    const line = rope([-24, row.y - row.sag / 2], [195, row.y + row.sag], [414, row.y - row.sag / 2]);
    const step = 438 / (row.dots + 1);
    // Each row's dots sit half a step along from the row before's, so the field never lines up into columns.
    const shift = index % 2 === 0 ? 0 : step / 2;
    return Array.from({ length: row.dots }, (_, at) => {
      const x = -24 + step * (at + 1) + shift - step / 4;
      return { x, y: ropeAt(line, x) + row.r + 1, r: row.r, light01: row.light };
    });
  });
}

/** How far below the string a bulb of radius `r` hangs: its cap's top is on the string. */
function hangOf(r: number): number {
  return -capTop(0, r);
}

/**
 * account:dedication-page-and-its-doors: where each light is drawn: at most 240, the first ones (the approved, then the newest) as bulbs along
 * the near strings, the rest as dots receding. The account's own light is never among them: it hangs beside the owner's.
 */
export function placeLights(lights: readonly SharedLight[], ownId: string | null, withOwnSlot: boolean): Placed[] {
  const others = lights.filter((light) => light.id !== ownId).slice(0, MOST_DRAWN - (ownId === null ? 0 : 1));
  const bulbs = bulbPlaces(withOwnSlot);
  const dots = dotPlaces();
  const first = others.slice(0, bulbs.length);
  // A named light takes every other place on the strings, a bare one between, so two names are never neighbours and
  // each has room under its bulb; once one kind runs out the other fills what is left.
  const named = first.filter((light) => light.name !== undefined);
  const bare = first.filter((light) => light.name === undefined);
  const placedBulbs: Placed[] = [];
  let n = 0;
  let b = 0;
  for (let slot = 0; slot < first.length; slot += 1) {
    const bulb = bulbs[slot];
    const fromNamed = slot % 2 === 0 ? n < named.length : b >= bare.length;
    const light = fromNamed ? named[n] : bare[b];
    if (bulb === undefined || light === undefined) continue;
    const row: 0 | 1 = fromNamed && n % 2 === 1 ? 1 : 0;
    if (fromNamed) n += 1;
    else b += 1;
    placedBulbs.push({ light, kind: "bulb", top: bulb.top, row, x: bulb.x, y: bulb.y + hangOf(7), r: 7, light01: 1 });
  }
  const placedDots = others.slice(bulbs.length).flatMap((light, index): Placed[] => {
    const dot = dots[index];
    return dot === undefined ? [] : [{ light, kind: "dot", x: dot.x, y: dot.y, r: dot.r, light01: dot.light01 }];
  });
  return [...placedBulbs, ...placedDots];
}

/** Every place a light may be drawn, so the cap of 240 is the page's own and never more than it can show. */
export function placesForLights(withOwnSlot: boolean): number {
  return bulbPlaces(withOwnSlot).length + dotPlaces().length;
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

/** The unlit light beside the maintainer's while it is being named: dark glass, a quiet filament. */
function UnlitBulb({ x, y, r }: { x: number; y: number; r: number }) {
  const f = (n: number) => String(Math.round(n * 100) / 100);
  return (
    <g data-unlit>
      <rect x={f(x - 4.5)} y={f(capTop(y, r))} width="9" height="8" rx="1.6" fill="#3a3a3a" />
      <circle cx={f(x)} cy={f(y)} r={f(r)} fill="#2a3658" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1" />
      <path d={`M${f(x - 0.28 * r)} ${f(y + 0.22 * r)}q${f(0.28 * r)} ${f(-0.6 * r)} ${f(0.56 * r)} 0`} fill="none" stroke="#4a5578" strokeWidth="1.3" strokeLinecap="round" />
    </g>
  );
}

/** A canoe on the water with the pole its string is tied to (the design's drawing, dark at night). */
function Canoe({ x, y }: { x: number; y: number }) {
  const f = (n: number) => String(Math.round(n * 10) / 10);
  // The pole stands from the canoe's middle up to the string's end; the canoe floats 48 under it.
  return (
    <g transform={`translate(${f(x - 30.8)} ${f(y + 44)}) scale(1.1)`}>
      <rect x="27" y="-40" width="2" height="56" fill="#1a1008" />
      <path d="M4 18 C 10 30, 46 30, 52 18 L 48 14 C 40 20, 16 20, 8 14 Z" fill="#2a1a0c" stroke="#120a04" strokeWidth="1.2" />
      <path d="M8 14 C 16 20, 40 20, 48 14" fill="none" stroke="#4a3418" strokeWidth="1.2" />
    </g>
  );
}

/** The night over the lagoon: the strings, the canoes, the bulbs and the dots, one still picture. */
function Strings({ placed, own, naming }: { placed: readonly Placed[]; own: boolean; naming: boolean }) {
  const hisY = ropeAt(TOP, HIS_X) + hangOf(HIS_R);
  const ownY = ropeAt(TOP, OWN_X) + hangOf(7);
  const strokes = { fill: "none", stroke: "#d8d0bc", strokeOpacity: 0.55, strokeWidth: 1.2 } as const;
  return (
    <svg className="pointer-events-none absolute inset-0 overflow-visible" width={STAGE.width} height={STAGE.height} viewBox={`0 0 ${String(STAGE.width)} ${String(STAGE.height)}`} aria-hidden data-dedication-strings>
      {WAVES.map(([x, y, w]) => (
        <rect key={`${String(x)}-${String(y)}`} x={x} y={y} width={w} height="2" rx="1" fill="#ffffff" fillOpacity="0.12" />
      ))}
      {FAR.map((row) => (
        <path key={row.y} d={pathOf(rope([-24, row.y - row.sag / 2], [195, row.y + row.sag], [414, row.y - row.sag / 2]))} fill="none" stroke="#d8d0bc" strokeOpacity={0.12 + row.light * 0.18} strokeWidth="0.7" />
      ))}
      <path d={pathOf(TOP)} {...strokes} />
      {NEAR.map(({ line }) => (
        <path key={line.a.join()} d={pathOf(line)} {...strokes} />
      ))}
      {CANOES.map((canoe) => (
        <Canoe key={canoe.x} x={canoe.x} y={canoe.y} />
      ))}
      {placed.map((one) =>
        one.kind === "dot" ? (
          <circle key={one.light.id} cx={one.x.toFixed(1)} cy={one.y.toFixed(1)} r={one.r} fill="#fff1c9" fillOpacity={one.light01} data-dot />
        ) : (
          <g key={one.light.id} data-bulb={one.light.name === undefined ? "bare" : "named"}>
            <Bulb x={one.x} y={one.y} r={one.r} />
          </g>
        ),
      )}
      <Bulb x={HIS_X} y={hisY} r={HIS_R} />
      {own ? <Bulb x={OWN_X} y={ownY} r={7} /> : naming ? <UnlitBulb x={OWN_X} y={ownY} r={11} /> : null}
    </svg>
  );
}

/** The name under a named light, as the design sets them: small, quiet, every other named one a little lower so neighbours keep apart. */
function NameUnder({ one }: { one: Placed }) {
  if (one.kind !== "bulb" || one.light.name === undefined) return null;
  const years = one.light.years === undefined ? null : lightYears(one.light.years, say("ui.dedication.between"));
  return (
    <p
      className="absolute max-w-[76px] -translate-x-1/2 truncate text-center text-[11.5px] leading-tight text-text/75"
      style={{ left: one.x, top: one.y + one.r + 6 + (one.top === true || one.row !== 1 ? 0 : 15) }}
      title={years === null ? one.light.name : `${one.light.name}, ${years}`}
      data-light-name
    >
      {one.light.name}
    </p>
  );
}

const EMPTY: LightAsked = { name: "", from: "", to: "" };

/** The device's year: a light's years run up to it. */
function thisYear(): number {
  return new Date().getFullYear();
}

/** One box with its label inside, above its value: drawn alike, no fieldset or legend. */
const BOX = "flex flex-col gap-[3px] rounded-[12px] border-[1.5px] border-[#3b4c77] bg-[#24345a] px-4 py-2.5";
const BOX_LABEL = "text-[13px] text-[#c8c3b4]";
const FIELD = "bg-transparent text-[18px] font-semibold text-text outline-hidden placeholder:font-medium placeholder:text-[#8e97ab]";

/** account:name-a-light-for-yours: naming the unlit light in place: who it is for, the years if wanted, and Light it. */
function NameIt({ year, onLit }: { year: number; onLit: (mine: MyLight) => void }) {
  const [asked, setAsked] = useState<LightAsked>(EMPTY);
  const [sending, setSending] = useState(false);
  const [refused, setRefused] = useState<{ problems: LightProblem[] } | "out" | null>(null);
  const checked = checkLight(asked, year);
  const name = useRef<HTMLInputElement>(null);
  useEffect(() => {
    name.current?.focus({ preventScroll: true });
    name.current?.scrollIntoView?.({ block: "nearest" });
  }, []);
  // A field says what is wrong only once something is in it; an empty name simply keeps Light it from working.
  const problems = checked.ok ? (refused !== null && refused !== "out" ? refused.problems : []) : checked.problems.filter((problem) => problem !== "name-empty");
  const light = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!checked.ok || sending) return;
    setSending(true);
    const reply = await lightOne(checked.light);
    setSending(false);
    if (reply.ok) onLit(reply.mine);
    else setRefused("out" in reply ? "out" : { problems: reply.problems });
  };
  return (
    <form className="flex w-full flex-col gap-2.5 text-left" onSubmit={(event) => void light(event)} noValidate data-name-it>
      <label className={BOX}>
        <span className={BOX_LABEL}>{say("ui.dedication.name")}</span>
        <input
          ref={name}
          className={`${FIELD} w-full`}
          type="text"
          value={asked.name}
          maxLength={LIGHT_NAME_CHARACTERS}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
          onChange={(event) => {
            setRefused(null);
            setAsked({ ...asked, name: event.target.value });
          }}
          data-light-name-field
        />
      </label>
      <div className={BOX} role="group" aria-labelledby="dedication-years">
        <span id="dedication-years" className={BOX_LABEL}>
          {say("ui.dedication.years")}
        </span>
        <div className="flex items-center gap-2.5">
          <input className={`${FIELD} w-[4.6ch] tabular-nums`} type="text" inputMode="numeric" maxLength={4} placeholder="1951" value={asked.from} aria-label={say("ui.dedication.from")} onChange={(event) => setAsked({ ...asked, from: event.target.value })} data-light-from />
          <span className="text-[18px] font-medium text-[#8e97ab]" aria-hidden>
            {say("ui.dedication.between")}
          </span>
          <input className={`${FIELD} w-[4.6ch] tabular-nums`} type="text" inputMode="numeric" maxLength={4} placeholder="2024" value={asked.to} aria-label={say("ui.dedication.to")} onChange={(event) => setAsked({ ...asked, to: event.target.value })} data-light-to />
        </div>
      </div>
      <div aria-live="polite" className="flex flex-col gap-1" data-light-problems>
        {problems.map((problem) => (
          <p key={problem} className="text-[14px] font-semibold text-signal" data-light-problem={problem}>
            {say(`ui.dedication.problem.${problem}`, { first: String(LIGHT_FIRST_YEAR), year: String(year) })}
          </p>
        ))}
        {refused === "out" ? (
          <p className="text-[14px] font-semibold text-signal" data-light-out>
            {say("ui.dedication.out")}
          </p>
        ) : null}
      </div>
      <p className="text-center text-[13px] text-text-2">{say("ui.dedication.hint")}</p>
      <button type="submit" className="btn-main justify-center" disabled={!checked.ok || sending} data-light-it>
        {say("ui.dedication.light-it")}
      </button>
    </form>
  );
}

/** The account's own light beside the maintainer's: its name and years under it, for this account alone. */
function OwnName({ mine }: { mine: MyLight }) {
  const years = lightYears(mine.years, say("ui.dedication.between"));
  const top = ropeAt(TOP, OWN_X) + hangOf(7) + 7 + 8;
  return (
    <p className="absolute max-w-[160px] text-left leading-snug" style={{ left: OWN_X - 6, top }} aria-label={lightWords({ name: mine.name, from: mine.years.from, to: mine.years.to }, say("ui.dedication.between"))} data-own-light>
      <span className="block text-[13px] font-semibold break-words text-[#ffe9a8]">{mine.name}</span>
      {years === null ? null : <span className="block text-[12px] text-text-2 tabular-nums">{years}</span>}
    </p>
  );
}

export interface DedicationProps {
  open: boolean;
  onClose: () => void;
  /** A seam for tests: the current year the years run up to; the device's own when left out. */
  year?: number;
}

/** account:dedication-page-and-its-doors: the page, over everything, the night at any hour. */
export function Dedication({ open, onClose, year }: DedicationProps) {
  const water = useWater();
  const [naming, setNaming] = useState(false);
  useEffect(() => {
    if (!open) return;
    setNaming(false);
    void readLights();
  }, [open]);
  const read = water.kind === "read" ? water : null;
  const mine = read?.mine ?? null;
  const out = water.kind === "out";
  // The strings stay bare until the water answers, and bare when it is out of reach.
  const placed = read === null ? [] : placeLights(read.lights, mine?.id ?? null, mine !== null || naming);
  const hisY = ropeAt(TOP, HIS_X) + hangOf(HIS_R);
  const ownY = ropeAt(TOP, OWN_X) + hangOf(7);
  const named = placed.filter((one) => one.kind === "bulb" && one.light.name !== undefined);
  return (
    <Dialog.Root open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <Dialog.Portal>
        <Dialog.Popup
          aria-label={say("ui.dedication.page")}
          data-paint="night"
          className="motion-scrim data-ending-style:pointer-events-none data-closed:pointer-events-none fixed inset-0 z-[80] overflow-x-hidden overflow-y-auto bg-[#111d38] pb-[max(28px,env(safe-area-inset-bottom))] text-text outline-hidden"
          data-dedication-page
          data-water={water.kind}
        >
          {/* The count stands still at the head on the sky's own colour, as the close does, so filling the form (the page
              scrolled up over the keyboard) never takes them out of view. At rest the head is
              the sky over the strings; scrolled, the strings pass under it. */}
          {read === null ? null : (
            // The head ends above the first string's ends (about 111 px down), so at rest it hides none of it.
            <div className="pointer-events-none fixed inset-x-0 top-0 z-[2] h-[104px] bg-[#172647]" data-dedication-head>
              <div className="absolute inset-x-0 top-[48px] text-center" data-dedication-count>
                <p className="text-[26px] leading-tight font-bold">{sayCount("ui.dedication.count", read.count, { count: read.count })}</p>
                <p className="text-[14px] text-text-2">{say("ui.dedication.tonight")}</p>
              </div>
            </div>
          )}
          <div className="relative left-1/2 -translate-x-1/2" style={{ width: STAGE.width, height: STAGE.height }}>
            {/* The sky over the water, under the glows; the water is the page's own ground, on under the foot. */}
            <div className="absolute bg-[#172647]" style={{ left: -400, right: -400, top: -400, height: HORIZON + 400 }} aria-hidden />
            <Glow x={HIS_X} y={hisY} radius={58} alpha={0.75} name="his" />
            {mine === null ? null : <Glow x={OWN_X} y={ownY} radius={34} alpha={0.7} offsetMs={2_000} name="own" />}
            {named.map((one, index) => (
              <Glow key={one.light.id} x={one.x} y={one.y} radius={24} alpha={0.55} offsetMs={(index * 700) % 4_000} name="named" />
            ))}
            <Strings placed={placed} own={mine !== null} naming={naming} />
            {/* The big light carries its name under it, exactly as the owner wrote it (account:dedication-page-and-its-doors, city:credits-screen-attributions). */}
            <p className="absolute -translate-x-1/2 text-[14px] font-semibold tracking-wide" style={{ left: HIS_X, top: hisY + HIS_R + 10 }} data-dedication-name>
              {DEDICATION_NICKNAME}
            </p>
            {mine === null ? null : <OwnName mine={mine} />}
            {mine === null && naming ? (
              <p className="absolute -translate-x-1/2 text-[13px] text-text-2" style={{ left: OWN_X, top: ownY + 11 + 8 }} data-unlit-name>
                {say("ui.dedication.yours")}
              </p>
            ) : null}
            {named.map((one) => (
              <NameUnder key={one.light.id} one={one} />
            ))}
          </div>
          <div className="relative z-[1] mx-auto flex max-w-[390px] flex-col items-center gap-0.5 px-5 text-center">
            <p className="text-[13px] leading-normal font-medium text-balance" data-dedication-short>
              {DEDICATION_SHORT}
            </p>
            <p className="text-[14px] text-text-2" data-dedication-rest>
              {say("ui.dedication.rest")}
            </p>
            <div className="mt-3.5 flex w-full flex-col items-center gap-3">
              {mine !== null ? (
                <>
                  <p className="text-[13px] leading-snug text-text-2" data-dedication-mine>
                    {say("ui.dedication.mine")}
                  </p>
                  <button
                    type="button"
                    className="min-h-11 rounded-full bg-[#24345a] px-6 text-[15px] font-semibold"
                    onClick={() => {
                      void putOutMine();
                    }}
                    data-put-out
                  >
                    {say("ui.dedication.put-out")}
                  </button>
                </>
              ) : naming && read !== null ? (
                <NameIt year={year ?? thisYear()} onLit={() => setNaming(false)} />
              ) : (
                <>
                  <button
                    type="button"
                    className="pill-button"
                    style={{ background: "var(--on-strong)", color: "var(--strong)", borderColor: "var(--on-strong)", boxShadow: "none" }}
                    disabled={read === null}
                    onClick={() => setNaming(true)}
                    data-light-one
                  >
                    <BulbMark />
                    {say("ui.dedication.light-one")}
                  </button>
                  {out ? (
                    <p className="text-[13px] text-text-2" data-dedication-out>
                      {say("ui.dedication.out")}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>
          <Dialog.Close
            aria-label={say("ui.dedication.close")}
            className="fixed top-[max(14px,env(safe-area-inset-top))] right-[14px] z-[3] inline-flex size-11 items-center justify-center rounded-md opacity-80 focus-visible:outline-2 focus-visible:outline-text"
            data-dedication-close
          >
            <X size={22} aria-hidden />
          </Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
