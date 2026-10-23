// world:back-closes-topmost: the browser's Back (a phone's back button or gesture) and the Escape key close the topmost thing the
// player opened, one at a time. Each thing open is a layer; each layer stands on one history entry at the page's own address, so
// the address bar never changes. A close by the game's own control takes its entry off again, so Back never steps through
// things already closed; with nothing open, Back leaves the game as it leaves any site. A beat that holds (a ride under way, a
// cut, the send-off) keeps its entry: Back there closes nothing until it ends. world:reach-and-read: while a layer that covers
// the scene stands, the scene behind is inert.
//
// The entries carry how deep they stand (`japacityBack` in the history state), so a landing tells how many layers the player
// went back through, and an entry reached forward after its layer closed is stepped back over.
import { useEffect, useRef, useSyncExternalStore } from "react";

/** The key the depth is kept under in the history state, beside whatever else the state holds. */
const KEY = "japacityBack";

/**
 * Where a layer stands among others opened at once: a thing opened inside another mounts before it (a child's effect runs
 * first), so the order is by level, then by opening.
 */
export const LEVEL = {
  /** A step of the start screen and the age screen. */
  step: 0,
  /** The door's second screen; its third stands one higher. */
  door: 1,
  map: 1,
  phone: 1,
  /** An app on the phone, and a ride's sheet over the map. */
  app: 2,
  ride: 2,
  /** An app's inner screen (a Chats thread). */
  inner: 3,
  sheet: 4,
  /** A beat Back waits on. */
  hold: 9,
} as const;

export interface BackLayerOptions {
  level?: number;
  /** Back and Escape close nothing while it stands. */
  hold?: boolean;
  /** The scene behind is inert while it stands. */
  cover?: boolean;
}

interface Layer {
  seq: number;
  level: number;
  hold: boolean;
  cover: boolean;
  close: () => void;
  /** Closed by Back or Escape, its entry already taken off, while its owner puts it away. */
  closing: boolean;
}

export interface BackStack {
  /** Opens a layer; the function returned is its close, by whatever control. */
  add: (layer: { level: number; hold: boolean; cover: boolean; close: () => void }) => () => void;
  /** Replaces the address the page shows, keeping the entries; Back keeps showing it. */
  replace: (url: string) => void;
  covered: () => boolean;
  subscribe: (listener: () => void) => () => void;
  dispose: () => void;
}

function depthOf(state: unknown): number {
  if (typeof state !== "object" || state === null) return 0;
  const value = (state as Record<string, unknown>)[KEY];
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 0;
}

function addressOf(win: Window): string {
  return `${win.location.pathname}${win.location.search}${win.location.hash}`;
}

let live: BackStack | null = null;

