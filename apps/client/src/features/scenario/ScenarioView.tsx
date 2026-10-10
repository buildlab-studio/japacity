// The front door (prologue.md R-PROLOGUE-009, 010, 011), run as the design's data page onboarding
//, under the hook "What's your japacity?" from the first second (item 18).
// The run is kept as it goes, so a reload at any step comes back to that step; nothing of the life is
// written before Begin.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useGame } from "../../authority/GameProvider";
import { keepPerson } from "../../authority/person";
import { blurbOf, say } from "../../shared/words/text";
import { ARCHETYPES, archetypeOf, FROM_SIXTEEN, throughUniversity } from "../../shared/frontdoor/archetypes";
import { Gate, GateSheet, gateLook } from "../../shared/frontdoor/Gate";
import { LOOKS, lookOf, namesFor } from "../../shared/frontdoor/looks";
import { DataPage, type PageFields, Stamp } from "../../shared/datapage/DataPage";
import { type DoorDraft, type DoorStage, keepDoor, readDoor } from "../../shared/datapage/door";
import { NAME_LONGEST, nameProblem, problemWords } from "../../shared/datapage/name";
import { ageStepWords, stepsOpen } from "../../shared/datapage/age";
import { aboutYears, middleMonths, readyMonths } from "../../shared/datapage/years";

/** The ready lives: every scenario but the life from sixteen, each named by its kind, never its person. */
const READY = (Object.keys(content.scenario) as Id<"scenario">[]).filter((id) => content.scenario[id]?.prologue !== true);
/** The questions, one a screen, for the progress marks over the scene. */
const QUESTIONS: readonly DoorStage[] = ["you", "path", "name", "age", "page"];
const YEAR = 12;
/** How long the stamp sits on the page before the life starts. */
export const STAMP_MS = 900;

function freshRoll(): number {
  return Math.floor(Math.random() * 100000);
}

/** The run as kept, or a new one at the look with the kept look; a run already begun starts again. */
function startDraft(): DoorDraft {
  const kept = readDoor();
  if (kept !== null && kept.stage !== "begun") return { ...kept, look: gateLook(kept.look) };
  return { stage: "you", look: gateLook(kept?.look), archetype: null, ready: null, name: "", roll: freshRoll(), age: 0 };
}

/** The step before, for the back button. */
function before(draft: DoorDraft): DoorStage | null {
  switch (draft.stage) {
    case "you":
    case "begun":
      return null;
    case "path":
      return "you";
    case "ready":
      return "path";
    case "name":
      return draft.ready === null ? "path" : "ready";
    case "age":
      return "name";
    case "page":
      return draft.ready === null ? "age" : "name";
    default: {
      const never: never = draft.stage;
      throw new Error(`Unknown door stage ${String(never)}.`);
    }
  }
}

