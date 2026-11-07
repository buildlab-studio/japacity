// The desk's keys (prologue:front-door-three-screens): the arrows move the pick, Enter is the yellow action, R rolls the name.
// A key acts only where the focus is not in a text box, a select or the age stepper, and never with Ctrl, Alt or Cmd held:
// typing a name or a username is never taken. Enter on a focused button or link is that control's own.
import { useEffect, useRef } from "react";

export type DoorKey = "before" | "after" | "up" | "down" | "go" | "roll";

/** What the pressed key asks of the door, or null where it is the focus's own or not the door's. */
export function doorKey(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "altKey" | "metaKey" | "isComposing">, focus: Element | null): DoorKey | null {
  if (event.ctrlKey || event.altKey || event.metaKey || event.isComposing) return null;
  if (focus !== null && focus.closest("input, textarea, select, [contenteditable], [data-age-steps], [role='dialog']") !== null) return null;
  const control = focus !== null && focus.closest("button, a[href]") !== null;
  switch (event.key) {
    case "ArrowLeft":
      return "before";
    case "ArrowRight":
      return "after";
    case "ArrowUp":
      return "up";
    case "ArrowDown":
      return "down";
    case "Enter":
      return control ? null : "go";
    case "r":
    case "R":
      return "roll";
    default:
      return null;
  }
}

/** The pick moved by a key in a grid of `columns`: one before or after, or a row up or down; null where it would leave the grid. */
export function movedPick(at: number, count: number, columns: number, key: Exclude<DoorKey, "go" | "roll">): number | null {
  const by = key === "before" ? -1 : key === "after" ? 1 : key === "up" ? -columns : columns;
  const next = at + by;
  return next >= 0 && next < count ? next : null;
}

/** Listens for the door's keys while `on`; `act` returns true where it took the key, which then does nothing else. */
export function useDoorKeys(on: boolean, act: (key: DoorKey) => boolean): void {
  const latest = useRef(act);
  latest.current = act;
  useEffect(() => {
    if (!on) return;
    const pressed = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) return;
      // The key's own target, never the focus after it: a box's Enter that moved the door on has unmounted the box by now.
      const key = doorKey(event, event.target instanceof Element && event.target !== document.body ? event.target : null);
      if (key === null) return;
      if (latest.current(key)) event.preventDefault();
    };
    window.addEventListener("keydown", pressed);
    return () => window.removeEventListener("keydown", pressed);
  }, [on]);
}
