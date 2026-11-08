// The front door (prologue:front-door-builds-a-person, prologue:front-door-three-screens), in the game's look (a sticker board, the homes stacked as
// postcards), with everything already chosen but the name. You (the name box, empty with a suggestion as its placeholder,
// the dice to fill it, the look strip as round face stickers, your own colours) stands you whole on a
// photo card; Your life so far is the lives swiped sideways with the age under them; Where you live is the homes as
// postcards, then Begin. The page prints after Begin (prologue:printed-page-hands-over). Skip on the first two goes to Where you live;
// Shuffle picks a look and a tile at random, and a new suggestion for an empty box. The ready lives are not on the door: a run Settings asks for lists
// them on the second screen in the place of the tiles. The figure is a sticker of the shipped model, never a turntable.
// The run is kept as it goes, so a reload at any step comes back to that step; nothing of the life is written
// before Begin, and the run is marked begun only once the authority has answered it (engine:browser-authority-for-dev-only). For a tile,
// Begin starts the life at once and the page fills as the years go by (prologue:printed-page-hands-over).
// Online and signed out, the gate hands in the guest start (account:start-screen-over-live-city): Where you live holds the
// username box, empty for the player to type their own and checked as they type (account:username-typed-and-checked), and
// the guest line; Begin makes the guest life before the character. Enter in the box is Begin, and a Begin refused for the
// name brings the box into view and focuses it, the reason under it. The box stands over the homes, so on a small phone
// it and its free or taken line are in view beside Begin before anything is scrolled; the guest line is one line under Begin.
// The name box starts empty on every path and never fills itself: only the dice, or a tap on one of the pool's three names
// under it, puts a name in it. Its placeholder suggests one: signed in with no character (the sign-in path, or a life ended
// on the account), the username was chosen before the door, so the suggestion is from it where it can be a first name, and
// the pool's for the look's sex where it cannot. Begin with the box empty goes back to it, focused, saying the story needs
// a name; Next and Skip pass it. A name the player typed, took or rolled, and a run kept on the device, keep theirs.
// On a desk (`shared/ui/desk`) the same run stands as one layout that stays mounted: the band of steps, the stage with the
// figure and the page filling in beside it, and the panel with the step's choices all at once and the yellow action at its
// foot; the arrows move the pick, Enter is the action and R rolls the name (prologue:front-door-three-screens).
import { type ReactNode, useState } from "react";

import { useGame } from "../../authority/GameProvider";
import { useScreenCount } from "../../shared/analytics/useScreenCount";
import { LEVEL, useBackLayer } from "../../shared/back/back";
import { authorityMode } from "../../shared/net/authorityMode";
import { keepPerson } from "../../shared/front-door/person";
import { blurbOf, say } from "../../shared/words/text";
import { ARCHETYPES, archetypeOf, FROM_SIXTEEN, type Home, homeOf, homesFor } from "../../shared/front-door/archetypes";
import { DoorAction, DoorFrame } from "../../shared/front-door/DoorFrame";
import type { DeskStep } from "../../shared/front-door/DoorDesk";
import { DeskKeys, DeskSlot } from "../../shared/front-door/DeskHost";
import { DeskStage } from "../../shared/front-door/DeskStage";
import { DataPage } from "../../shared/datapage/DataPage";
import { fitHome, pocketIn } from "../../shared/front-door/homes";
import { StartHook } from "../../shared/front-door/Hook";
import { gateLook } from "../../shared/front-door/Gate";
import { LOOKS, lookOf, namesFor } from "../../shared/front-door/looks";
import { isMade } from "../../shared/front-door/style";
import { takeReadyAsk } from "../../shared/front-door/ready";
import { madePhoto } from "../../shared/datapage/photo";
import { type DoorDraft, type DoorStage, keepDoor, readDoor } from "../../shared/datapage/door";
import { nameFromUsername, nameProblem } from "../../shared/datapage/name";
import { startYearFor, stepsOpen } from "../../shared/datapage/age";
import { FINE_POINTER, useDesk, useMedia } from "../../shared/ui/desk";
import { Board, HomeRow, ReadyHome, thingOf } from "./HomeScreen";
import { type DoorKey, movedPick, useDoorKeys } from "../../shared/front-door/keys";
import { AgeCard, LifeGrid, LifeScreen, OnceLine } from "./LifeScreen";
import { livePage, pathWords, READY, readyOf, yearsFor } from "./livePage";
import { LOOK_COLUMNS, LookChoice, MakeItYours, NameField, YouScreen } from "./YouScreen";

