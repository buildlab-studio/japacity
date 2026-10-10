// The front door (prologue.md R-PROLOGUE-009, 013): three screens over the family compound with everything already
// chosen, so Next, Next, Begin starts a life. You (the name filled from the pool for the look's sex, a dice for
// another, the look strip), Your life so far (the tiles, the first chosen, with the age under them at the tile's
// own) and Your page (the travel data page with it all printed). Skip on the first two goes to the page; Shuffle
// picks a look, a name and a tile at random. The ready lives are not on the door: a run Settings asks for lists them
// on the second screen in the place of the tiles.
// The run is kept as it goes, so a reload at any step comes back to that step; nothing of the life is written
// before Begin. For a tile, Begin starts the life at once and the page fills as the years go by (R-PROLOGUE-014).
// Online and signed out, the gate hands in the guest start (account.md R-ACCOUNT-029): the page holds the username,
// filled in from the name and changed there, and the guest line; Begin makes the guest life before the character.
import { content } from "@japacity/content";
import { type Id, int } from "@japacity/sim";
import { ArrowLeft, ArrowRight, BedSingle, ChevronLeft, ChevronRight, Dices, House, Lock, Shuffle, Waves } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { useGame } from "../../authority/GameProvider";
import { keepPerson } from "../../authority/person";
import { formatMoney } from "../../shared/words/format";
import { blurbOf, say } from "../../shared/words/text";
import { type Archetype, ARCHETYPES, archetypeOf, FROM_SIXTEEN, type Home, homeOf, homesFor, savingsOf } from "../../shared/frontdoor/archetypes";
import { Gate, GateSheet, gateLook } from "../../shared/frontdoor/Gate";
import { LOOKS, lookOf, namesFor } from "../../shared/frontdoor/looks";
import { OwnColoursRows } from "../../shared/frontdoor/OwnColours";
import { isMade } from "../../shared/frontdoor/style";
import { takeReadyAsk } from "../../shared/frontdoor/ready";
import { DataPage, type PageFields, Stamp } from "../../shared/datapage/DataPage";
import { madePhoto } from "../../shared/datapage/photo";
import { type DoorDraft, type DoorStage, keepDoor, readDoor } from "../../shared/datapage/door";
import { NAME_LONGEST, nameProblem, problemWords } from "../../shared/datapage/name";
import { ageStepWords, startYearFor, stepsOpen, yearsWorked } from "../../shared/datapage/age";
import { readyMonths, yearsOf } from "../../shared/datapage/years";

/** The ready lives: every scenario but the life from sixteen, each named by its kind, never its person. */
const READY = (Object.keys(content.scenario) as Id<"scenario">[]).filter((id) => content.scenario[id]?.prologue !== true);
/** The three screens, for the progress marks over the scene. */
const SCREENS: readonly DoorStage[] = ["you", "life", "page"];
/** How long the stamp sits on a ready life's page before the life starts. */
export const STAMP_MS = 900;

function freshRoll(): number {
  return Math.floor(Math.random() * 100000);
}

function pick<T>(list: readonly T[]): T | undefined {
  return list[Math.floor(Math.random() * list.length)];
}

/** The first name the pool gives for a look on a roll. */
function filledName(look: string, roll: number): string {
  return namesFor(lookOf(look)?.sex ?? "f", roll)[0] ?? "";
}

/** A run with everything chosen: the kept look, a name for it, the first tile at its own age and in its own home. */
function freshDraft(look: string): DoorDraft {
  const roll = freshRoll();
  const first = ARCHETYPES[0];
  return { stage: "you", look, archetype: first?.id ?? null, ready: null, name: filledName(look, roll), typed: false, roll, age: 0, ...(first === undefined ? {} : { home: homeOf(first) }) };
}

/**
 * What a home takes and charges, from the home step's own answer in content (R-PROLOGUE-013): `now`, what moving in
 * takes at once (the room's year and fees); `monthly`, its living costs a month; `rentYear`, a year's rent paid upfront.
 */
