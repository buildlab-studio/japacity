// A chosen thing's chip (docs/rules/world.md R-WORLD-005): its name and its one or two acts, built in the DOM box
// beside the canvas, which the frame loop moves over the thing.
import type { Act, Thing } from "../../shared/world/contract";
import { sceneWords } from "./scene.words";

/**
 * A thing's name and its one or two acts, floating over it with a small arrow down to it (R-WORLD-005). An act that
 * carries on in the plan (R-WORLD-007) says "Ongoing" with a stop beside it, which `onStop` takes out of the plan.
 */
export function chipNode(thing: Thing, onAct: (act: Act) => void, onStop: (act: Act) => void = () => undefined): HTMLDivElement {
  const chip = document.createElement("div");
  chip.dataset.thingChip = thing.id;
  chip.setAttribute("role", "group");
  chip.setAttribute("aria-label", sceneWords(thing.label));
  chip.className = "pointer-events-auto absolute -translate-x-1/2 -translate-y-full pb-2";
  chip.style.display = "none";
  const body = document.createElement("div");
  body.className = "panel chip-in flex flex-col items-center gap-1.5 px-3 pt-2 pb-2.5";
  const name = document.createElement("p");
  name.className = "title text-[15px] leading-tight whitespace-nowrap";
  name.textContent = sceneWords(thing.label);
  // A person the game plays carries its quiet mark beside the name, as on every screen (people.md R-PEOPLE-009, R-PEOPLE-054).
  if (thing.mark !== undefined) name.append(markTag(thing.mark));
  const acts = document.createElement("div");
  acts.className = "flex gap-1.5";
  for (const act of thing.acts) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.act = act.id;
    // The activity a sheet act opens, for tests and the play driver (the nudge names it in data-nudge-opens).
    if (act.kind === "sheet" && act.stages !== undefined) button.dataset.activity = act.stages;
    // An act that carries on in the plan says "Ongoing" and is shut, with a stop beside it (R-WORLD-007).
    if (act.planned === true) {
      button.className = "rounded-[5px] border border-sheet-line bg-sheet-muted px-3 py-2 text-[13px] font-extrabold whitespace-nowrap text-text-2";
      button.textContent = sceneWords("ui.world.thing.planned");
      button.setAttribute("aria-label", `${sceneWords(act.label)}: ${sceneWords("ui.world.thing.planned")}`);
      button.disabled = true;
      button.dataset.planned = "";
      const stop = document.createElement("button");
      stop.type = "button";
      stop.dataset.actStop = act.id;
      stop.className = "rounded-[5px] bg-sheet-muted px-3 py-2 text-[13px] font-extrabold whitespace-nowrap";
      stop.textContent = sceneWords("ui.world.stop");
      stop.setAttribute("aria-label", sceneWords("ui.world.stop-act", { what: sceneWords(act.label) }));
      stop.onclick = () => onStop(act);
      acts.append(button, stop);
      continue;
    }
    button.className = "rounded-[5px] bg-action px-3 py-2 text-[13px] font-extrabold whitespace-nowrap text-action-text";
    button.textContent = sceneWords(act.label);
    button.onclick = () => onAct(act);
    acts.append(button);
  }
  const arrow = document.createElement("div");
  arrow.className = "absolute bottom-0 left-1/2 size-0 -translate-x-1/2 border-x-8 border-t-8 border-x-transparent border-t-sheet";
  body.append(name, acts);
  chip.append(body, arrow);
  return chip;
}

/**
 * The small `computer` tag beside a person's name, in the words the people's cards use: quiet, in the case a person
 * writes it, never shouted in capitals (text.md R-TEXT-005, people.md R-PEOPLE-009).
 */
export function markTag(mark: NonNullable<Thing["mark"]>): HTMLSpanElement {
  const tag = document.createElement("span");
  tag.dataset.personMark = mark;
  tag.className = "ml-1.5 rounded-[3px] border border-sheet-line px-1.5 py-px align-[2px] text-[12px] font-semibold text-text-2";
  tag.textContent = sceneWords(`ui.people.mark.${mark}`);
  return tag;
}
