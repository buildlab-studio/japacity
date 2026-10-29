// The front door (prologue:front-door-builds-a-person, prologue:front-door-three-screens), in the game's look (a sticker board, the homes stacked as
// postcards), with everything already chosen so Next, Next, Begin starts a life. You (the name filled from the pool
// for the look's sex, a dice for another, the look strip as round face stickers, your own colours) stands you whole on a
// photo card; Your life so far is the lives swiped sideways with the age under them; Where you live is the homes as
// postcards, then Begin. The page prints after Begin (prologue:printed-page-hands-over). Skip on the first two goes to Where you live;
// Shuffle picks a look, a name and a tile at random. The ready lives are not on the door: a run Settings asks for lists
// them on the second screen in the place of the tiles. The figure is a sticker of the shipped model, never a turntable.
// The run is kept as it goes, so a reload at any step comes back to that step; nothing of the life is written
// before Begin, and the run is marked begun only once the authority has answered it (engine:browser-authority-for-dev-only). For a tile,
// Begin starts the life at once and the page fills as the years go by (prologue:printed-page-hands-over).
// Online and signed out, the gate hands in the guest start (account:start-screen-over-live-city): Where you live holds the
// username box, empty for the player to type their own and checked as they type (account:username-typed-and-checked), and
// the guest line; Begin makes the guest life before the character. Enter in the box is Begin, and a Begin refused for the
// name brings the box into view and focuses it, the reason under it. The box stays under the homes: the page is where
// you live, and the refusal itself brings the box up wherever the page was scrolled.
// Signed in with no character, the username was chosen before the door, so a new run's name starts from it where it can be
// a first name; a name the player typed or rolled, and a run kept on the device, keep theirs.
import { content } from "@japacity/content";
import { type Id } from "@japacity/sim";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { useGame } from "../../authority/GameProvider";
import { useScreenCount } from "../../shared/analytics/useScreenCount";
import { LEVEL, useBackLayer } from "../../shared/back/back";
import { authorityMode } from "../../shared/net/authorityMode";
import { keepPerson } from "../../shared/front-door/person";
import { blurbOf, say } from "../../shared/words/text";
import { ARCHETYPES, archetypeOf, FROM_SIXTEEN, type Home, homeOf } from "../../shared/front-door/archetypes";
import { DoorAction, DoorFrame } from "../../shared/front-door/DoorFrame";
import { fitHome } from "../../shared/front-door/homes";
import { StartHook } from "../../shared/front-door/Hook";
import { gateLook } from "../../shared/front-door/Gate";
import { LOOKS, lookOf, namesFor } from "../../shared/front-door/looks";
import { isMade } from "../../shared/front-door/style";
import { takeReadyAsk } from "../../shared/front-door/ready";
import { madePhoto } from "../../shared/datapage/photo";
import { type DoorDraft, type DoorStage, keepDoor, readDoor } from "../../shared/datapage/door";
import { nameFromUsername, nameProblem } from "../../shared/datapage/name";
import { startYearFor, stepsOpen } from "../../shared/datapage/age";
import { readyMonths, yearsOf } from "../../shared/datapage/years";
import { Board, HomeRow, ReadyHome, thingOf } from "./HomeScreen";
import { LifeScreen } from "./LifeScreen";
import { YouScreen } from "./YouScreen";

export { fitHome, homeFigures, pocketIn, selfContainReached, selfContainYear, startIn } from "../../shared/front-door/homes";
export { plannedYears } from "../../shared/front-door/planned";

/** The ready lives: every scenario but the life from sixteen, each named by its kind, never its person. */
const READY = (Object.keys(content.scenario) as Id<"scenario">[]).filter((id) => content.scenario[id]?.prologue !== true);
/** The three screens, for the dots over the action. */
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

/** A new run's name from the username chosen before the door, where it gives one: the player's own, so a new look keeps it as a typed one. */
function namedFrom(draft: DoorDraft, username: string | null): DoorDraft {
  const given = username === null ? null : nameFromUsername(username);
  return given === null ? draft : { ...draft, name: given, typed: true };
}

/**
 * The run as kept, or a new one with the kept look; a run already begun starts again. Settings' ask starts a run for the
 * ready lives. `fresh` says the run is new this visit, so a username read later may still give it its name.
 */