export function homeFigures(home: Home): { now: number; monthly: number; rentYear: number | null } {
  const effects = content.prologue["home"]?.answers.find((answer) => answer.id === home)?.effects ?? [];
  let now = 0;
  let monthly = 0;
  let rentYear: number | null = null;
  for (const effect of effects) {
    if (effect.type === "money/take" && effect.currency === "NGN" && typeof effect.amount === "number") now += effect.amount;
    if (effect.type !== "obligation/open" || typeof effect.amount !== "number") continue;
    const type = content.obligation[effect.obligation]?.type;
    if (type === "upkeep") monthly = effect.amount;
    if (type === "rent") rentYear = effect.amount;
  }
  return { now, monthly, rentYear };
}

/**
 * The naira in kobo left after moving in (R-PROLOGUE-013): the tile's savings and what its age step saves, less what
 * moving in takes and the first month's living. Below nothing, the shortfall, or for the room the figure still needed.
 */
export function pocketIn(archetype: Archetype, years: number, home: Home): number {
  const saved = yearsWorked(years).saved;
  const { now, monthly } = homeFigures(home);
  return savingsOf(archetype) + saved - now - monthly;
}

/** The home kept when the tile or the age changes: the one the player picked while the life can still move in, else the tile's own, else the first it can pay for. */
export function fitHome(archetype: Archetype, years: number, draft: Pick<DoorDraft, "home" | "homePicked">): Home {
  const offered = homesFor(archetype);
  const picked = draft.homePicked === true ? offered.filter((one) => one === draft.home) : [];
  const own = homeOf(archetype);
  return [...picked, own, ...offered].find((one) => pocketIn(archetype, years, one) >= 0) ?? own;
}

/** The self-contain the door shows as a goal (R-PROLOGUE-013): its year's rent with the same fees as the room's. */
export function selfContainYear(): number {
  const { selfContainRentYear, compound } = content.tuning.home;
  return selfContainRentYear + int.bp(selfContainRentYear, compound.feesBp);
}

const HOME_ICONS = { "family-house": House, "compound-room": BedSingle, makoko: Waves } as const;

/** The run as kept, or a new one with the kept look; a run already begun starts again. Settings' ask starts a run for the ready lives. */
function startDraft(): DoorDraft {
  const kept = readDoor();
  if (takeReadyAsk()) return { ...freshDraft(gateLook(kept?.look)), asked: true };
  return kept !== null && kept.stage !== "begun" ? { ...kept, look: gateLook(kept.look) } : freshDraft(gateLook(kept?.look));
}

/** The screen before, for the back button. */
function before(draft: DoorDraft): DoorStage | null {
  switch (draft.stage) {
    case "you":
    case "begun":
      return null;
    case "life":
    case "ready":
      return "you";
    case "page":
      return draft.ready === null ? "life" : "ready";
    default: {
      const never: never = draft.stage;
      throw new Error(`Unknown door stage ${String(never)}.`);
    }
  }
}

/** What the page prints for the run so far. */
function fieldsOf(draft: DoorDraft): PageFields {
  const archetype = draft.ready === null ? archetypeOf(draft.archetype) : null;
  const ready = READY.find((id) => id === draft.ready) ?? null;
  // The year picked is the year the life starts at (R-PROLOGUE-004, decision 0023): a true number, never "about".
  const years = archetype !== null ? startYearFor(archetype, Math.max(0, draft.age)) : ready !== null ? yearsOf(readyMonths(ready)) : null;
  return {
    name: draft.name.trim(),
    age: years === null ? "" : say("prologue.page.age.years", { years }),
    path: archetype !== null ? say(`prologue.archetype.${archetype.id}.name`) : ready !== null ? say(`${ready}.kind`) : "",
    ready: say("prologue.page.ready.figure", { percent: 0 }),
    photo: lookOf(draft.look)?.picture ?? "",
    wear: { look: draft.look, ...(draft.style === undefined ? {} : { style: draft.style }) },
  };
}