export { fitHome, homeFigures, pocketIn, selfContainReached, selfContainYear, startIn } from "../../shared/front-door/homes";
export { plannedYears } from "../../shared/front-door/planned";

/** The three screens, for the dots over the action. */
/** How many lives stand in a row of the desk's grid. */
const LIFE_COLUMNS = 2;
const SCREENS: readonly DoorStage[] = ["you", "life", "page"];

function freshRoll(): number {
  return Math.floor(Math.random() * 100000);
}

function pick<T>(list: readonly T[]): T | undefined {
  return list[Math.floor(Math.random() * list.length)];
}

/** The first name the pool gives for a look on a roll. */
function poolName(look: string, roll: number): string {
  return namesFor(lookOf(look)?.sex ?? "f", roll)[0] ?? "";
}

/** A run with everything chosen but the name: the kept look, the box empty, the first tile at its own age and in its own home. */
function freshDraft(look: string): DoorDraft {
  const first = ARCHETYPES[0];
  return { stage: "you", look, archetype: first?.id ?? null, ready: null, name: "", typed: false, roll: freshRoll(), age: 0, ...(first === undefined ? {} : { home: homeOf(first) }) };
}

/** The name the empty box suggests as its placeholder: the username's where it gives one, else the pool's for the look's sex. */
function suggestionFor(draft: DoorDraft, username: string | null): string {
  const given = username === null ? null : nameFromUsername(username);
  return given ?? (poolName(draft.look, draft.roll) || say("prologue.door.name.placeholder"));
}

