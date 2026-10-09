// The front door (prologue.md R-PROLOGUE-009, 010): shown for a new life, or when a saved life could not
// come along. Over the family compound, with the character at the gate, the player builds a person: a
// look from the shipped people, a first name from the pool, and an archetype whose tile starts the
// prologue with its preset. The five ready lives wait behind one card, unnamed. Nobody types.
import { content } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

import { useGame } from "../../authority/GameProvider";
import { keepPerson, readPerson } from "../../authority/person";
import { blurbOf, say } from "../../shared/words/text";
import { ARCHETYPES, type ArchetypeId } from "../../shared/frontdoor/archetypes";
import { Gate, GateSheet, gateLook } from "../../shared/frontdoor/Gate";
import { LOOKS, lookOf, namesFor } from "../../shared/frontdoor/looks";

const FROM_SIXTEEN = "scenario.prologue" as Id<"scenario">;
/** The ready lives: every scenario but the life from sixteen, each named by its kind, never its person. */
const READY = (Object.keys(content.scenario) as Id<"scenario">[]).filter((id) => content.scenario[id]?.prologue !== true);

type Stage = "you" | "path" | "ready";

function freshRoll(): number {
  return Math.floor(Math.random() * 100000);
}

export function ScenarioView() {
  const notice = useGame((state) => state.notice);
  const chooseLife = useGame((state) => state.chooseLife);
  const [stage, setStage] = useState<Stage>("you");
  const [look, setLook] = useState(() => gateLook());
  const [roll, setRoll] = useState(freshRoll);
  const sex = lookOf(look)?.sex ?? "f";
  const names = useMemo(() => namesFor(sex, roll), [sex, roll]);
  const [picked, setPicked] = useState<string | null>(() => readPerson()?.name ?? null);
  const name = picked !== null && names.includes(picked) ? picked : (names[0] ?? "");
  const [starting, setStarting] = useState(false);

  const begin = (scenario: Id<"scenario">, archetype: ArchetypeId | null): void => {
    if (starting) return;
    setStarting(true);
    keepPerson({ look, name, archetype });
    void chooseLife(scenario).finally(() => setStarting(false));
  };

  return (
    <Gate look={look} mark={stage}>
      {stage === "you" ? (
        <GateSheet
          key="you"
          mark="you"
          label={say("ui.life.title")}
          foot={
            <button type="button" className="btn-main" onClick={() => setStage("path")}>
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
              const on = one.id === look;
              return (
                <button
                  key={one.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={say("ui.door.look.one", { n: index + 1 })}
                  data-look={one.id}
                  onClick={() => setLook(one.id)}
                  className={`press flex h-[64px] items-end justify-center overflow-hidden rounded-[5px] ${on ? "bg-strong outline-2 outline-offset-1 outline-action" : "bg-sheet-muted"}`}
                >
                  {one.picture === "" ? null : <img src={one.picture} alt="" className="h-[60px] w-auto" draggable={false} />}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <h2 className="label text-text-2">{say("ui.door.name")}</h2>
            <button type="button" className="press flex items-center gap-1.5 rounded-[5px] px-2 py-1.5 text-[13px] font-bold text-text-2" onClick={() => setRoll((was) => was + 1)}>
              <RefreshCw size={14} /> {say("ui.door.reroll")}
            </button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={say("ui.door.name")} data-names>
            {names.map((one) => {
              const on = one === name;
              return (
                <button
                  key={one}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPicked(one)}
                  className={`press truncate rounded-[5px] px-2 py-2.5 text-[15px] font-extrabold ${on ? "bg-strong text-on-strong" : "bg-sheet-muted text-text"}`}
                >
                  {one}
                </button>
              );
            })}
          </div>
        </GateSheet>
      ) : stage === "path" ? (
        <GateSheet key="path" mark="path" label={say("ui.door.path")}>
          <div className="flex items-center gap-2">
            <button type="button" aria-label={say("ui.door.back")} className="press -ml-1 flex size-9 items-center justify-center rounded-[5px] bg-sheet-muted" onClick={() => setStage("you")}>
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <h1 className="title text-[22px] leading-tight">{say("ui.door.path")}</h1>
              <p className="truncate text-[13px] text-text-2">
                {name}. {say("ui.door.path.hint")}
              </p>
            </div>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-1.5" data-archetypes>
            {ARCHETYPES.map((archetype) => (
              <li key={archetype.id}>
                <button
                  type="button"
                  disabled={starting}
                  data-archetype={archetype.id}
                  aria-label={say(`prologue.archetype.${archetype.id}.name`)}
                  onClick={() => begin(FROM_SIXTEEN, archetype.id)}
                  className="press flex h-full w-full flex-col items-start rounded-[5px] bg-sheet-muted p-3 text-left disabled:opacity-60"
                >
                  <span className="text-[15px] leading-tight font-extrabold">{say(`prologue.archetype.${archetype.id}.name`)}</span>
                  <span className="mt-1 text-[12px] leading-snug text-text-2">{say(`prologue.archetype.${archetype.id}.was`)}</span>
                  <span className="mt-1.5 text-[12px] leading-snug font-bold text-text">{say(`prologue.archetype.${archetype.id}.opens`)}</span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="press mt-3 flex w-full items-center justify-between rounded-[5px] border border-sheet-line px-3 py-3 text-left" onClick={() => setStage("ready")} data-ready-card>
            <span>
              <span className="block text-[15px] font-extrabold">{say("ui.door.ready")}</span>
              <span className="block text-[12px] text-text-2">{say("ui.door.ready.hint")}</span>
            </span>
            <ArrowRight size={18} />
          </button>
        </GateSheet>
      ) : (
        <GateSheet key="ready" mark="ready" label={say("ui.door.ready.title")}>
          <div className="flex items-center gap-2">
            <button type="button" aria-label={say("ui.door.back")} className="press -ml-1 flex size-9 items-center justify-center rounded-[5px] bg-sheet-muted" onClick={() => setStage("path")}>
              <ArrowLeft size={18} />
            </button>
            <h1 className="title text-[22px] leading-tight">{say("ui.door.ready.title")}</h1>
          </div>
          <ul className="mt-3 flex flex-col divide-y divide-sheet-line" data-ready>
            {READY.map((id) => (
              <li key={id} className="flex items-center gap-3 py-3" data-ready-life={id}>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] font-extrabold">{say(`${id}.kind`)}</h2>
                  <p className="text-[13px] leading-snug text-text-2">{blurbOf(id)}</p>
                </div>
                <button type="button" disabled={starting} className="press shrink-0 rounded-[5px] bg-action px-4 py-2.5 text-[14px] font-extrabold text-action-text disabled:opacity-60" aria-label={`${say("ui.door.begin")}: ${say(`${id}.kind`)}`} onClick={() => begin(id, null)}>
                  {say("ui.door.begin")}
                </button>
              </li>
            ))}
          </ul>
        </GateSheet>
      )}
    </Gate>
  );
}