/** Over the scene: the way back, how far through the three screens the run is, and the two ways to go faster. */
function Progress({ draft, onBack, onShuffle, onSkip }: { draft: DoorDraft; onBack: (() => void) | null; onShuffle: (() => void) | null; onSkip: (() => void) | null }) {
  const at = Math.max(0, SCREENS.indexOf(draft.stage === "ready" ? "life" : draft.stage === "begun" ? "page" : draft.stage));
  return (
    <div className="pointer-events-auto flex h-10 items-center gap-2" data-door-progress>
      {onBack === null ? (
        <span className="size-9 shrink-0" />
      ) : (
        <button type="button" aria-label={say("ui.door.back")} className="press band flex size-9 shrink-0 items-center justify-center rounded-[6px]" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
      )}
      <div className="flex flex-1 justify-center gap-1.5" aria-hidden>
        {SCREENS.map((screen, index) => (
          <span key={screen} className={`h-1.5 w-7 rounded-[2px] ${index <= at ? "bg-action" : "bg-strong opacity-40"}`} />
        ))}
      </div>
      <span className="sr-only">{say("prologue.door.step", { n: at + 1, count: SCREENS.length })}</span>
      {onShuffle === null || onSkip === null ? (
        <span className="w-[136px] shrink-0" />
      ) : (
        <div className="flex shrink-0 gap-1.5">
          <button type="button" className="press band flex h-9 items-center gap-1 rounded-[6px] px-2.5 text-[13px] font-bold" aria-label={say("ui.door.shuffle.all")} onClick={onShuffle} data-door-shuffle>
            <Shuffle size={16} aria-hidden />
            {say("ui.door.shuffle")}
          </button>
          <button type="button" className="press band flex h-9 items-center rounded-[6px] px-3 text-[13px] font-bold" onClick={onSkip} data-door-skip>
            {say("ui.door.skip")}
          </button>
        </div>
      )}
    </div>
  );
}

function NextButton({ onClick, then }: { onClick: () => void; then: string }) {
  return (
    <button type="button" className="btn-main" onClick={onClick}>
      <span>{say("ui.door.next")}</span>
      <span className="flex items-center gap-1 text-[13px] font-semibold opacity-80">
        {then} <ArrowRight size={16} />
      </span>
    </button>
  );
}

/** The guest start the gate hands in online (account.md R-ACCOUNT-021, 024, 029); the account feature's GuestDoor. */
export interface DoorGuest {
  fill: (name: string) => string;
  check: (username: string) => string | null;
  fields: (value: string, onChange: (username: string) => void, problem: string | null) => ReactNode;
  /** Null once the guest life is made; otherwise what to say by the username. */
  start: (username: string, filled: boolean) => Promise<string | null>;
  started: () => Promise<void>;
}