/** The run as kept, or a new one with the kept look; a run already begun starts again. Settings' ask starts a run for the ready lives. */
function startDraft(): DoorDraft {
  const kept = readDoor();
  // Settings' "Start from a ready life" opens on the ready lives themselves; Back reaches the name.
  if (takeReadyAsk()) return { ...freshDraft(gateLook(kept?.look)), asked: true, stage: "ready" };
  if (kept !== null && kept.stage !== "begun") return { ...kept, look: gateLook(kept.look) };
  return freshDraft(gateLook(kept?.look));
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
  /** `apart`: the guest line is left out of the fields, for the page to say under Begin. */
  /** `first`: the box is the first field to fill on Where you live, so it takes the focus as the screen opens (account:username-typed-and-checked). */
  fields: (value: string, onChange: (username: string) => void, problem: string | null, onEnter?: () => void, apart?: boolean, first?: boolean) => ReactNode;
  /** The guest line (account:guest-reminded-to-secure), or null for a life that starts kept. */
  reminder: string | null;
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
 * `username`: the account's username where it was chosen before the door (the sign-in path, a later life), null while
 * unknown or where the door asks it last (Play's path); the empty box suggests a name from it (prologue:front-door-builds-a-person).
 */
export function FrontDoor({ guest = null, username: chosen = null }: { guest?: DoorGuest | null; username?: string | null }) {
  const notice = useGame((state) => state.notice);
  const chooseLife = useGame((state) => state.chooseLife);
  // The life chooser cannot be opened again where a life is started only once (account:one-character-per-account).
  const once = useGame((state) => state.openLifeChooser === null);
  // Opened from Settings over a life: the ready lives' back returns to it.
  const backToLife = useGame((state) => (state.view === null ? null : state.closeLifeChooser));
  // The run as it opens is kept at once, so a reload comes back to it.
  const [draft, setDraft] = useState<DoorDraft>(() => {
    const opened = startDraft();
    keepDoor(opened);
    return opened;
  });
  const [tried, setTried] = useState(false);
  // Begin was refused for an empty box: the first screen opens with it focused and says the story needs a name.
  const [needed, setNeeded] = useState(false);
  const [pressed, setPressed] = useState(false);
  // Offline the door is the first screen, so it carries the start screen's hook (text:hook-not-explanation).
  const [offline] = useState(() => authorityMode().authority === "local");
  useScreenCount(doorScreen(draft.stage));
  const [usernameSaid, setUsernameSaid] = useState<string | null>(null);
  const desk = useDesk();
  const fine = useMedia(FINE_POINTER);

  // Kept as it changes, outside the state's updater, so the step is on the device even when the door closes at once.
  const change = (part: Partial<DoorDraft>): void => {
    const next = { ...draft, ...part };
    keepDoor(next);
    setDraft(next);
  };
  const empty = draft.name.trim() === "";
  // An empty box is no problem until Begin: Next and Skip pass it, and only Begin asks for a name.
  const problem = empty ? null : nameProblem(draft.name);
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

  // A new look never touches the name; an empty box's suggestion follows the look's sex on its own.
  const chooseLook = (look: string): void => change({ look });
  // The dice is what puts a name in the box.
  const reroll = (): void => {
    const roll = draft.roll + 1;
    setNeeded(false);
    change({ roll, name: poolName(draft.look, roll), typed: false });
  };
  // Shuffle leaves a name in the box as it stands; an empty box gets a new suggestion with the new roll.
  const shuffle = (): void => {
    const look = pick(LOOKS)?.id ?? draft.look;
    setTried(false);
    const tile = pick(ARCHETYPES) ?? archetype;
    change({ look, roll: freshRoll(), archetype: tile?.id ?? draft.archetype, ready: null, age: 0, homePicked: false, ...(tile === null ? {} : { home: homeOf(tile) }) });
  };

  const begin = (): void => {
    if (pressed) return;
    setTried(true);
    // The placeholder is never the name: an empty box sends the run back to it, focused, saying the story needs one.
    if (empty) {
      setNeeded(true);
      change({ stage: "you" });
      return;
    }
    if (problem !== null) {
      change({ stage: "you" });
      return;
    }
    const ready = readyOf(draft);
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
  // The username box over the homes, online (account:username-typed-and-checked).
  const guestBox =
    guest === null ? null : (
      <div className="door-card mx-5 mt-3 px-4 pt-1 pb-3" data-door-guest>
        {guest.fields(
          username,
          (next) => {
            change({ username: next });
            setUsernameSaid(null);
          },
          usernameSaid,
          begin,
          true,
          true,
        )}
      </div>
    );
  const pickLife = (tile: (typeof ARCHETYPES)[number]): void => change({ archetype: tile.id, ready: null, age: 0, home: fitHome(tile, 0, draft) });
  const pickReady = (id: string): void => change({ ready: id, age: 0, stage: "page" });
  const onward = (): void => go(asked ? "ready" : "life");
  const name = {
    name: draft.name,
    suggestion: suggestionFor(draft, chosen),
    typed: draft.typed === true,
    problem,
    tried,
    needed: needed && empty,
    suggestions: draft.name === "" ? namesFor(lookOf(draft.look)?.sex ?? "f", draft.roll) : [],
    onName: (typed: string) => {
      setNeeded(false);
      change({ name: typed, typed: true });
    },
    onReroll: reroll,
    onEnter: onward,
  };

  // prologue:front-door-three-screens: the desk's keys move the pick on the step's grid, Enter is the yellow action, R rolls the name.
  const homes = archetype === null ? [] : homesFor(archetype).filter((one) => pocketIn(archetype, draft.age, one) >= 0);
  const act = (key: DoorKey): boolean => {
    const action = draft.stage === "you" ? onward : draft.stage === "life" ? () => go("page") : draft.stage === "page" ? begin : null;
    if (key === "go" || action === null) {
      action?.();
      return action !== null;
    }
    if (key === "roll") {
      if (draft.stage === "you") reroll();
      return draft.stage === "you";
    }
    // The step's grid: the looks, the lives, or the homes the life can pay for, a row of `columns` each.
    const [ids, now, columns, pick]: [readonly string[], string, number, (id: string) => void] =
      draft.stage === "you"
        ? [LOOKS.map((one) => one.id), draft.look, LOOK_COLUMNS, chooseLook]
        : draft.stage === "life"
          ? [ARCHETYPES.map((one) => one.id), archetype?.id ?? "", LIFE_COLUMNS, (id) => pickLife(archetypeOf(id) ?? ARCHETYPES[0]!)]
          : [homes, home ?? "", homes.length, (id) => change({ home: id, homePicked: true })];
    const to = movedPick(Math.max(0, ids.indexOf(now)), ids.length, columns, key);
    const id = to === null ? undefined : ids[to];
    if (id !== undefined) {
      const follow = document.activeElement?.getAttribute("role") === "radio";
      pick(id);
      // A pick moved while the focus is on the picked tile takes the focus with it.
      if (follow) window.setTimeout(() => document.querySelector<HTMLElement>("[data-door-panel] [role='radio'][aria-checked='true']")?.focus(), 0);
    }
    return true;
  };
  useDoorKeys(desk && !pressed, act);

  // Each screen's heading, its one line and its foot, the same in both layouts (prologue:front-door-three-screens).
  const head: { title: string; line: ReactNode; foot?: ReactNode } =
    draft.stage === "you"
      ? {
          title: say("ui.life.title"),
          // text:hook-not-explanation: no sentence about the game. Offline, where the door is the first screen, it opens
          // with the start screen's hook and three steps; online the hook was just seen, and the question and the fields carry it.
          line: offline ? (
            <div data-door-intro>
              <StartHook heading={false} />
            </div>
          ) : null,
          foot: <DoorAction word={say("ui.door.next")} then={say(asked ? "ui.door.ready.title" : "ui.door.next.then")} onClick={onward} />,
        }
      : draft.stage === "life"
        ? { title: say("ui.door.life"), line: say("ui.door.life.line"), foot: <DoorAction word={say("ui.door.next")} then={say("ui.door.next.home")} onClick={() => go("page")} /> }
        : draft.stage === "ready"
          ? { title: say("ui.door.ready.title"), line: say("ui.door.ready.hint") }
          : {
              title: say("ui.door.home"),
              line: archetype === null ? null : say("ui.door.home.hint"),
              foot: (
                <>
                  <DoorAction word={say("ui.door.begin")} onClick={begin} disabled={pressed} />
                  {guest === null || guest.reminder === null ? null : (
                    <p className="mt-2 text-center text-[13px] leading-snug text-text-2" data-guest-line>
                      {guest.reminder}
                    </p>
                  )}
                </>
              ),
            };

  if (desk) {
    const reached = draft.stage === "page" || draft.stage === "begun" ? 2 : draft.stage === "you" ? 0 : 1;
    const second: DoorStage = asked || draft.ready !== null ? "ready" : "life";
    const steps: DeskStep[] = [
      { title: say("ui.life.title"), state: reached > 0 ? "done" : "now", onGo: pressed ? null : () => change({ stage: "you" }) },
      { title: say(asked ? "ui.door.ready.title" : "ui.door.life"), state: reached > 1 ? "done" : reached === 1 ? "now" : "ahead", onGo: pressed ? null : () => go(second) },
      { title: say("ui.door.home"), state: reached === 2 ? "now" : "ahead", onGo: null },
    ];
    const deskStage = <DeskStage look={draft.look} style={draft.style} page={<DataPage page={livePage(draft, reached, home ?? READY_HOME)} />} life={draft.stage === "life" ? archetype : null} home={reached === 2 ? (home ?? READY_HOME) : null} />;
    const shared = { mark: draft.stage, look: draft.look, steps, onBack, onShuffle: frame.onShuffle, onSkip: frame.onSkip, stage: deskStage };
    const keys = (word: string, roll: boolean, pick: boolean) =>
      fine ? (
        <DeskKeys
          keys={[
            ...(pick ? [{ caps: ["←", "→"], does: say("ui.door.keys.pick") }] : []),
            ...(roll ? [{ caps: ["R"], does: say("ui.door.reroll") }] : []),
            { caps: [say("ui.door.keys.enter")], does: word },
          ]}
        />
      ) : null;
    const keyed = draft.stage === "you" ? keys(say("ui.door.next"), true, true) : draft.stage === "life" ? keys(say("ui.door.next"), false, true) : draft.stage === "ready" ? null : keys(say("ui.door.begin"), false, homes.length > 1);
    const body =
      draft.stage === "you" ? (
        <>
          {notice === null ? null : (
            <p role="status" className="door-card mx-5 mt-3 px-3.5 py-2.5 text-[14px]">
              {say(notice)}
            </p>
          )}
          <NameField {...name} className="mt-4 px-5" />
          <LookChoice look={draft.look} onLook={chooseLook} grid />
          <MakeItYours look={draft.look} style={draft.style} onStyle={(style) => change({ style })} open />
        </>
      ) : draft.stage === "life" ? (
        <>
          {once ? <OnceLine className="mt-1 px-5" /> : null}
          <LifeGrid picked={archetype} onPick={pickLife} />
          {lowest === null ? null : <AgeCard picked={archetype} lowest={lowest} older={older} open={open} onStep={step} className="door-card mx-5 mt-3 mb-4 px-3.5 py-3" />}
        </>
      ) : draft.stage === "ready" ? (
        <ReadyList className="mx-5 mt-4 mb-4" onPick={pickReady} />
      ) : (
        <>
          {guestBox}
          {archetype === null || home === null ? <ReadyHome home={READY_HOME} low /> : <HomeRow archetype={archetype} years={draft.age} home={home} onHome={(one) => change({ home: one, homePicked: true })} low />}
        </>
      );
    // A life from sixteen hands the desk to its years at Begin: the band and the stage stand on while they open (prologue:printed-page-hands-over).
    return (
      <DeskSlot fill={{ ...shared, title: head.title, line: head.line, keys: keyed }} foot={head.foot ?? null} hands={pressed && archetype !== null}>
        {body}
      </DeskSlot>
    );
  }

  if (draft.stage === "page" || draft.stage === "begun") {
    return (
      <DoorFrame {...frame} {...head}>
        <Board look={draft.look} name={draft.name.trim()} caption={captionOf(draft)} thing={thingOf(archetype)} onYou={pressed ? null : () => change({ stage: "you" })} onLife={pressed ? null : () => change({ stage: draft.ready === null ? "life" : "ready" })} />
        {guestBox}
        {archetype === null || home === null ? <ReadyHome home={READY_HOME} /> : <HomeRow archetype={archetype} years={draft.age} home={home} onHome={(one) => change({ home: one, homePicked: true })} />}
        <div className="h-4" />
      </DoorFrame>
    );
  }

  if (draft.stage === "you") {
    return (
      <DoorFrame {...frame} {...head} lockup>
        {notice === null ? null : (
          <p role="status" className="door-card mx-5 mt-3 px-3.5 py-2.5 text-[14px]">
            {say(notice)}
          </p>
        )}
        <YouScreen {...name} look={draft.look} style={draft.style} onLook={chooseLook} onStyle={(style) => change({ style })} />
      </DoorFrame>
    );
  }

  if (draft.stage === "life") {
    return (
      <DoorFrame {...frame} {...head}>
        <LifeScreen
          look={draft.look}
          picked={archetype}
          once={once}
          onPick={pickLife}
          lowest={lowest}
          older={older}
          open={open}
          onStep={step}
        />
      </DoorFrame>
    );
  }

  return (
    <DoorFrame {...frame} {...head}>
      <Board look={draft.look} name={draft.name.trim()} caption={captionOf(draft)} thing={null} onYou={() => change({ stage: "you" })} onLife={null} />
      <ReadyList className="mx-5 mt-4 mb-4" onPick={pickReady} />
    </DoorFrame>
  );
}

/** The ready lives, each with Pick, for a run Settings asked for. */
function ReadyList({ className, onPick }: { className: string; onPick: (id: string) => void }) {
  return (
    <ul className={`${className} flex flex-col gap-3`} data-ready>
      {READY.map((id) => (
        <li key={id} className="door-card flex items-center gap-3 px-3.5 py-3" data-ready-life={id}>
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-bold">{say(`${id}.kind`)}</h2>
            <p className="text-[13px] leading-snug text-text-2">{blurbOf(id)}</p>
          </div>
          <button type="button" className="press-button min-h-11! shrink-0 px-4! text-[15px]!" aria-label={`${say("prologue.door.pick")}: ${say(`${id}.kind`)}`} onClick={() => onPick(id)}>
            {say("prologue.door.pick")}
          </button>
        </li>
      ))}
    </ul>
  );
}
