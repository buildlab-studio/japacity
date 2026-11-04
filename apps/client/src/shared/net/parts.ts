// world:lazy-part-fails-softly: the parts of the client loaded on first use (the map, the bag, the send-off, the maps abroad and the
// rest). A part that cannot be fetched never reaches the error boundary: the screen that holds the connection card is told, the
// world stays with the part's own waiting in its place, and Retry fetches it again. Once the world is up the parts are fetched
// ahead while the connection is idle, so a drop later costs nothing already fetched.
import { lazy, type LazyExoticComponent, useEffect } from "react";

import { useGameStoreIfAny } from "../../authority/GameProvider";
import { pageStale, type StaleGuard } from "./stale";

/** Any component `lazy` takes, as React types it. */
type AnyComponent = Parameters<typeof lazy>[0] extends () => Promise<{ default: infer C }> ? C : never;

/** Shows the connection card for a part that failed and settles with what Retry brings. */
type Hold = <T>(load: () => Promise<T>) => Promise<T>;

/** The screen showing the connection card, while one is up; with none, a failed part throws to the boundary as any fault. */
let holder: Hold | null = null;

/** A page that is reloading: the part it waited on is never drawn here. */
const GOING = new Promise<never>(() => undefined);

/**
 * A fetch that fails is held for Retry where a card can show; it settles only once the part is fetched. A tab left on an older build
 * reloads once to the server's newer one first (stale.ts), so a part a release removed is never held for a Retry that cannot bring it.
 */
export function fetchSoftly<T>(load: () => Promise<T>, stale: Pick<StaleGuard, "failed"> = pageStale): Promise<T> {
  return load().catch(async (error: unknown) => {
    if (await stale.failed()) return GOING;
    const hold = holder;
    if (hold === null) throw error;
    return hold(() => fetchSoftly(load, stale));
  });
}

export type SoftPart<T extends AnyComponent> = LazyExoticComponent<T> & {
  /** Fetches the part now, quietly: a failure shows nothing, and opening the part fetches it again. */
  ahead: () => Promise<void>;
};

/** How a part is asked for again before the card shows: the pause before each fetch again, and the wait (a test's own clock). */
export interface SoftOptions {
  again?: readonly number[];
  wait?: (ms: number) => Promise<void>;
  /** The check for a newer build once the fetches have failed (a test's own). */
  stale?: Pick<StaleGuard, "failed">;
}

const realWait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** The fetch, made again after each pause while it fails; the last failure is the one handed on. */
function withPauses<T>(load: () => Promise<T>, again: readonly number[], wait: (ms: number) => Promise<void>): () => Promise<T> {
  return async () => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await load();
      } catch (error) {
        const pause = again[attempt];
        if (pause === undefined) throw error;
        await wait(pause);
      }
    }
  };
}

/**
 * A part of the client fetched when first drawn, as `lazy` would, but failing softly. One fetch serves both the fetch ahead and the
 * drawing; a failed fetch is forgotten so the next one goes to the network. A part the world's first load waits on (the place's
 * scene) passes `again`: one failed fetch, as a reload or a dropped connection cuts, is made again after each pause before the card shows, as a failed view is.
 */
export function softLazy<T extends AnyComponent>(load: () => Promise<{ default: T }>, options: SoftOptions = {}): SoftPart<T> {
  let fetched: Promise<{ default: T }> | null = null;
  const once = () => {
    fetched ??= load().catch((error: unknown) => {
      fetched = null;
      throw error;
    });
    return fetched;
  };
  const ahead = () =>
    once().then(
      () => undefined,
      () => undefined,
    );
  const asked = withPauses(once, options.again ?? [], options.wait ?? realWait);
  return Object.assign(
    lazy(() => fetchSoftly(asked, options.stale ?? pageStale)),
    { ahead },
  );
}

/**
 * The game store's hold, while the screen that shows the connection card is up, and the ear for the connection coming back, when a
 * request that failed for it is tried again once. Rendered once, beside that card.
 */
export function HoldParts(): null {
  const store = useGameStoreIfAny();
  useEffect(() => {
    if (store === null) return undefined;
    const hold: Hold = (load) => store.getState().holdPart(load);
    holder = hold;
    const back = () => void store.getState().backOnline();
    window.addEventListener("online", back);
    return () => {
      if (holder === hold) holder = null;
      window.removeEventListener("online", back);
    };
  }, [store]);
  return null;
}

/** The browser's idle wait where it has one (Safari has none), else a short pause. */
function whenIdle(run: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(run, { timeout: 10_000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(run, 2_000);
  return () => window.clearTimeout(id);
}

/** True when the player asked their browser to save data: nothing is fetched before it is opened. */
function savingData(): boolean {
  if (typeof navigator === "undefined") return false;
  return (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
}

/** The browser's turn at once: the next task, so the render that asked commits first. */
function atOnce(run: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const id = window.setTimeout(run, 0);
  return () => window.clearTimeout(id);
}

/**
 * Fetches the parts ahead, one after another, once the page is idle and while it is online, so the world's first moments keep the
 * connection to themselves. Each part is fetched once however often this runs; a failure waits until the part is opened. `now`: the
 * parts are needed next (a returning player's life opens on them), so they are fetched at once, even when the player asked to save
 * data, since they would be fetched the moment the screen opens anyway.
 */
export function useFetchAhead(parts: readonly Pick<SoftPart<AnyComponent>, "ahead">[], when = true, now = false): void {
  useEffect(() => {
    if (!when || (!now && savingData())) return undefined;
    let live = true;
    const cancel = (now ? atOnce : whenIdle)(() => {
      void (async () => {
        for (const part of parts) {
          if (!live || (typeof navigator !== "undefined" && !navigator.onLine)) return;
          await part.ahead();
        }
      })();
    });
    return () => {
      live = false;
      cancel();
    };
  }, [parts, when, now]);
}
