// Keeps an online store fresh: the authority's reports into the store, the
// nudge socket for the character's place, the world on its schedule, and a
// fetch when the tab comes back into focus (R-CLOCK-019, R-CLOCK-021 to 023),
// or comes back at all: shown again from the back-forward cache, or visible
// again after the phone slept or the browser was left (R-ENGINE-015).
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";

import { openingPlace } from "../shared/scene/staging";

import { deviceRandom, type RandomBelow } from "../shared/net/random";
import { browserSocket, nudgeSocket, type NudgeSocket, type OpenSocket } from "../shared/net/socket";
import { failureOf } from "../shared/net/http";
import { worldSchedule } from "../shared/net/world";
import type { RemoteAuthority } from "./remote";
import type { GameStore } from "./store";

export interface OnlineOptions {
  store: GameStore;
  remote: RemoteAuthority;
  open?: OpenSocket;
  random?: RandomBelow;
  now?: () => number;
  /** Where focus and `pageshow` are heard. Null in tests that do not need it. */
  focus?: Pick<Window, "addEventListener" | "removeEventListener"> | null;
  /** Where `visibilitychange` is heard, and whether the page is visible. Null in tests that do not need it. */
  page?: Pick<Document, "addEventListener" | "removeEventListener" | "visibilityState"> | null;
}

/** A side fetch that failed: said in the console by its kind, for whoever reads it, never to the player. */
function noted(what: string, error: unknown): void {
  console.warn(`Japacity: ${what} was not fetched (${failureOf(error) ?? "fault"}).`);
}

const PLACES = Object.values(content.place);

/**
 * The place a character's socket and presence are for: a content place id, as
 * the server's place routes require, and the one the city opens on. The
 * server's `placeOfIn` answers the same hub, or the socket would be refused.
 */
export function placeOf(view: PlayerView): string {
  return openingPlace({ where: view.place.where, country: view.place.country }, PLACES);
}

/** Starts it all, and returns the function that stops it. */
export function goOnline(options: OnlineOptions): () => void {
  const { store, remote } = options;
  const open = options.open ?? browserSocket;
  const random = options.random ?? deviceRandom;
  const now = options.now ?? (() => Date.now());
  const focus = options.focus === undefined ? (typeof window === "undefined" ? null : window) : options.focus;
  const page = options.page === undefined ? (typeof document === "undefined" ? null : document) : options.page;

  const refresh = () => {
    const state = store.getState();
    if (!state.signedOut) void state.refresh();
  };

  async function fetchWorld(): Promise<void> {
    try {
      store.setState({ world: await remote.world() });
    } catch (error) {
      // The world is shown only through the view: the refresh below brings it, and tells the player if it cannot.
      noted("the world", error);
    }
    refresh();
  }

  async function fetchPresence(place: string): Promise<void> {
    try {
      const presence = await remote.presence(place);
      if (store.getState().view !== null) store.setState({ presence });
    } catch (error) {
      // Presence is a sample for colour: the last one stays, and the next nudge asks again.
      noted("who is here", error);
    }
  }

  const unlisten = remote.listen((event) => {
    store.getState().heard(event);
  });
  const world = worldSchedule({ now, random, due: () => void fetchWorld() });

  let place: string | null = null;
  let socket: NudgeSocket | null = null;

  function follow(): void {
    const state = store.getState();
    if (state.clock !== null) world.at(state.clock.nextTickAt);
    const next = state.view === null || state.signedOut ? null : placeOf(state.view);
    if (next === place) return;
    socket?.close();
    socket = null;
    place = next;
    if (next === null) return;
    // R-CLOCK-027: a new place closes the old socket and opens the new one.
    socket = nudgeSocket({
      url: remote.api.socketUrl(`/api/place/${encodeURIComponent(next)}/socket`),
      open,
      random,
      held: () => remote.held(),
      fetchView: refresh,
      fetchPresence: () => void fetchPresence(next),
      fetchMessages: () => store.getState().heardMessages(),
    });
  }

  // R-ENGINE-015: back after a kill, a sleep or a while away, the view is read again: one request (the store's
  // refresh is shared), the usual card if it fails. The clock and the month kept on the device stay as they were.
  const visible = () => {
    if (page?.visibilityState === "visible") refresh();
  };

  const unsubscribe = store.subscribe(follow);
  follow();
  focus?.addEventListener("focus", refresh);
  focus?.addEventListener("pageshow", refresh);
  page?.addEventListener("visibilitychange", visible);

  return () => {
    unsubscribe();
    unlisten();
    world.stop();
    socket?.close();
    focus?.removeEventListener("focus", refresh);
    focus?.removeEventListener("pageshow", refresh);
    page?.removeEventListener("visibilitychange", visible);
  };
}