/** What the page prints for the run so far. */
function fieldsOf(draft: DoorDraft): PageFields {
  const archetype = archetypeOf(draft.archetype);
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

/** Over the scene: the way back, and how far through the questions the run is. */
function Progress({ draft, onBack }: { draft: DoorDraft; onBack: (() => void) | null }) {
  const at = Math.max(0, QUESTIONS.indexOf(draft.stage === "ready" ? "path" : draft.stage));
  return (
    <div className="pointer-events-auto flex h-10 items-center gap-2" data-door-progress>
      {onBack === null ? (
        <span className="size-9" />
      ) : (
        <button type="button" aria-label={say("ui.door.back")} className="press band flex size-9 items-center justify-center rounded-[6px]" onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
      )}
      <div className="flex flex-1 justify-center gap-1.5" aria-hidden>
        {QUESTIONS.map((question, index) => (
          <span key={question} className={`h-1.5 w-7 rounded-[2px] ${index <= at ? "bg-action" : "bg-strong opacity-40"}`} />
        ))}
      </div>
      <span className="label band w-9 rounded-[6px] py-1 text-center text-[10px]">{say("prologue.door.step", { n: at + 1, count: QUESTIONS.length })}</span>
    </div>
  );
}

export function ScenarioView() {
  const notice = useGame((state) => state.notice);
  const chooseLife = useGame((state) => state.chooseLife);
  // The life chooser cannot be opened again where a life is started only once (R-ACCOUNT-015).
  const once = useGame((state) => state.openLifeChooser === null);
  const [draft, setDraft] = useState<DoorDraft>(startDraft);
  const [tried, setTried] = useState(false);
  const [stamped, setStamped] = useState(false);
  const timer = useRef<number | null>(null);
  const sex = lookOf(draft.look)?.sex ?? "f";
  const names = useMemo(() => namesFor(sex, draft.roll), [sex, draft.roll]);

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
  const go = (stage: DoorStage): void => change({ stage });
  const back = before(draft);
  const problem = nameProblem(draft.name);

  // A tile's life asks the age next (R-PROLOGUE-009); a ready life has its own.
  const named = (): void => {
    setTried(true);
    if (problem === null) go(draft.ready === null ? "age" : "page");
  };
  const archetype = archetypeOf(draft.archetype);
  const middle = archetype === null ? null : middleMonths(archetype);
  const open = middle === null ? [0] : stepsOpen(middle);
  const step = (by: number): void => {
    const next = draft.age + by;
    if (open.includes(next)) change({ age: next });
  };

  const begin = (): void => {
    if (stamped) return;
    const scenario = draft.ready === null ? FROM_SIXTEEN : (READY.find((id) => id === draft.ready) ?? FROM_SIXTEEN);
    setStamped(true);
    timer.current = window.setTimeout(() => {
      keepPerson({ look: draft.look, name: draft.name.trim(), archetype: draft.ready === null ? draft.archetype : null });
      change({ stage: "begun" });
      void chooseLife(scenario).catch(() => setStamped(false));
    }, STAMP_MS);
  };

  const over = (
    <>
      <Progress draft={draft} onBack={back === null || stamped ? null : () => go(back)} />
      {/* The hook from the first second (the review): the question over the figure, before the look. */}
      {draft.stage === "you" || draft.stage === "begun" ? (
        <p className="band title mx-auto mt-3 rounded-[6px] px-4 py-2 text-center text-[26px] leading-tight shadow-[0_8px_20px_rgba(10,14,30,0.3)]" data-door-hook>
          {say("prologue.door.hook")}
        </p>
      ) : null}
      {draft.stage === "page" ? (
        <div className="pointer-events-auto mx-auto mt-2 w-full max-w-[420px]">
          <DataPage page={fieldsOf(draft)} print stamp={stamped ? <Stamp words={say("prologue.page.stamp.ready")} turn={-12} big /> : null} />
        </div>
      ) : null}
    </>
  );

  return (
    <Gate look={draft.look} mark={draft.stage} over={over}>
      {draft.stage === "you" || draft.stage === "begun" ? (
        <GateSheet
          key="you"
          mark="you"
          label={say("ui.life.title")}
          foot={
            <button type="button" className="btn-main" onClick={() => go("path")}>
              <span>{say("ui.door.next")}</span>
              <span className="flex items-center gap-1 text-[13px] font-semibold opacity-80">
                {say("ui.door.next.then")} <ArrowRight size={16} />
              </span>
            </button>
          }
        >
          <h1 className="title text-[22px] leading-tight">{say("ui.life.title")}</h1>
          <p className="mt-0.5 text-[13px] leading-snug text-text-2">{say("ui.life.intro")}</p>
          {notice === null ? null : (
            <p role="status" className="mt-3 rounded-[5px] border-l-4 border-l-action bg-sheet-muted p-3 text-[14px]">
              {say(notice)}
            </p>
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
                  onClick={() => change({ look: one.id })}
                  className={`press flex h-[64px] items-end justify-center overflow-hidden rounded-[5px] ${on ? "bg-strong outline-2 outline-offset-1 outline-action" : "bg-sheet-muted"}`}
                >
                  {one.picture === "" ? null : <img src={one.picture} alt="" className="h-[60px] w-auto" draggable={false} />}
                </button>
              );
            })}
          </div>
          <p className="label mt-2 text-center text-[10px] text-text-2">{say("prologue.door.drag")}</p>
        </GateSheet>
      ) : draft.stage === "path" ? (
        <GateSheet key="path" mark="path" label={say("ui.door.path")}>
          <h1 className="title text-[22px] leading-tight">{say("ui.door.path")}</h1>
          <p className="truncate text-[13px] text-text-2">{say("ui.door.path.hint")}</p>
          {once ? (
            <p className="mt-1.5 text-[12px] leading-snug text-text-2" data-door-once>
              {say("prologue.archetype.once")}
            </p>
          ) : null}
          {/* Above the tiles, a small row, so the ready lives are seen without scrolling past the tiles. */}
          <button type="button" className="press mt-2.5 flex w-full items-center justify-between gap-2 rounded-[5px] border border-sheet-line px-3 py-2 text-left" onClick={() => go("ready")} data-ready-card>
            <span className="min-w-0">
              <span className="block text-[14px] font-extrabold">{say("ui.door.ready")}</span>
              <span className="block truncate text-[12px] text-text-2">{say("ui.door.ready.hint")}</span>
            </span>
            <ArrowRight size={16} className="shrink-0" />
          </button>
          <ul className="mt-2.5 grid grid-cols-2 gap-1.5" data-archetypes>
            {ARCHETYPES.map((archetype) => {
              const on = draft.archetype === archetype.id && draft.ready === null;
              return (
                <li key={archetype.id}>
                  <button
                    type="button"
                    data-archetype={archetype.id}
                    aria-label={say(`prologue.archetype.${archetype.id}.name`)}
                    aria-pressed={on}
                    onClick={() => change({ archetype: archetype.id, ready: null, age: 0, stage: "name" })}
                    className={`press flex h-full w-full flex-col items-start rounded-[5px] p-3 text-left ${on ? "bg-strong text-on-strong" : "bg-sheet-muted"}`}
                  >
                    <span className="text-[15px] leading-tight font-extrabold">{say(`prologue.archetype.${archetype.id}.name`)}</span>
                    <span className={`mt-1 text-[12px] leading-snug ${on ? "" : "text-text-2"}`}>{say(`prologue.archetype.${archetype.id}.was`)}</span>
                    <span className="mt-1.5 text-[12px] leading-snug font-bold">{say(`prologue.archetype.${archetype.id}.opens`)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </GateSheet>
      ) : draft.stage === "ready" ? (
        <GateSheet key="ready" mark="ready" label={say("ui.door.ready.title")}>
          <h1 className="title text-[22px] leading-tight">{say("ui.door.ready.title")}</h1>
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
                  onClick={() => change({ ready: id, archetype: null, age: 0, stage: "name" })}
                >
                  {say("prologue.door.pick")}
                </button>
              </li>
            ))}
          </ul>
        </GateSheet>
      ) : draft.stage === "age" && middle !== null ? (
        <GateSheet
          key="age"
          mark="age"
          label={say("prologue.door.age")}
          foot={
            <button type="button" className="btn-main" onClick={() => go("page")}>
              <span>{say("prologue.door.print")}</span>
              <span className="flex items-center gap-1 text-[13px] font-semibold opacity-80">
                {say("prologue.door.print.then")} <ArrowRight size={16} />
              </span>
            </button>
          }
        >
          <h1 className="title text-[22px] leading-tight">{say("prologue.door.age")}</h1>
          <p className="mt-0.5 text-[13px] leading-snug text-text-2">{say("prologue.door.age.hint")}</p>
          <div className="mt-3 flex items-center justify-between rounded-[6px] bg-sheet-muted p-1" data-age-steps>
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
          {/* The cards still take their years: an exam retaken adds one, so the age is "about". */}
          {/* A tile whose years go through the entrance exam: a retake adds a year the door cannot know (R-PROLOGUE-004). */}
          {archetype !== null && throughUniversity(archetype) ? (
            <p className="mt-1.5 text-center text-[12px] leading-snug text-text-2" data-age-give>
              {say("prologue.door.age.give-or-take")}
            </p>
          ) : null}
          <p className="mt-2 text-center text-[14px] font-bold" data-age-does>
            {ageStepWords(draft.age, middle)}
          </p>
        </GateSheet>
      ) : draft.stage === "name" || draft.stage === "age" ? (
        <GateSheet
          key="name"
          mark="name"
          label={say("prologue.door.name.title")}
          foot={
            draft.ready === null ? (
              <button type="button" className="btn-main" onClick={named}>
                <span>{say("ui.door.next")}</span>
                <span className="flex items-center gap-1 text-[13px] font-semibold opacity-80">
                  {say("prologue.door.age")} <ArrowRight size={16} />
                </span>
              </button>
            ) : (
              <button type="button" className="btn-main" onClick={named}>
                <span>{say("prologue.door.print")}</span>
                <span className="flex items-center gap-1 text-[13px] font-semibold opacity-80">
                  {say("prologue.door.print.then")} <ArrowRight size={16} />
                </span>
              </button>
            )
          }
        >
          <label className="title block text-[22px] leading-tight" htmlFor="door-name">
            {say("prologue.door.name.title")}
          </label>
          <p className="mt-0.5 text-[13px] text-text-2">{say("prologue.door.name.hint")}</p>
          <input
            id="door-name"
            className="mt-2.5 h-12 w-full rounded-[6px] border-2 border-sheet-line bg-sheet-muted px-3 text-[17px] font-bold text-text outline-none focus:border-action"
            placeholder={say("prologue.door.name.placeholder")}
            value={draft.name}
            maxLength={NAME_LONGEST + 4}
            autoComplete="off"
            autoCapitalize="words"
            spellCheck={false}
            aria-invalid={tried && problem !== null}
            onChange={(event) => change({ name: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter") named();
            }}
          />
          {tried && problem !== null ? (
            <p role="alert" className="mt-1.5 text-[13px] font-bold text-text">
              {problemWords(problem)}
            </p>
          ) : null}
          <div className="mt-2.5 flex items-center gap-1.5">
            <div className="grid flex-1 grid-cols-3 gap-1.5" role="group" aria-label={say("prologue.door.name.suggested")} data-names>
              {names.map((one) => (
                <button key={one} type="button" onClick={() => change({ name: one })} className={`press truncate rounded-[5px] px-2 py-2.5 text-[15px] font-extrabold ${one === draft.name.trim() ? "bg-strong text-on-strong" : "bg-sheet-muted text-text"}`}>
                  {one}
                </button>
              ))}
            </div>
            <button type="button" className="press flex size-11 shrink-0 items-center justify-center rounded-[5px] bg-sheet-muted text-text-2" aria-label={say("ui.door.reroll")} onClick={() => change({ roll: draft.roll + 1 })}>
              <RefreshCw size={16} />
            </button>
          </div>
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
