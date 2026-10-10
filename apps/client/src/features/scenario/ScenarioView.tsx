// The front door (prologue.md R-PROLOGUE-009, 013): three screens over the family compound with everything already
// chosen, so Next, Next, Begin starts a life. You (the name filled from the pool for the look's sex, a dice for
// another, the look strip), Your life so far (the tiles, the first chosen, with the age under them at the tile's
// own) and Your page (the travel data page with it all printed). Skip on the first two goes to the page; Shuffle
// picks a look, a name and a tile at random. The ready lives are not on the door: a run Settings asks for lists them
// on the second screen in the place of the tiles.
// The run is kept as it goes, so a reload at any step comes back to that step; nothing of the life is written
// before Begin. For a tile, Begin starts the life at once and the page fills as the years go by (R-PROLOGUE-014).
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, Dices, Shuffle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useGame } from "../../authority/GameProvider";
import { keepPerson } from "../../authority/person";
import { blurbOf, say } from "../../shared/words/text";
import { ARCHETYPES, archetypeOf, FROM_SIXTEEN, throughUniversity } from "../../shared/frontdoor/archetypes";
import { Gate, GateSheet, gateLook } from "../../shared/frontdoor/Gate";
import { LOOKS, lookOf, namesFor } from "../../shared/frontdoor/looks";
import { takeReadyAsk } from "../../shared/frontdoor/ready";
import { DataPage, type PageFields, Stamp } from "../../shared/datapage/DataPage";
import { type DoorDraft, type DoorStage, keepDoor, readDoor } from "../../shared/datapage/door";
import { NAME_LONGEST, nameProblem, problemWords } from "../../shared/datapage/name";
import { ageStepWords, stepsOpen } from "../../shared/datapage/age";
import { aboutYears, middleMonths, readyMonths } from "../../shared/datapage/years";

/** The ready lives: every scenario but the life from sixteen, each named by its kind, never its person. */
const READY = (Object.keys(content.scenario) as Id<"scenario">[]).filter((id) => content.scenario[id]?.prologue !== true);
/** The three screens, for the progress marks over the scene. */
const SCREENS: readonly DoorStage[] = ["you", "life", "page"];
const YEAR = 12;
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

/** A run with everything chosen: the kept look, a name for it, the first tile at its own age. */
function freshDraft(look: string): DoorDraft {
  const roll = freshRoll();
  return { stage: "you", look, archetype: ARCHETYPES[0]?.id ?? null, ready: null, name: filledName(look, roll), typed: false, roll, age: 0 };
}

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
  const months = archetype !== null ? middleMonths(archetype) + draft.age * YEAR : ready !== null ? readyMonths(ready) : null;
  return {
    name: draft.name.trim(),
    age: months === null ? "" : say("prologue.page.age.about", { years: aboutYears(months) }),
    path: archetype !== null ? say(`prologue.archetype.${archetype.id}.name`) : ready !== null ? say(`${ready}.kind`) : "",
    ready: say("prologue.page.ready.figure", { percent: 0 }),
    photo: lookOf(draft.look)?.picture ?? "",
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

export function ScenarioView() {
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
  // Every way on checks the name first: a name that fails sends the run back to it, saying why.
  const go = (stage: DoorStage): void => {
    setTried(true);
    if (problem !== null && stage !== "you") change({ stage: "you" });
    else change({ stage });
  };
  const back = before(draft);

  const archetype = draft.ready === null ? archetypeOf(draft.archetype) : null;
  const middle = archetype === null ? null : middleMonths(archetype);
  const open = middle === null ? [0] : stepsOpen(middle);
  const step = (by: number): void => {
    const next = draft.age + by;
    if (open.includes(next)) change({ age: next });
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
    change({ look, roll, name: filledName(look, roll), typed: false, archetype: pick(ARCHETYPES)?.id ?? draft.archetype, ready: null, age: 0 });
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
      keepPerson({ look: draft.look, name: draft.name.trim(), archetype: ready === null ? draft.archetype : null });
      change({ stage: "begun" });
      void chooseLife(ready ?? FROM_SIXTEEN).catch(() => setStamped(false));
    };
    setStamped(true);
    // A ready life is stamped here; a tile's page is stamped once its years are filled in (R-PROLOGUE-014).
    if (ready === null) start();
    else timer.current = window.setTimeout(start, STAMP_MS);
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
    <Gate look={draft.look} mark={draft.stage} over={over}>
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
                    onClick={() => change({ archetype: tile.id, ready: null, age: 0 })}
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
          {middle === null ? null : (
            <section className="mt-3" aria-label={say("prologue.door.age")} data-door-age>
              <h2 className="label text-text-2">{say("prologue.door.age")}</h2>
              <div className="mt-1.5 flex items-center justify-between rounded-[6px] bg-sheet-muted p-1" data-age-steps>
                <button type="button" className="press flex size-11 items-center justify-center rounded-[5px] bg-sheet disabled:opacity-40" aria-label={say("prologue.door.age.younger")} disabled={!open.includes(draft.age - 1)} onClick={() => step(-1)}>
                  <ChevronLeft size={20} />
                </button>
                <p className="title num text-[22px]" data-age-years>
                  {say("prologue.door.age.years", { years: aboutYears(middle + draft.age * YEAR) })}
                </p>
                <button type="button" className="press flex size-11 items-center justify-center rounded-[5px] bg-sheet disabled:opacity-40" aria-label={say("prologue.door.age.older")} disabled={!open.includes(draft.age + 1)} onClick={() => step(1)}>
                  <ChevronRight size={20} />
                </button>
              </div>
              {/* A tile whose years go through the entrance exam: a retake adds a year the door cannot know (R-PROLOGUE-004). */}
              {archetype !== null && throughUniversity(archetype) ? (
                <p className="mt-1.5 text-center text-[12px] leading-snug text-text-2" data-age-give>
                  {say("prologue.door.age.give-or-take")}
                </p>
              ) : null}
              <p className="mt-1.5 text-center text-[13px] font-bold" data-age-does>
                {ageStepWords(draft.age, middle)}
              </p>
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
        </GateSheet>
      )}
    </Gate>
  );
}
