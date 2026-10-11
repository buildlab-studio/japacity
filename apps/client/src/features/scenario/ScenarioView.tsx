// The front door (prologue.md R-PROLOGUE-009, 013), screen for screen as designed, with everything already
// chosen so Next, Next, Begin starts a life. You (the name filled from the pool for the look's sex, a dice for another,
// the body that filters the look strip, your own colours) and Your life so far (the tiles as rows, the first chosen, the
// age under them at the tile's own, where you live) stand the figure alone on its turntable over the theme's band; Your
// page prints the travel data page over the compound. Skip on the first two goes to the page; Shuffle picks a look, a
// name and a tile at random. The ready lives are not on the door: a run Settings asks for lists them on the second
// screen in the place of the tiles.
// The run is kept as it goes, so a reload at any step comes back to that step; nothing of the life is written
// before Begin. For a tile, Begin starts the life at once and the page fills as the years go by (R-PROLOGUE-014).
// Online and signed out, the gate hands in the guest start (account.md R-ACCOUNT-029): the page holds the username,
// filled in from the name and changed there, and the guest line; Begin makes the guest life before the character.
import { content } from "@japacity/content";
import { type Id, int } from "@japacity/sim";
import { Award, BedSingle, BookOpen, ChevronLeft, ChevronRight, Dices, Flag, GraduationCap, Hammer, House, Lock, Send, Store, Waves } from "lucide-react";
import { type ReactNode, useState } from "react";

import { useGame } from "../../authority/GameProvider";
import { keepPerson } from "../../authority/person";
import { formatMoney } from "../../shared/words/format";
import { blurbOf, say, words } from "../../shared/words/text";
import { agePointsCount, type Archetype, ARCHETYPES, archetypeOf, FROM_SIXTEEN, type Home, homeOf, homesFor, moneyDrawn, opensChips, savingsOf, throughUniversity } from "../../shared/frontdoor/archetypes";
import { DoorHead } from "../../shared/frontdoor/DoorHead";
import { Stand } from "../../shared/frontdoor/Stand";
import { Gate, GateSheet, gateLook } from "../../shared/frontdoor/Gate";
import { LOOKS, lookOf, namesFor } from "../../shared/frontdoor/looks";
import { OwnColoursRows } from "../../shared/frontdoor/OwnColours";
import { isMade } from "../../shared/frontdoor/style";
import { takeReadyAsk } from "../../shared/frontdoor/ready";
import { DataPage, type PageFields } from "../../shared/datapage/DataPage";
import { EditLink, FamilyFace, JapacityLine, StatBox } from "../../shared/datapage/PageParts";
import { FactChip, type FactChipProps } from "../../shared/ui/FactChip";
import { madePhoto } from "../../shared/datapage/photo";
import { type DoorDraft, type DoorStage, keepDoor, readDoor } from "../../shared/datapage/door";
import { NAME_LONGEST, nameProblem, problemWords } from "../../shared/datapage/name";
import { ageStepWords, startYearFor, stepsOpen, yearsWorked } from "../../shared/datapage/age";
import { readyMonths, yearsOf } from "../../shared/datapage/years";

/** The ready lives: every scenario but the life from sixteen, each named by its kind, never its person. */
const READY = (Object.keys(content.scenario) as Id<"scenario">[]).filter((id) => content.scenario[id]?.prologue !== true);
/** The three screens, for the progress marks over the scene. */
const SCREENS: readonly DoorStage[] = ["you", "life", "page"];

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

/**
 * The naira in kobo the life holds at Begin in a home: the tile's savings and what its age step
 * saves, less what moving in takes. The band shows this figure when the world opens; the month's living falls due at the
 * month's end, so the row names it apart.
 */
export function startIn(archetype: Archetype, years: number, home: Home): number {
  return savingsOf(archetype) + yearsWorked(years).saved - homeFigures(home).now;
}

/** The home kept when the tile or the age changes: the one the player picked while the life can still move in, else the tile's own, else the first it can pay for. */
export function fitHome(archetype: Archetype, years: number, draft: Pick<DoorDraft, "home" | "homePicked">): Home {
  const offered = homesFor(archetype);
  const picked = draft.homePicked === true ? offered.filter((one) => one === draft.home) : [];
  const own = homeOf(archetype);
  return [...picked, own, ...offered].find((one) => pocketIn(archetype, years, one) >= 0) ?? own;
}