function startDraft(username: string | null): { draft: DoorDraft; fresh: boolean } {
  const kept = readDoor();
  // Settings' "Start from a ready life" opens on the ready lives themselves; Back reaches the name.
  if (takeReadyAsk()) return { draft: { ...namedFrom(freshDraft(gateLook(kept?.look)), username), asked: true, stage: "ready" }, fresh: username === null };
  if (kept !== null && kept.stage !== "begun") return { draft: { ...kept, look: gateLook(kept.look) }, fresh: false };
  return { draft: namedFrom(freshDraft(gateLook(kept?.look)), username), fresh: username === null };
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
  // The year picked is the year the life starts at (prologue:age-advances-with-steps, decision 0023): a true number, never "about".
  return archetype !== null ? startYearFor(archetype, Math.max(0, draft.age)) : ready !== null ? yearsOf(readyMonths(ready)) : null;
}

/** The tile's name, or the ready life's kind. */
function pathWords(draft: DoorDraft): string {
  const archetype = draft.ready === null ? archetypeOf(draft.archetype) : null;
  const ready = READY.find((id) => id === draft.ready) ?? null;
  return archetype !== null ? say(`prologue.archetype.${archetype.id}.name`) : ready !== null ? say(`${ready}.kind`) : "";
}

/** Where every ready life starts (home.md: the home kind's first place). */
const READY_HOME: Home = "family-house";

/** The path and the age beside the name in the strip, the age as the page prints it; on the ready lives, nothing until one is picked. */
function captionOf(draft: DoorDraft): string {
  if (draft.stage === "ready" && draft.ready === null) return "";
  const years = yearsFor(draft);
  const path = pathWords(draft);
  if (years === null) return path;
  return say("ui.door.caption", { path, age: say("prologue.page.age.years", { years }) });
}

/** The guest start the gate hands in online (account:guest-and-secured-states, account:username-and-unconfirmed-email, account:start-screen-over-live-city); the account feature's GuestDoor. */
export interface DoorGuest {
  check: (username: string) => string | null;
  fields: (value: string, onChange: (username: string) => void, problem: string | null, onEnter?: () => void) => ReactNode;
  /** account:username-typed-and-checked: brings the box into view and focuses it, for a Begin refused for the name as typed. */
  reveal: () => void;
  /** Null once the guest life is made; otherwise what to say by the username. */
  start: (username: string) => Promise<string | null>;
  started: () => Promise<void>;
  /** After a failed character start: what to say when the guest must be made again by the next Begin, or null. */
  lost: (error: unknown) => string | null;
}

/**
 * analytics:client-sends-interface-counts, analytics:nightly-game-counters: the front door's screens as the funnel counts them: the first door,
 * the second (an archetype or a ready life), and the third, Where you live with Begin, counted under the key `page`.
 * Begun is no screen of its own.
 */
export function doorScreen(stage: DoorStage): "door-1" | "door-2" | "page" | null {
  switch (stage) {
    case "you":
      return "door-1";
    case "life":
    case "ready":
      return "door-2";
    case "page":
      return "page";
    case "begun":
      return null;
    default: {
      const never: never = stage;
      throw new Error(`Unknown door stage ${String(never)}.`);
    }
  }
}

/**
 * `username`: the account's username where it was chosen before the door (the sign-in path), null while unknown or where
 * the door asks it last (Play's path); a new run's name starts from it (prologue:front-door-builds-a-person).
 */