export function createBack(win: Window): BackStack {
  const history = win.history;
  let layers: Layer[] = [];
  let seq = 0;
  /** The depth the page stood at when last seen: the count of layers Back went through is told against it. */
  let known = depthOf(history.state);
  let travelling = false;
  let scheduled = false;
  let address = addressOf(win);
  let wasCovered = false;
  const listeners = new Set<() => void>();

  const open = (): Layer[] => layers.filter((layer) => !layer.closing);
  const isCovered = (): boolean => open().some((layer) => layer.cover);

  const tell = (): void => {
    const now = isCovered();
    if (now === wasCovered) return;
    wasCovered = now;
    for (const listener of listeners) listener();
  };

  /** Brings the entries to the layers open: one pushed for each opened, the page sent back over each closed. */
  const sync = (): void => {
    scheduled = false;
    tell();
    if (travelling) return;
    const want = open().length;
    // The state is read each time: a page that replaced it (a test, an old link's cleanup) is met where it stands.
    let actual = depthOf(history.state);
    if (want > actual) {
      address = addressOf(win);
      while (actual < want) {
        actual += 1;
        const base = typeof history.state === "object" && history.state !== null ? (history.state as Record<string, unknown>) : {};
        history.pushState({ ...base, [KEY]: actual }, "");
      }
      known = actual;
    } else if (want < actual) {
      travelling = true;
      known = want;
      history.go(want - actual);
    } else {
      known = actual;
    }
  };

  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(sync);
  };

  /** Back closes from the top down, as far as the player went; a beat that holds stops it there, and its entries stand again. */
  const closeTop = (count: number): void => {
    const shown = open();
    for (let index = shown.length - 1; index >= 0 && count > 0; index -= 1, count -= 1) {
      const layer = shown[index];
      if (layer === undefined || layer.hold) break;
      layer.closing = true;
      layer.close();
    }
  };

  const onPop = (event: PopStateEvent): void => {
    const landed = depthOf(event.state);
    // Back never moves the address: the page shows what it showed before.
    if (addressOf(win) !== address) history.replaceState(history.state, "", address);
    if (travelling) {
      travelling = false;
      known = landed;
      schedule();
      return;
    }
    const before = known;
    known = landed;
    if (landed < before) closeTop(before - landed);
    schedule();
  };

  const onKey = (event: KeyboardEvent): void => {
    // A dialog that heard Escape itself closed its own sheet; an input method still composing keeps it.
    if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
    const top = open().at(-1);
    if (top === undefined || top.hold) return;
    event.preventDefault();
    top.closing = true;
    top.close();
    schedule();
  };

  win.addEventListener("popstate", onPop);
  win.addEventListener("keydown", onKey);

  const stack: BackStack = {
    add: ({ level, hold, cover, close }) => {
      seq += 1;
      const layer: Layer = { seq, level, hold, cover, close, closing: false };
      layers = [...layers, layer].sort((a, b) => a.level - b.level || a.seq - b.seq);
      schedule();
      return () => {
        layers = layers.filter((candidate) => candidate !== layer);
        schedule();
      };
    },
    replace: (url) => {
      history.replaceState(history.state, "", url);
      address = addressOf(win);
    },
    covered: () => wasCovered,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: () => {
      win.removeEventListener("popstate", onPop);
      win.removeEventListener("keydown", onKey);
      layers = [];
      listeners.clear();
      if (live === stack) live = null;
    },
  };
  live = stack;
  // A page reloaded on entries of its own steps back to the first once it knows nothing is open.
  if (known > 0) schedule();
  return stack;
}

/** The page's one stack, made on first use (a test makes its own with `createBack`); none outside a browser. */
function sharedBack(): BackStack | null {
  if (live !== null) return live;
  if (typeof window === "undefined") return null;
  return createBack(window);
}

/**
 * world:back-closes-topmost: while `open`, the thing is a layer Back and Escape close by `close`, its owner's own way of
 * putting it away (which may first play its motion). When it closes by any other control its entry is taken off.
 */
export function useBackLayer(open: boolean, close: () => void, { level = LEVEL.sheet, hold = false, cover = false }: BackLayerOptions = {}): void {
  const stack = sharedBack();
  const latest = useRef(close);
  latest.current = close;
  useEffect(() => {
    if (!open || stack === null) return undefined;
    return stack.add({ level, hold, cover, close: () => latest.current() });
  }, [open, stack, level, hold, cover]);
}

const NOTHING = (): void => undefined;

/** world:back-closes-topmost: while `active`, Back and Escape wait: a ride under way, a cut, the send-off's beats. */
export function useBackHold(active: boolean): void {
  useBackLayer(active, NOTHING, { level: LEVEL.hold, hold: true });
}

/** world:reach-and-read: true while a layer that covers the scene stands; the scene is then inert. */
export function useSceneCovered(): boolean {
  const stack = sharedBack();
  return useSyncExternalStore(
    (listener) => stack?.subscribe(listener) ?? NOTHING,
    () => stack?.covered() ?? false,
    () => false,
  );
}

/** Replaces the address the page shows without a reload (the replace-only writes), keeping the game's entries under it. */
export function replaceAddress(url: string): void {
  const stack = sharedBack();
  if (stack !== null) stack.replace(url);
  else if (typeof history !== "undefined") history.replaceState(history.state, "", url);
}
