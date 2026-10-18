// The bed's sleep (docs/rules/world.md R-WORLD-025, R-WORLD-005; decision 0011): a timed act on the bed, at any hour of the world's day. The month turns only
// when the sleep runs out; waking first makes it a nap, and the night goes on.
import type { DayPart, Id } from "@japacity/sim";

import type { PlayerCommand } from "../../../authority/store";
import type { Act, Thing } from "../../../shared/world/contract";
import type { World } from "../../../shared/scene/world";

/** How long a sleep lasts before the month turns: long enough to choose to wake, short enough to wait out. */
export const SLEEP_MS = 36_000;

/** The nap a sleep cut short becomes, so the rest lands as a nap's. */
export const NAP = "activity.nap" as Id<"activity">;

/**
 * The sleep's length: `SLEEP_MS`, or in a development build the seconds asked for with `?sleep=<seconds>`, for pictures
 * and play; a build for players never reads the switch.
 */
export function sleepMsOf(search: string, dev: boolean = import.meta.env.DEV): number {
  if (!import.meta.env.DEV || !dev) return SLEEP_MS;
  const asked = new URLSearchParams(search).get("sleep");
  const seconds = asked === null || asked.trim() === "" ? Number.NaN : Number(asked);
  return Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds * 1000) : SLEEP_MS;
}

/**
 * How the figure lies down to sleep: the lying pose the bed's own acts already carry (its nap, or the Lie down standing in
 * for it), on the same seat and top, so every home's bed is slept in as it is napped on. Null for a thing with no lying act.
 */
export function bedLie(thing: Pick<Thing, "acts">): Pick<Act, "pose" | "seat" | "top"> | null {
  const lying = thing.acts.flatMap((act) => [act, ...(act.otherwise === undefined ? [] : [act.otherwise])]).find((act) => act.pose === "lie");
  if (lying === undefined) return null;
  return { pose: "lie", ...(lying.seat === undefined ? {} : { seat: lying.seat }), ...(lying.top === undefined ? {} : { top: lying.top }) };
}

/** What a sleep cut short sends: the nap, when the view allows one now; otherwise nothing. */
export function wakeCommand(activities: readonly { id: string; allowed: boolean }[]): PlayerCommand | null {
  return activities.some((option) => option.id === NAP && option.allowed) ? { type: "activity/now", activity: NAP, param: null } : null;
}

/** The corner's words on waking: the night still to be had in the evening and at night; by day, only that you are up. */
export function wokeWords(part: DayPart): "ui.sleep.woke" | "ui.sleep.woke.day" {
  return part === "night" || part === "evening" ? "ui.sleep.woke" : "ui.sleep.woke.day";
}

/**
 * The small sleep mark over the bed while the sleep runs (R-WORLD-025): three "z" in the game's own type, each growing in
 * and fading out in turn, on scale and opacity alone. Built in the DOM box beside the canvas, which the frame loop moves
 * over the bed as it moves the things' marks.
 */
export function sleepMarkNode(): HTMLDivElement {
  const node = document.createElement("div");
  node.dataset.asleepMark = "";
  node.setAttribute("aria-hidden", "true");
  node.className = "pointer-events-none absolute flex -translate-x-1/2 -translate-y-full items-end gap-0.5 font-extrabold text-on-strong [text-shadow:0_1px_3px_rgba(10,14,30,0.7)]";
  node.style.display = "none";
  [15, 20, 26].forEach((size, index) => {
    const z = document.createElement("span");
    z.className = "sleep-z";
    z.textContent = "z";
    z.style.fontSize = `${String(size)}px`;
    z.style.marginBottom = `${String(index * 10)}px`;
    z.style.animationDelay = `${String(index * 0.7)}s`;
    node.append(z);
  });
  return node;
}

/**
 * Eyes closed (R-WORLD-025), since the family standing round the bed while you sleep looks wrong: while the sleep runs, the others in the place, the crowd, the dancers and those standing at a thing of their
 * own, are not seen, under the wash; the sleeper alone stays. Waking, or the sleep running out, brings them back.
 */
export function othersSeen(world: Pick<World, "crowd" | "dancers" | "standers">, seen: boolean): void {
  for (const placed of world.crowd) placed.figure.root.visible = seen;
  for (const dancer of world.dancers) dancer.figure.root.visible = seen;
  for (const figure of world.standers) figure.root.visible = seen;
}