export function FrontDoor({ guest = null, username: chosen = null }: { guest?: DoorGuest | null; username?: string | null }) {
  const notice = useGame((state) => state.notice);
  const chooseLife = useGame((state) => state.chooseLife);
  // The life chooser cannot be opened again where a life is started only once (account:one-character-per-account).
  const once = useGame((state) => state.openLifeChooser === null);
  // Opened from Settings over a life: the ready lives' back returns to it.
  const backToLife = useGame((state) => (state.view === null ? null : state.closeLifeChooser));
  // The run as it opens is kept at once, so a reload keeps the name it filled.
  const [opening] = useState(() => {
    const opened = startDraft(chosen);
    keepDoor(opened.draft);
    return opened;
  });
  const [draft, setDraft] = useState<DoorDraft>(opening.draft);
  // A new run nobody has touched yet takes the username's name once it is read; any change of the player's ends that.
  const untouched = useRef(opening.fresh);
  useEffect(() => {
    if (chosen === null || !untouched.current) return;
    untouched.current = false;
    if (nameFromUsername(chosen) === null) return;
    setDraft((was) => {
      const next = namedFrom(was, chosen);
      keepDoor(next);
      return next;
    });
  }, [chosen]);
  const [tried, setTried] = useState(false);
  const [pressed, setPressed] = useState(false);
  // Offline the door is the first screen, so it carries the start screen's hook (text:hook-not-explanation).
  const [offline] = useState(() => authorityMode().authority === "local");
  useScreenCount(doorScreen(draft.stage));
  const [usernameSaid, setUsernameSaid] = useState<string | null>(null);

  // Kept as it changes, outside the state's updater, so the step is on the device even when the door closes at once.
  const change = (part: Partial<DoorDraft>): void => {
    untouched.current = false;
    const next = { ...draft, ...part };
    keepDoor(next);
    setDraft(next);
  };
  const problem = nameProblem(draft.name);
  // account:username-typed-and-checked: the username as the player types it on Where you live, empty until they do and never filled from
  // the name; kept with the run, so the age screen asked again or a reload gives it back as typed.
  const username = draft.username ?? "";
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
    if (pressed) return;
    setTried(true);
    if (problem !== null) {
      change({ stage: "you" });
      return;
    }
    const ready = draft.ready === null ? null : (READY.find((id) => id === draft.ready) ?? null);
    const start = (): void => {
      // The player's own colours, and the photo drawn in them (or as made) as the page printed, are kept with the person (prologue:player-colours-on-looks).
      const style = isMade(draft.style) ? undefined : draft.style;
      const photo = madePhoto(draft.look, style);
      keepPerson({ look: draft.look, name: draft.name.trim(), archetype: ready === null ? draft.archetype : null, ...(style === undefined ? {} : { style }), ...(photo === undefined ? {} : { photo: photo.photo, photoPx: photo.px }) });
      // engine:browser-authority-for-dev-only: Begin is one request, and its answer the point of no return. Until it comes the run stays on the
      // device as this screen (a reload comes back to it, filled in); once the authority holds the life the run is begun,
      // and a reload opens the life where it stands. The home goes first: the years read it as they play.
      const fitted = { ...draft, ...(home === null ? {} : { home }) };
      keepDoor(fitted);
      void chooseLife(ready ?? FROM_SIXTEEN)
        .then(() => {
          keepDoor({ ...fitted, stage: "begun" });
          return guest?.started();
        })
        .catch((error: unknown) => {
          setPressed(false);
          // account:guest-and-secured-states: a guest whose session was gone by the character's start is made again by the next Begin, and the page says so.
          const said = guest?.lost(error) ?? null;
          if (said !== null) setUsernameSaid(said);
        });
    };
    if (guest === null) {
      setPressed(true);
      start();
      return;
    }
    const typed = guest.check(username);
    setUsernameSaid(typed);
    if (typed !== null) {
      guest.reveal();
      return;
    }
    setPressed(true);
    // account:guest-and-secured-states: the guest life first; the character is the account's one (account:one-character-per-account).
    void guest.start(username).then((said) => {
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
  // world:back-closes-topmost: each screen past the first is a step Back takes back, as the door's own arrow does; the third
  // stands over the second. A run Settings opened over a life is a step over that life. Begin pressed, nothing goes back.
  const deep = draft.stage === "page" ? 2 : draft.stage === "life" || draft.stage === "ready" ? 1 : 0;
  useBackLayer(!pressed && asked && leave !== null, () => leave?.(), { level: LEVEL.step });
  useBackLayer(!pressed && deep >= 1, () => change({ stage: "you" }), { level: LEVEL.door });
  useBackLayer(!pressed && deep >= 2, () => change({ stage: before(draft) ?? "you" }), { level: LEVEL.door + 1 });
  const at = Math.max(0, SCREENS.indexOf(draft.stage === "ready" ? "life" : draft.stage === "begun" ? "page" : draft.stage));
  const frame = { mark: draft.stage, look: draft.look, onBack, onShuffle: faster ? shuffle : null, onSkip: faster ? () => go("page") : null, at };

  if (draft.stage === "page" || draft.stage === "begun") {
    return (
      <DoorFrame {...frame} title={say("ui.door.home")} line={archetype === null ? null : say("ui.door.home.hint")} foot={<DoorAction word={say("ui.door.begin")} onClick={begin} disabled={pressed} />}>
        <Board look={draft.look} name={draft.name.trim()} caption={captionOf(draft)} thing={thingOf(archetype)} onYou={pressed ? null : () => change({ stage: "you" })} onLife={pressed ? null : () => change({ stage: draft.ready === null ? "life" : "ready" })} />
        {archetype === null || home === null ? <ReadyHome home={READY_HOME} /> : <HomeRow archetype={archetype} years={draft.age} home={home} onHome={(one) => change({ home: one, homePicked: true })} />}
        {guest === null ? null : (
          <div className="door-card mx-5 mt-4 mb-2 px-4 pt-1 pb-4" data-door-guest>
            {guest.fields(
              username,
              (next) => {
                change({ username: next });
                setUsernameSaid(null);
              },
              usernameSaid,
              begin,
            )}
          </div>
        )}
        <div className="h-4" />
      </DoorFrame>
    );
  }

  if (draft.stage === "you") {
    return (
      <DoorFrame
        {...frame}
        title={say("ui.life.title")}
        lockup
        // text:hook-not-explanation: no sentence about the game. Offline, where the door is the first screen, it opens
        // with the start screen's hook and three steps; online the hook was just seen, and the question and the fields carry it.
        line={
          offline ? (
            <div data-door-intro>
              <StartHook heading={false} />
            </div>
          ) : null
        }
        foot={<DoorAction word={say("ui.door.next")} then={say(asked ? "ui.door.ready.title" : "ui.door.next.then")} onClick={() => go(asked ? "ready" : "life")} />}
      >
        {notice === null ? null : (
          <p role="status" className="door-card mx-5 mt-3 px-3.5 py-2.5 text-[14px]">
            {say(notice)}
          </p>
        )}
        <YouScreen
          look={draft.look}
          style={draft.style}
          name={draft.name}
          typed={draft.typed === true}
          problem={problem}
          tried={tried}
          onName={(name) => change({ name, typed: true })}
          onReroll={reroll}
          onLook={chooseLook}
          onStyle={(style) => change({ style })}
          onEnter={() => go(asked ? "ready" : "life")}
        />
      </DoorFrame>
    );
  }

  if (draft.stage === "life") {
    return (
      <DoorFrame {...frame} title={say("ui.door.life")} line={say("ui.door.life.line")} foot={<DoorAction word={say("ui.door.next")} then={say("ui.door.next.home")} onClick={() => go("page")} />}>
        <LifeScreen
          look={draft.look}
          picked={archetype}
          once={once}
          onPick={(tile) => change({ archetype: tile.id, ready: null, age: 0, home: fitHome(tile, 0, draft) })}
          lowest={lowest}
          older={older}
          open={open}
          onStep={step}
        />
      </DoorFrame>
    );
  }

  return (
    <DoorFrame {...frame} title={say("ui.door.ready.title")} line={say("ui.door.ready.hint")}>
      <Board look={draft.look} name={draft.name.trim()} caption={captionOf(draft)} thing={null} onYou={() => change({ stage: "you" })} onLife={null} />
      <ul className="mx-5 mt-4 mb-4 flex flex-col gap-3" data-ready>
        {READY.map((id) => (
          <li key={id} className="door-card flex items-center gap-3 px-3.5 py-3" data-ready-life={id}>
            <div className="min-w-0 flex-1">
              <h2 className="text-[16px] font-bold">{say(`${id}.kind`)}</h2>
              <p className="text-[13px] leading-snug text-text-2">{blurbOf(id)}</p>
            </div>
            <button type="button" className="press-button min-h-11! shrink-0 px-4! text-[15px]!" aria-label={`${say("prologue.door.pick")}: ${say(`${id}.kind`)}`} onClick={() => change({ ready: id, age: 0, stage: "page" })}>
              {say("prologue.door.pick")}
            </button>
          </li>
        ))}
      </ul>
    </DoorFrame>
  );
}
