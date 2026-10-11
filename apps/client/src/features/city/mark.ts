// A thing's quiet mark (docs/rules/world.md R-WORLD-005, R-WORLD-021): things show no
// label by default. Each interactive thing carries a small still dot at its anchor, the theme's signal colour at about
// 60%; the thing the nudge points at pulses gently (R-WORLD-003). A tap on the mark, as on the thing, shows its chip.
// The name shows over the dot only while it is named: a person who holds an ask or is the nudge's target, or every
// thing for two seconds the first time a place is entered in a life. Built in the DOM box beside the canvas, which the
// frame loop moves over the thing.
import type { Thing } from "../../shared/world/contract";
import { sceneWords } from "./scene.words";

/** How a mark shows now: its name over the dot, the name taught then fading, the dot pulsing for the nudge. */
export interface MarkShown {
  named: boolean;
  teaching: boolean;
  pulse: boolean;
  /** The state of an act of it in the month's plan ("Ongoing"), shown beside the name when it is named. */
  state?: string | undefined;
}

/** A thing's mark: a tap target round a small dot, with its name over it, hidden until it is named. */
export function markNode(thing: Pick<Thing, "id" | "label">, onTap: () => void): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = "button";
  node.dataset.mark = thing.id;
  node.dataset.thingMark = thing.id;
  node.setAttribute("aria-label", sceneWords(thing.label));
  node.className = "pointer-events-auto absolute flex -translate-x-1/2 -translate-y-full flex-col items-center";
  const name = document.createElement("span");
  name.dataset.markName = "";
  name.className = "chip whitespace-nowrap px-2.5 py-1 text-[12px] font-extrabold";
  name.textContent = sceneWords(thing.label);
  name.hidden = true;
  const tag = document.createElement("span");
  tag.dataset.thingState = "";
  tag.className = "ml-1.5 rounded-[3px] bg-strong px-1.5 py-px align-[1px] text-[10px] font-extrabold text-on-strong";
  tag.hidden = true;
  name.append(tag);
  // The dot sits in a target big enough for a thumb; the dot itself stays small and still.
  const hit = document.createElement("span");
  hit.className = "flex size-8 items-center justify-center";
  const dot = document.createElement("span");
  dot.dataset.markDot = "";
  dot.className = "mark-dot";
  hit.append(dot);
  node.append(name, hit);
  node.style.display = "none";
  node.onclick = onTap;
  return node;
}

/** Shows a mark as it stands now: named or a dot alone, teaching, pulsing for the nudge, with its plan state. */
export function showMark(node: HTMLElement, shown: MarkShown): void {
  const name = node.querySelector<HTMLElement>("[data-mark-name]");
  const tag = node.querySelector<HTMLElement>("[data-thing-state]");
  const dot = node.querySelector<HTMLElement>("[data-mark-dot]");
  const named = shown.named || shown.teaching;
  if (name !== null) {
    name.hidden = !named;
    name.classList.toggle("mark-teach", shown.teaching && !shown.named);
  }
  if (tag !== null) {
    tag.hidden = shown.state === undefined;
    tag.textContent = shown.state ?? "";
  }
  dot?.classList.toggle("mark-pulse", shown.pulse);
  if (named) node.dataset.named = "";
  else delete node.dataset.named;
  if (shown.pulse) node.dataset.nudged = "";
  else delete node.dataset.nudged;
}

/** The things that are people, by their name's words: they speak over their heads and may hold an ask (R-WORLD-005). */
const PEOPLE: ReadonlySet<string> = new Set(["city.thing.mama", "city.thing.papa", "city.thing.mummy", "city.thing.clerk"]);

/** True when the thing is a person at their spot, not a thing. */
export function isPerson(thing: Pick<Thing, "label">): boolean {
  return PEOPLE.has(thing.label);
}

/**
 * The things whose name shows over their mark (R-WORLD-005): a person who holds an ask (an act
 * that opens an open offer or the set piece's question), or the person the nudge points at. Every other thing, and every
 * other person, is a dot until it is tapped.
 */
export function namedThings(things: readonly Pick<Thing, "id" | "label" | "acts">[], nudged: string | null): string[] {
  return things
    .filter((thing) => isPerson(thing) && (thing.id === nudged || thing.acts.some((act) => act.kind === "sheet" && act.stages !== undefined && (act.stages.startsWith("offer.") || act.stages.startsWith("setpiece.")))))
    .map((thing) => thing.id);
}
