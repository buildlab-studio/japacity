// The front door (prologue.md R-PROLOGUE-009, 013), in its lively dress (a sticker board, the homes stacked as
// postcards), with everything already chosen so Next, Next, Begin starts a life. You (the name filled from the pool
// for the look's sex, a dice for another, the look strip as round face stickers, your own colours) stands you whole on a
// photo card; Your life so far is the lives swiped sideways with the age under them; Where you live is the homes as
// postcards, then Begin. The page prints after Begin (R-PROLOGUE-014). Skip on the first two goes to Where you live;
// Shuffle picks a look, a name and a tile at random. The ready lives are not on the door: a run Settings asks for lists
// them on the second screen in the place of the tiles. The figure is a sticker of the shipped model, never a turntable.
// The run is kept as it goes, so a reload at any step comes back to that step; nothing of the life is written
// before Begin, and the run is marked begun only once the authority has answered it (R-ENGINE-015). For a tile,
// Begin starts the life at once and the page fills as the years go by (R-PROLOGUE-014).
// Online and signed out, the gate hands in the guest start (account.md R-ACCOUNT-029): Where you live holds the
// username, filled in from the name and changed there, and the guest line; Begin makes the guest life before the character.
import { content } from "@japacity/content";
import { type Id } from "@japacity/sim";
import { type ReactNode, useState } from "react";

import { useGame } from "../../authority/GameProvider";
import { useScreenCount } from "../../useScreenCount";
import { authorityMode } from "../../authority/mode";
import { keepPerson } from "../../authority/person";
import { blurbOf, say } from "../../shared/words/text";
import { ARCHETYPES, archetypeOf, FROM_SIXTEEN, type Home, homeOf } from "../../shared/frontdoor/archetypes";
import { DoorAction, DoorFrame } from "../../shared/frontdoor/DoorFrame";
import { fitHome } from "../../shared/frontdoor/homes";
import { StartHook } from "../../shared/frontdoor/Hook";
import { gateLook } from "../../shared/frontdoor/Gate";
import { LOOKS, lookOf, namesFor } from "../../shared/frontdoor/looks";
import { isMade } from "../../shared/frontdoor/style";
import { takeReadyAsk } from "../../shared/frontdoor/ready";
import { madePhoto } from "../../shared/datapage/photo";
import { type DoorDraft, type DoorStage, keepDoor, readDoor } from "../../shared/datapage/door";
import { nameProblem } from "../../shared/datapage/name";
import { startYearFor, stepsOpen } from "../../shared/datapage/age";
import { readyMonths, yearsOf } from "../../shared/datapage/years";
import { Board, HomeRow, ReadyHome, thingOf } from "./HomeScreen";
import { LifeScreen } from "./LifeScreen";
import { YouScreen } from "./YouScreen";

export { fitHome, homeFigures, pocketIn, selfContainReached, selfContainYear, startIn } from "../../shared/frontdoor/homes";
export { plannedYears } from "../../shared/frontdoor/planned";

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

/** The guest start the gate hands in online (account.md R-ACCOUNT-021, 024, 029); the account feature's GuestDoor. */
export interface DoorGuest {
  fill: (name: string) => string;
  check: (username: string) => string | null;
  fields: (value: string, onChange: (username: string) => void, problem: string | null) => ReactNode;
  /** Null once the guest life is made; otherwise what to say by the username. */
  start: (username: string, filled: boolean) => Promise<string | null>;
  started: () => Promise<void>;
  /** After a failed character start: what to say when the guest must be made again by the next Begin, or null. */
  lost: (error: unknown) => string | null;
}

/**
 * R-ANALYTICS-002, R-ANALYTICS-008: the front door's screens as the funnel counts them: the first door,
 * the second (an archetype or a ready life), and the third, Where you live with Begin, still counted as the page it
 * stood in for. Begun is no screen of its own.
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
  // Offline the door is the first screen, so it carries the start screen's hook (R-TEXT-006).
  const [offline] = useState(() => authorityMode().authority === "local");
  useScreenCount(doorScreen(draft.stage));
  // The username as typed on Where you live; null while the name fills it in.
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
      // The player's own colours, and the photo drawn in them (or as made) as the page printed, are kept with the person (R-PROLOGUE-015).
      const style = isMade(draft.style) ? undefined : draft.style;
      const photo = madePhoto(draft.look, style);
      keepPerson({ look: draft.look, name: draft.name.trim(), archetype: ready === null ? draft.archetype : null, ...(style === undefined ? {} : { style }), ...(photo === undefined ? {} : { photo: photo.photo, photoPx: photo.px }) });
      // R-ENGINE-015: Begin is one request, and its answer the point of no return. Until it comes the run stays on the
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
          // R-ACCOUNT-021: a guest whose session was gone by the character's start is made again by the next Begin, and the page says so.
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
                setTypedUsername(next);
                setUsernameSaid(null);
              },
              usernameSaid,
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
        // R-TEXT-006: no sentence about the game. Offline, where the door is the first screen, it opens
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