export function ScenarioView({ guest = null }: { guest?: DoorGuest | null }) {
  const notice = useGame((state) => state.notice);
  const chooseLife = useGame((state) => state.chooseLife);
  // The life chooser cannot be opened again where a life is started only once (R-ACCOUNT-015).
  const once = useGame((state) => state.openLifeChooser === null);
  // Opened from Settings over a life: the ready lives' back returns to it.
  const backToLife = useGame((state) => (state.view === null ? null : state.closeLifeChooser));
  // The run as it opens is kept at once, so a reload keeps the name it filled.
  const [draft, setDraft] = useState<DoorDraft>(() => {
    const opened = startDraft();
    keepDoor(opened);
    return opened;
  });
  const [tried, setTried] = useState(false);
  const [stamped, setStamped] = useState(false);
  // The username as typed on the page; null while the name fills it in.
  const [typedUsername, setTypedUsername] = useState<string | null>(null);
  const [usernameSaid, setUsernameSaid] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  // Kept as it changes, outside the state's updater, so the step is on the device even when the door closes at once.
  const change = (part: Partial<DoorDraft>): void => {
    const next = { ...draft, ...part };
    keepDoor(next);
    setDraft(next);
  };
  const problem = nameProblem(draft.name);
  const username = typedUsername ?? guest?.fill(draft.name.trim()) ?? "";
  // Every way on checks the name first: a name that fails sends the run back to it, saying why.
  const go = (stage: DoorStage): void => {
    setTried(true);
    if (problem !== null && stage !== "you") change({ stage: "you" });
    else change({ stage });
  };
  const back = before(draft);

  const archetype = draft.ready === null ? archetypeOf(draft.archetype) : null;
  const lowest = archetype === null ? null : startYearFor(archetype, 0);
  const home: Home | null = archetype === null ? null : fitHome(archetype, draft.age, { home: draft.home ?? homeOf(archetype), homePicked: true });
  const open = archetype === null ? [0] : stepsOpen(archetype);
  // Years older than the tile's own, kept inside the steps open (a run kept from before may hold a younger step).
  const older = Math.min(Math.max(0, draft.age), Math.max(...open));
  const step = (by: number): void => {
    const next = older + by;
    if (open.includes(next)) change({ age: next, ...(archetype === null ? {} : { home: fitHome(archetype, next, draft) }) });
  };

  // A new look keeps a typed name; a filled one follows the look's sex.
  const chooseLook = (look: string): void => {
    const sameSex = lookOf(look)?.sex === lookOf(draft.look)?.sex;
    change({ look, ...(draft.typed === true || sameSex ? {} : { name: filledName(look, draft.roll) }) });
  };
  const reroll = (): void => {
    const roll = draft.roll + 1;
    change({ roll, name: filledName(draft.look, roll), typed: false });
  };
  const shuffle = (): void => {
    const look = pick(LOOKS)?.id ?? draft.look;
    const roll = freshRoll();
    setTried(false);
    const tile = pick(ARCHETYPES) ?? archetype;
    change({ look, roll, name: filledName(look, roll), typed: false, archetype: tile?.id ?? draft.archetype, ready: null, age: 0, homePicked: false, ...(tile === null ? {} : { home: homeOf(tile) }) });
  };

  const begin = (): void => {
    if (stamped) return;
    setTried(true);
    if (problem !== null) {
      change({ stage: "you" });
      return;
    }
    const ready = draft.ready === null ? null : (READY.find((id) => id === draft.ready) ?? null);
    const start = (): void => {
      // The player's own colours, and the photo drawn in them as the page printed, are kept with the person (R-PROLOGUE-015).
      const style = isMade(draft.style) ? undefined : draft.style;
      const photo = style === undefined ? undefined : madePhoto(draft.look, style);
      keepPerson({ look: draft.look, name: draft.name.trim(), archetype: ready === null ? draft.archetype : null, ...(style === undefined ? {} : { style }), ...(photo === undefined ? {} : { photo }) });
      change({ stage: "begun", ...(home === null ? {} : { home }) });
      void chooseLife(ready ?? FROM_SIXTEEN)
        .then(() => guest?.started())
        .catch(() => setStamped(false));
    };
    // A ready life is stamped here; a tile's page is stamped once its years are filled in (R-PROLOGUE-014).
    const stamp = (): void => {
      if (ready === null) start();
      else timer.current = window.setTimeout(start, STAMP_MS);
    };
    if (guest === null) {
      setStamped(true);
      stamp();
      return;
    }
    const typed = guest.check(username);
    setUsernameSaid(typed);
    if (typed !== null) return;
    setStamped(true);
    // R-ACCOUNT-021: the guest life first; the character is the account's one (R-ACCOUNT-015).
    void guest.start(username, typedUsername === null).then((said) => {
      setUsernameSaid(said);
      if (said === null) stamp();
      else setStamped(false);
    });
  };

  const asked = draft.asked === true;
  const faster = !asked && (draft.stage === "you" || draft.stage === "life");
  // A run Settings opened over a life goes back to that life from its first screen.
  const leave =
    backToLife === null
      ? null
      : () => {
          keepDoor({ ...draft, asked: false });
          backToLife();
        };
  const onBack = stamped ? null : back !== null ? () => change({ stage: back }) : asked && draft.stage === "you" ? leave : null;
  const over = (
    <>
      <Progress draft={draft} onBack={onBack} onShuffle={faster ? shuffle : null} onSkip={faster ? () => go("page") : null} />
      {/* The hook from the first second (the review): the question over the figure, before the look. */}
      {draft.stage === "you" ? (
        <p className="band title mx-auto mt-3 rounded-[6px] px-4 py-2 text-center text-[26px] leading-tight shadow-[0_8px_20px_rgba(10,14,30,0.3)]" data-door-hook>
          {say("prologue.door.hook")}
        </p>
      ) : null}
      {draft.stage === "page" || draft.stage === "begun" ? (
        <div className="pointer-events-auto mx-auto mt-2 w-full max-w-[420px]">
          <DataPage page={fieldsOf(draft)} print stamp={stamped && draft.ready !== null ? <Stamp words={say("prologue.page.stamp.ready")} turn={-12} big /> : null} />
        </div>
      ) : null}
    </>
  );

  return (
    <Gate look={draft.look} style={draft.style} mark={draft.stage} over={over}>
      {draft.stage === "you" ? (
        <GateSheet key="you" mark="you" label={say("ui.life.title")} foot={<NextButton onClick={() => go(asked ? "ready" : "life")} then={say(asked ? "ui.door.ready.title" : "ui.door.next.then")} />}>
          <h1 className="title text-[22px] leading-tight">{say("ui.life.title")}</h1>
          {/* What the game is about, in one line under the question (R-TEXT-006). */}
          <p className="mt-0.5 text-[13px] leading-snug text-text-2">{say("ui.life.intro")}</p>
          {notice === null ? null : (
            <p role="status" className="mt-3 rounded-[5px] border-l-4 border-l-action bg-sheet-muted p-3 text-[14px]">
              {say(notice)}
            </p>
          )}
          <label className="label mt-3 block text-text-2" htmlFor="door-name">
            {say("prologue.door.name.title")}
          </label>
          <div className="mt-1.5 flex gap-1.5">
            <input
              id="door-name"
              className="h-12 min-w-0 flex-1 rounded-[6px] border-2 border-sheet-line bg-sheet-muted px-3 text-[17px] font-bold text-text outline-none focus:border-action"
              placeholder={say("prologue.door.name.placeholder")}
              value={draft.name}
              maxLength={NAME_LONGEST + 4}
              autoComplete="off"
              autoCapitalize="words"
              spellCheck={false}
              aria-invalid={tried && problem !== null}
              onChange={(event) => change({ name: event.target.value, typed: true })}
              onKeyDown={(event) => {
                if (event.key === "Enter") go(asked ? "ready" : "life");
              }}
            />
            <button type="button" className="press flex size-12 shrink-0 items-center justify-center rounded-[6px] bg-strong text-on-strong" aria-label={say("ui.door.reroll")} onClick={reroll} data-door-dice>
              <Dices size={22} />
            </button>
          </div>
          {tried && problem !== null ? (
            <p role="alert" className="mt-1.5 text-[13px] font-bold text-text">
              {problemWords(problem)}
            </p>
          ) : (
            <p className="mt-1 text-[12px] text-text-2">{say("ui.door.name.hint")}</p>
          )}
          <h2 className="label mt-3 text-text-2">{say("ui.door.look")}</h2>
          <div className="-mx-4 mt-2 grid auto-cols-[44px] grid-flow-col grid-rows-2 gap-1.5 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label={say("ui.door.look")} data-looks>
            {LOOKS.map((one, index) => {
              const on = one.id === draft.look;
              return (
                <button
                  key={one.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={say("ui.door.look.one", { n: index + 1 })}
                  data-look={one.id}
                  onClick={() => chooseLook(one.id)}
                  className={`press flex h-[64px] items-end justify-center overflow-hidden rounded-[5px] ${on ? "bg-strong outline-2 outline-offset-1 outline-action" : "bg-sheet-muted"}`}
                >
                  {one.picture === "" ? null : <img src={one.picture} alt="" className="h-[60px] w-auto" draggable={false} />}
                </button>
              );
            })}
          </div>
          <p className="label mt-2 text-center text-[10px] text-text-2">{say("prologue.door.drag")}</p>
          {/* Your own colours on the look (R-PROLOGUE-015), under the strip. */}
          <OwnColoursRows look={draft.look} style={draft.style} onStyle={(style) => change({ style: isMade(style) ? undefined : style })} />
        </GateSheet>
      ) : draft.stage === "life" ? (
        <GateSheet key="life" mark="life" label={say("ui.door.life")} foot={<NextButton onClick={() => go("page")} then={say("ui.door.next.page")} />}>
          <h1 className="title text-[22px] leading-tight">{say("ui.door.life")}</h1>
          <p className="truncate text-[13px] text-text-2">{say("ui.door.path.hint")}</p>
          {once ? (
            <p className="mt-1.5 text-[12px] leading-snug text-text-2" data-door-once>
              {say("prologue.archetype.once")}
            </p>
          ) : null}
          <ul className="mt-2.5 grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={say("ui.door.life")} data-archetypes>
            {ARCHETYPES.map((tile) => {
              const on = draft.archetype === tile.id && draft.ready === null;
              return (
                <li key={tile.id}>
                  <button
                    type="button"
                    role="radio"
                    data-archetype={tile.id}
                    aria-label={say(`prologue.archetype.${tile.id}.name`)}
                    aria-checked={on}
                    onClick={() => change({ archetype: tile.id, ready: null, age: 0, home: fitHome(tile, 0, draft) })}
                    className={`press flex h-full w-full flex-col items-start rounded-[5px] p-2.5 text-left ${on ? "bg-strong text-on-strong" : "bg-sheet-muted"}`}
                  >
                    <span className={`rounded-[3px] px-1.5 py-0.5 text-[10px] font-extrabold tracking-[0.08em] uppercase ${on ? "bg-action text-action-text" : "bg-sheet text-text-2"}`} data-tile-tag>
                      {say(`ui.door.tag.${tile.id}`)}
                    </span>
                    <span className="mt-1 text-[15px] leading-tight font-extrabold">{say(`prologue.archetype.${tile.id}.name`)}</span>
                    <span className={`mt-1 text-[12px] leading-snug ${on ? "" : "text-text-2"}`}>{say(`prologue.archetype.${tile.id}.was`)}</span>
                    <span className="mt-1.5 text-[12px] leading-snug font-bold">{say(`prologue.archetype.${tile.id}.opens`)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {lowest === null ? null : (
            <section className="mt-3" aria-label={say("prologue.door.age")} data-door-age>
              <h2 className="label text-text-2">{say("prologue.door.age")}</h2>
              <div className="mt-1.5 flex items-center justify-between rounded-[6px] bg-sheet-muted p-1" data-age-steps>
                <button type="button" className="press flex size-11 items-center justify-center rounded-[5px] bg-sheet disabled:opacity-40" aria-label={say("prologue.door.age.younger")} disabled={!open.includes(older - 1)} onClick={() => step(-1)}>
                  <ChevronLeft size={20} />
                </button>
                <p className="title num text-[22px]" data-age-years>
                  {say("prologue.door.age.years", { years: lowest + older })}
                </p>
                <button type="button" className="press flex size-11 items-center justify-center rounded-[5px] bg-sheet disabled:opacity-40" aria-label={say("prologue.door.age.older")} disabled={!open.includes(older + 1)} onClick={() => step(1)}>
                  <ChevronRight size={20} />
                </button>
              </div>
              <p className="mt-1.5 text-center text-[13px] font-bold" data-age-does>
                {ageStepWords(older, lowest)}
              </p>
            </section>
          )}
          {archetype === null || home === null ? null : (
            <section className="mt-3" aria-label={say("ui.door.home")} data-door-home>
              <h2 className="label text-text-2">{say("ui.door.home")}</h2>
              <div className="mt-1.5 flex flex-col gap-1.5" role="radiogroup" aria-label={say("ui.door.home")}>
                {homesFor(archetype).map((one) => {
                  const on = one === home;
                  const pocket = pocketIn(archetype, draft.age, one);
                  const short = pocket < 0;
                  // The room shut says what is still needed; a home whose first month cannot be paid says the shortfall.
                  const shut = one === "compound-room" ? "needed" : "short";
                  const Icon = short ? Lock : HOME_ICONS[one];
                  const figure = formatMoney(Math.abs(pocket), "NGN");
                  const { monthly, rentYear } = homeFigures(one);
                  return (
                    <button
                      key={one}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={say(`ui.door.home.${one}`)}
                      aria-description={say(short ? `ui.door.home.said.${shut}` : "ui.door.home.said.left", { amount: figure })}
                      disabled={short}
                      data-home={one}
                      onClick={() => change({ home: one, homePicked: true })}
                      className={`press flex w-full items-center gap-2.5 rounded-[5px] px-3 py-2 text-left disabled:opacity-60 ${on ? "bg-strong text-on-strong" : "bg-sheet-muted"}`}
                    >
                      <Icon size={20} className="shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-[14px] font-extrabold">
                          {say(`ui.door.home.${one}`)} <span className={`font-semibold ${on ? "opacity-80" : "text-text-2"}`}>· {say(`ui.door.home.where.${one}`)}</span>
                        </span>
                        <span className={`block truncate text-[12px] ${on ? "opacity-85" : "text-text-2"}`} data-home-costs>
                          {say(`ui.door.home.costs.${one}`, { amount: formatMoney(monthly, "NGN"), rent: formatMoney(rentYear ?? 0, "NGN") })}
                        </span>
                      </span>
                      <span className="shrink-0 text-right leading-tight" data-home-left={short ? shut : "left"}>
                        <span className="num block text-[14px]">{figure}</span>
                        <span className="block text-[10px] font-semibold opacity-80">{say(short ? `ui.door.home.${shut}` : "ui.door.home.left")}</span>
                      </span>
                    </button>
                  );
                })}
                {/* The self-contain: shown locked as the goal, with its figure and no action. */}
                <div className="flex w-full items-center gap-2.5 rounded-[5px] bg-sheet-muted px-3 py-2 opacity-60" aria-disabled="true" aria-label={say("ui.door.home.self-contain")} aria-description={say("ui.door.home.said.goal", { amount: formatMoney(selfContainYear(), "NGN") })} data-home="self-contain">
                  <Lock size={20} className="shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[14px] font-extrabold">
                      {say("ui.door.home.self-contain")} <span className="font-semibold text-text-2">· {say("ui.door.home.where.self-contain")}</span>
                    </span>
                    <span className="block truncate text-[12px] text-text-2" data-home-costs>
                      {say("ui.door.home.costs.self-contain", { amount: formatMoney(selfContainYear(), "NGN") })}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] font-bold leading-tight" data-home-left="goal">
                    {say("ui.door.home.goal")}
                  </span>
                </div>
              </div>
            </section>
          )}
        </GateSheet>
      ) : draft.stage === "ready" ? (
        <GateSheet key="ready" mark="ready" label={say("ui.door.ready.title")}>
          <h1 className="title text-[22px] leading-tight">{say("ui.door.ready.title")}</h1>
          <p className="text-[13px] text-text-2">{say("ui.door.ready.hint")}</p>
          <ul className="mt-2 flex flex-col divide-y divide-sheet-line" data-ready>
            {READY.map((id) => (
              <li key={id} className="flex items-center gap-3 py-3" data-ready-life={id}>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-extrabold">{say(`${id}.kind`)}</h2>
                  <p className="text-[13px] leading-snug text-text-2">{blurbOf(id)}</p>
                </div>
                <button
                  type="button"
                  className="press shrink-0 rounded-[5px] bg-action px-4 py-2.5 text-[14px] font-extrabold text-action-text"
                  aria-label={`${say("prologue.door.pick")}: ${say(`${id}.kind`)}`}
                  onClick={() => change({ ready: id, age: 0, stage: "page" })}
                >
                  {say("prologue.door.pick")}
                </button>
              </li>
            ))}
          </ul>
        </GateSheet>
      ) : (
        <GateSheet
          key="page"
          mark="page"
          label={say("prologue.door.page.title")}
          foot={
            <button type="button" className="btn-main" onClick={begin} disabled={stamped}>
              <span>{say("ui.door.begin")}</span>
              <span className="text-[13px] font-semibold opacity-80">{say("prologue.door.begin.then")}</span>
            </button>
          }
        >
          <h1 className="title text-[22px] leading-tight">{say("prologue.door.page.title")}</h1>
          <p className="mt-0.5 text-[13px] leading-snug text-text-2">{say("prologue.door.page.hint")}</p>
          {guest === null
            ? null
            : guest.fields(
                username,
                (next) => {
                  setTypedUsername(next);
                  setUsernameSaid(null);
                },
                usernameSaid,
              )}
        </GateSheet>
      )}
    </Gate>
  );
}