/**
 * True when the tile's savings at the age picked already cover the self-contain's year and fees. The row stays, locked
 * as the goal with its figure; it only says "reached" beside the lock.
 */
export function selfContainReached(archetype: Archetype, years: number): boolean {
  return savingsOf(archetype) + yearsWorked(years).saved >= selfContainYear();
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
  // Settings' "Start from a ready life" opens on the ready lives themselves; Back reaches the name.
  if (takeReadyAsk()) return { ...freshDraft(gateLook(kept?.look)), asked: true, stage: "ready" };
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


/** How old the run's life starts, in whole years: the tile's own year and the steps older, or the ready life's age. */
function yearsFor(draft: DoorDraft): number | null {
  const archetype = draft.ready === null ? archetypeOf(draft.archetype) : null;
  const ready = READY.find((id) => id === draft.ready) ?? null;
  // The year picked is the year the life starts at (R-PROLOGUE-004, decision 0023): a true number, never "about".
  return archetype !== null ? startYearFor(archetype, Math.max(0, draft.age)) : ready !== null ? yearsOf(readyMonths(ready)) : null;
}

/** The tile's name, or the ready life's kind. */
function pathWords(draft: DoorDraft): string {
  const archetype = draft.ready === null ? archetypeOf(draft.archetype) : null;
  const ready = READY.find((id) => id === draft.ready) ?? null;
  return archetype !== null ? say(`prologue.archetype.${archetype.id}.name`) : ready !== null ? say(`${ready}.kind`) : "";
}

/**
 * What the page prints for the run so far. The family is drawn and how ready is read only once Begin starts the life,
 * so both stand empty until then; the page never prints a figure that is not yet true.
 */
function fieldsOf(draft: DoorDraft): PageFields {
  const years = yearsFor(draft);
  const archetype = draft.ready === null ? archetypeOf(draft.archetype) : null;
  const home = archetype === null ? null : fitHome(archetype, draft.age, { home: draft.home ?? homeOf(archetype), homePicked: true });
  return {
    name: draft.name.trim(),
    age: years === null ? "" : say("prologue.page.age.years", { years }),
    path: pathWords(draft),
    ready: "",
    family: "",
    ...(archetype === null ? {} : { was: say(`prologue.archetype.${archetype.id}.was`) }),
    // The strip from what the door knows: the home's district and the year picked; the months and how ready come with the life.
    strip: { district: home === null ? "" : say(`ui.door.home.where.${home}`), years, months: null, percent: null },
    photo: lookOf(draft.look)?.picture ?? "",
    wear: { look: draft.look, ...(draft.style === undefined ? {} : { style: draft.style }) },
  };
}

/** The path and the age in small figures under the name over the figure. */
function captionOf(draft: DoorDraft): string {
  const years = yearsFor(draft);
  const path = pathWords(draft);
  if (years === null) return path;
  return say("ui.door.caption", { path, age: say("ui.profile.age", { years }) });
}

/** The years a tile's life will pass, as chips not yet lived: the page fills them as the years go by (R-PROLOGUE-014). */
export function plannedYears(archetype: Archetype): (FactChipProps & { id: string })[] {
  const first = (step: string): string => archetype.preset[step]?.[0] ?? "";
  const waec = { id: "waec", icon: Award, label: say("ui.page.year.waec"), note: words(`prologue.subjects.answer.${first("subjects")}`), state: "waiting" as const };
  if (throughUniversity(archetype)) {
    return [
      waec,
      { id: "exam", icon: BookOpen, label: say("ui.page.year.exam"), note: null, state: "waiting" },
      { id: "university", icon: GraduationCap, label: say("ui.page.year.university"), note: words(`prologue.course.answer.${first("course")}`), state: "waiting" },
      { id: "service", icon: Flag, label: say("ui.page.year.service"), note: null, state: "waiting" },
    ];
  }
  if (first("after-school") === "apprentice") return [waec, { id: "master", icon: Hammer, label: say("ui.page.year.master"), note: words(`prologue.master.answer.${first("master")}`), state: "waiting" }];
  const years = Math.round((content.prologue["shop"]?.months ?? 0) / 12);
  return [waec, { id: "shop", icon: Store, label: say("ui.page.year.shop"), note: say("ui.page.year.shop.years", { count: years }), state: "waiting" }];
}

/** Where the life starts, as the page says it, with when its rent or living costs fall next (R-PROLOGUE-013). */
function homeDue(home: Home): string {
  const effects = content.prologue["home"]?.answers.find((answer) => answer.id === home)?.effects ?? [];
  for (const effect of effects) {
    if (effect.type !== "obligation/open") continue;
    const entry = content.obligation[effect.obligation];
    if (entry?.prepaid === true) return say("ui.page.home.costs.prepaid", { count: entry.everyMonths ?? 12 });
  }
  return say("ui.page.home.costs", { amount: formatMoney(homeFigures(home).monthly, "NGN") });
}

/** The one main button at the sheet's foot: its word, and a smaller word for where it goes. */
function MainButton({ word, then, onClick, disabled = false }: { word: string; then: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="btn-main" onClick={onClick} disabled={disabled}>
      <span>{word}</span>
      <span className="truncate pl-3 text-[13px] font-semibold opacity-80">{then}</span>
    </button>
  );
}

/** A label over what it names, as the design's rows have it. */
function Row({ label, children, mark }: { label: string; children: ReactNode; mark?: string }) {
  return (
    <section className="mt-3.5" aria-label={label} {...(mark === undefined ? {} : { [mark]: "" })}>
      <h2 className="label mb-1.5 text-text-2">{label}</h2>
      {children}
    </section>
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
  const [pressed, setPressed] = useState(false);
  // The username as typed on the page; null while the name fills it in.
  const [typedUsername, setTypedUsername] = useState<string | null>(null);
  const [usernameSaid, setUsernameSaid] = useState<string | null>(null);

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

  const sex = lookOf(draft.look)?.sex ?? "f";
  // A new look keeps a typed name; a filled one follows the look's sex.
  const chooseLook = (look: string): void => {
    const sameSex = lookOf(look)?.sex === lookOf(draft.look)?.sex;
    change({ look, ...(draft.typed === true || sameSex ? {} : { name: filledName(look, draft.roll) }) });
  };
  // The body filters the look strip: the other one's first look, the name following it unless typed.
  const chooseBody = (body: "f" | "m"): void => {
    if (body === sex) return;
    const first = LOOKS.find((one) => one.sex === body);
    if (first !== undefined) chooseLook(first.id);
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
    if (pressed) return;
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
      keepPerson({ look: draft.look, name: draft.name.trim(), archetype: ready === null ? draft.archetype : null, ...(style === undefined ? {} : { style }), ...(photo === undefined ? {} : { photo: photo.photo, photoPx: photo.px }) });
      change({ stage: "begun", ...(home === null ? {} : { home }) });
      void chooseLife(ready ?? FROM_SIXTEEN)
        .then(() => guest?.started())
        .catch(() => setPressed(false));
    };
    if (guest === null) {
      setPressed(true);
      start();
      return;
    }
    const typed = guest.check(username);
    setUsernameSaid(typed);
    if (typed !== null) return;
    setPressed(true);
    // R-ACCOUNT-021: the guest life first; the character is the account's one (R-ACCOUNT-015).
    void guest.start(username, typedUsername === null).then((said) => {
      setUsernameSaid(said);
      if (said === null) start();
      else setPressed(false);
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
  const onBack = pressed ? null : back !== null ? () => change({ stage: back }) : asked && draft.stage === "you" ? leave : null;
  const at = Math.max(0, SCREENS.indexOf(draft.stage === "ready" ? "life" : draft.stage === "begun" ? "page" : draft.stage));
  const title = draft.stage === "you" ? say("ui.life.title") : draft.stage === "life" ? say("ui.door.life") : draft.stage === "ready" ? say("ui.door.ready.title") : say("prologue.door.page.title");
  const head = <DoorHead title={title} at={at} count={SCREENS.length} onBack={onBack} onShuffle={faster ? shuffle : null} onSkip={faster ? () => go("page") : null} />;

  if (draft.stage === "page" || draft.stage === "begun") {
    const planned = archetype === null ? [] : plannedYears(archetype);
    return (
      <Gate
        look={draft.look}
        style={draft.style}
        mark={draft.stage}
        over={
          <>
            {/* The header on the theme's band, as the design's page has it, so its chalk reads over the compound. */}
            <div className="band-2 pointer-events-auto -mx-3 -mt-[max(10px,env(safe-area-inset-top))] px-3 pt-[max(12px,env(safe-area-inset-top))] pb-2">{head}</div>
            <div className="pointer-events-auto mx-auto mt-3 w-full max-w-[420px]">
              <DataPage page={fieldsOf(draft)} print />
            </div>
          </>
        }
      >
        <GateSheet key="page" mark="page" label={say("prologue.door.page.title")} foot={<MainButton word={say("ui.door.begin")} then={say("ui.door.begin.then")} onClick={begin} disabled={pressed} />}>
          {archetype === null ? null : (
            <>
              <FamilyFace card={null} label={say("ui.page.family.unseen")} />
              <h2 className="label mt-3 mb-1.5 text-text-2">{say("ui.page.years")}</h2>
              <div className="grid grid-cols-2 gap-1.5" data-years-planned>
                {planned.map((chip) => (
                  <FactChip key={chip.id} {...chip} />
                ))}
              </div>
            </>
          )}
          {home === null ? null : (
            <div className="mt-2 flex items-center gap-2 rounded-[6px] bg-sheet-muted px-2.5 py-2" data-page-home={home}>
              {(() => {
                const Icon = HOME_ICONS[home];
                return <Icon size={20} className="shrink-0 text-strong" aria-hidden />;
              })()}
              <span className="min-w-0 flex-1 text-[13px] leading-tight font-bold">{say(`ui.page.home.${home}`)}</span>
              <span className="shrink-0 text-[12px] font-semibold text-text-2">{homeDue(home)}</span>
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <StatBox label={say("ui.page.money")} value="" mark="money" />
            <StatBox label={say("ui.page.ready")} value="" mark="ready" />
          </div>
          <JapacityLine />
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
          {pressed ? null : (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <EditLink mark="you" onClick={() => change({ stage: "you" })}>
                {say("ui.door.edit.you")}
              </EditLink>
              <EditLink mark="life" onClick={() => change({ stage: draft.ready === null ? "life" : "ready" })}>
                {say("ui.door.edit.life")}
              </EditLink>
            </div>
          )}
        </GateSheet>
      </Gate>
    );
  }

  return (
    <Stand look={draft.look} style={draft.style} mark={draft.stage} head={head} name={draft.name.trim()} caption={captionOf(draft)}>
      {draft.stage === "you" ? (
        <GateSheet
          key="you"
          mark="you"
          label={say("ui.life.title")}
          foot={<MainButton word={say("ui.door.next")} then={say(asked ? "ui.door.ready.title" : "ui.door.next.then")} onClick={() => go(asked ? "ready" : "life")} />}
        >
          {/* What the game is about, in one line under the question (R-TEXT-006). */}
          <p className="text-[13px] leading-snug text-text-2" data-door-intro>
            {say("ui.life.intro")}
          </p>
          {notice === null ? null : (
            <p role="status" className="mt-3 rounded-[5px] border-l-4 border-l-action bg-sheet-muted p-3 text-[14px]">
              {say(notice)}
            </p>
          )}
          <label className="label mt-3.5 block text-text-2" htmlFor="door-name">
            {say("prologue.door.name.title")}
          </label>
          <div className="mt-1 flex gap-1.5">
            <input
              id="door-name"
              className="h-12 min-w-0 flex-1 rounded-[6px] border-2 border-sheet-line bg-sheet-2 px-3 text-[17px] font-bold text-text outline-none focus:border-strong"
              placeholder={say("prologue.door.name.placeholder")}
              value={draft.name}
              maxLength={NAME_LONGEST + 4}
              autoComplete="off"
              autoCapitalize="words"
              spellCheck={false}
              aria-invalid={tried && problem !== null}
              onFocus={(event) => {
                if (draft.typed !== true) event.target.select();
              }}
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
            <p role="alert" className="mt-1 text-[12px] font-semibold text-out">
              {problemWords(problem)}
            </p>
          ) : null}
          <Row label={say("ui.door.body")} mark="data-door-body">
            <div className="grid grid-cols-2 gap-1.5">
              {(["f", "m"] as const).map((body) => (
                <button
                  key={body}
                  type="button"
                  aria-pressed={sex === body}
                  onClick={() => chooseBody(body)}
                  className={`press h-10 rounded-[6px] text-[14px] font-bold ${sex === body ? "bg-pick text-on-pick" : "bg-sheet-muted"}`}
                  data-body={body}
                >
                  {say(`ui.door.body.${body}`)}
                </button>
              ))}
            </div>
          </Row>
          <Row label={say("ui.door.look")}>
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pt-1 pb-1" role="radiogroup" aria-label={say("ui.door.look")} data-looks>
              {LOOKS.filter((one) => one.sex === sex).map((one, index) => {
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
                    className={`press h-[84px] w-[48px] shrink-0 overflow-hidden rounded-[6px] bg-sheet-muted ${on ? "ring-[3px] ring-strong" : ""}`}
                  >
                    {one.picture === "" ? null : <img src={one.picture} alt="" className="h-full w-full object-cover object-top" draggable={false} />}
                  </button>
                );
              })}
            </div>
          </Row>
          {/* Your own colours on the look (R-PROLOGUE-015), under the strip. */}
          <OwnColoursRows look={draft.look} style={draft.style} onStyle={(style) => change({ style: isMade(style) ? undefined : style })} />
        </GateSheet>
      ) : draft.stage === "life" ? (
        <GateSheet key="life" mark="life" label={say("ui.door.life")} foot={<MainButton word={say("prologue.door.print")} then={say("ui.door.print.then")} onClick={() => go("page")} />}>
          {once ? (
            <p className="mb-2 text-[12px] leading-snug text-text-2" data-door-once>
              {say("prologue.archetype.once")}
            </p>
          ) : null}
          <ul className="flex flex-col gap-1.5" role="radiogroup" aria-label={say("ui.door.life")} data-archetypes>
            {ARCHETYPES.map((tile) => {
              const on = draft.archetype === tile.id && draft.ready === null;
              return (
                <li key={tile.id}>
                  <button
                    type="button"
                    role="radio"
                    data-archetype={tile.id}
                    aria-label={say(`prologue.archetype.${tile.id}.name`)}
                    aria-description={say(`prologue.archetype.${tile.id}.opens`)}
                    aria-checked={on}
                    onClick={() => change({ archetype: tile.id, ready: null, age: 0, home: fitHome(tile, 0, draft) })}
                    className={`press block w-full rounded-[6px] px-3 py-2.5 text-left ${on ? "bg-pick text-on-pick" : "bg-sheet-muted"}`}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[15px] leading-tight font-extrabold">{say(`prologue.archetype.${tile.id}.name`)}</span>
                      <span className={`shrink-0 rounded-[3px] px-1.5 py-0.5 text-[10px] font-bold ${on ? "bg-pick-mark text-pick" : "bg-sheet-2"}`} data-tile-tag>
                        {say(`ui.door.tag.${tile.id}`)}
                      </span>
                    </span>
                    <span className={`block text-[12.5px] leading-snug ${on ? "opacity-85" : "text-text-2"}`} data-tile-was>
                      {say(`prologue.archetype.${tile.id}.was`)}
                    </span>
                    <span className="num mt-0.5 block text-[12.5px] font-bold" data-tile-savings>
                      {say("ui.door.tile.savings", { amount: formatMoney(savingsOf(tile), "NGN") })}
                    </span>
                    {on ? (
                      <span className="mt-1.5 flex flex-wrap gap-1" data-tile-opens>
                        {opensChips(tile.id).map((way) => (
                          <span key={way} className="inline-flex items-center gap-1 rounded-[4px] bg-pick-mark px-1.5 py-0.5 text-[12px] font-bold text-pick">
                            <Send size={12} strokeWidth={2.4} aria-hidden /> {way}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
          {lowest === null ? null : (
            <section className="mt-3 rounded-[6px] bg-sheet-muted p-1" aria-label={say("prologue.door.age")} data-door-age>
              <div className="flex items-center justify-between" data-age-steps>
                <button type="button" className="press flex size-11 items-center justify-center rounded-[5px] bg-sheet-2 disabled:opacity-40" aria-label={say("prologue.door.age.younger")} disabled={!open.includes(older - 1)} onClick={() => step(-1)}>
                  <ChevronLeft size={20} />
                </button>
                <div className="text-center leading-none">
                  <p className="num text-[22px]" data-age-years>
                    {say("prologue.door.age.years", { years: lowest + older })}
                  </p>
                  <h2 className="label mt-1 text-[9px] text-text-2">{say("prologue.door.age")}</h2>
                </div>
                <button type="button" className="press flex size-11 items-center justify-center rounded-[5px] bg-sheet-2 disabled:opacity-40" aria-label={say("prologue.door.age.older")} disabled={!open.includes(older + 1)} onClick={() => step(1)}>
                  <ChevronRight size={20} />
                </button>
              </div>
              {ageStepWords(older, lowest, archetype !== null && agePointsCount(archetype)) === "" ? (
                <div className="pb-1" />
              ) : (
                <p className="px-2 pt-1 pb-1.5 text-center text-[12px] text-text-2" data-age-does>
                  {ageStepWords(older, lowest, archetype !== null && agePointsCount(archetype))}
                </p>
              )}
            </section>
          )}
          {archetype === null || home === null ? null : (
            <section className="mt-3" aria-label={say("ui.door.home")} data-door-home>
              <h2 className="label mb-1.5 text-text-2">{say("ui.door.home")}</h2>
              <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={say("ui.door.home")}>
                {homesFor(archetype).map((one) => {
                  const on = one === home;
                  const pocket = pocketIn(archetype, draft.age, one);
                  const short = pocket < 0;
                  // The room shut says what is still needed; a home whose first month cannot be paid says the shortfall.
                  const shut = one === "compound-room" ? "needed" : "short";
                  const Icon = short ? Lock : HOME_ICONS[one];
                  const { now, monthly, rentYear } = homeFigures(one);
                  // Open: what the life holds at Begin; shut: what it is short of the move-in and a month of living.
                  const start = formatMoney(startIn(archetype, draft.age, one), "NGN");
                  const figure = short ? formatMoney(-pocket, "NGN") : moneyDrawn(archetype) ? say("ui.door.home.about", { amount: start }) : start;
                  return (
                    <button
                      key={one}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={say(`ui.door.home.${one}`)}
                      aria-description={say(short ? `ui.door.home.said.${shut}` : "ui.door.home.said.start", { amount: figure, monthly: formatMoney(monthly, "NGN") })}
                      disabled={short}
                      data-home={one}
                      onClick={() => change({ home: one, homePicked: true })}
                      className={`press flex w-full items-center gap-2 rounded-[6px] px-2.5 py-2 text-left disabled:opacity-60 ${on ? "bg-pick text-on-pick" : "bg-sheet-muted"}`}
                    >
                      <Icon size={18} className="shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-[13.5px] font-extrabold">
                          {say(`ui.door.home.${one}`)} <span className={`font-semibold ${on ? "opacity-80" : "text-text-2"}`}>· {say(`ui.door.home.where.${one}`)}</span>
                        </span>
                        <span className={`block text-[12px] leading-snug ${on ? "opacity-85" : "text-text-2"}`} data-home-costs>
                          {say(`ui.door.home.costs.${one}`, { amount: formatMoney(monthly, "NGN"), rent: formatMoney(rentYear ?? 0, "NGN"), movein: formatMoney(now, "NGN") })}
                        </span>
                      </span>
                      <span className="shrink-0 text-right leading-tight" data-home-left={short ? shut : "start"}>
                        <span className="num block text-[14px]">{figure}</span>
                        <span className="block text-[10px] font-semibold opacity-80">{say(short ? `ui.door.home.${shut}` : "ui.door.home.start")}</span>
                      </span>
                    </button>
                  );
                })}
                {/* The self-contain: always shown, locked as the goal, with its figure and no action; reached, it says so and stays. */}
                <div className="flex w-full items-center gap-2 rounded-[6px] bg-sheet-muted px-2.5 py-2 opacity-60" aria-disabled="true" aria-label={say("ui.door.home.self-contain")} aria-description={say("ui.door.home.said.goal", { amount: formatMoney(selfContainYear(), "NGN") })} data-home="self-contain">
                  <Lock size={18} className="shrink-0" aria-hidden />
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[13.5px] font-extrabold">
                      {say("ui.door.home.self-contain")} <span className="font-semibold text-text-2">· {say("ui.door.home.where.self-contain")}</span>
                    </span>
                    <span className="block truncate text-[12px] text-text-2" data-home-costs>
                      {say("ui.door.home.costs.self-contain", { amount: formatMoney(selfContainYear(), "NGN") })}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] leading-tight font-bold" data-home-left="goal">
                    {say("ui.door.home.goal")}
                    {selfContainReached(archetype, draft.age) ? (
                      <span className="block text-[10px] font-semibold" data-home-reached>
                        {say("ui.door.home.reached")}
                      </span>
                    ) : null}
                  </span>
                </div>
              </div>
            </section>
          )}
        </GateSheet>
      ) : (
        <GateSheet key="ready" mark="ready" label={say("ui.door.ready.title")}>
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
      )}
    </Stand>
  );
}
