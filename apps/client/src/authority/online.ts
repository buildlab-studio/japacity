// Keeps an online store fresh: the authority's reports into the store, the
// nudge socket for the character's place, the world on its schedule, and a
// fetch when the tab comes back into focus (R-CLOCK-019, R-CLOCK-021 to 023).
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";

import { openingPlace } from "../features/city/staging";

import { deviceRandom, type RandomBelow } from "../shared/net/random";
import { browserSocket, nudgeSocket, type NudgeSocket, type OpenSocket } from "../shared/net/socket";
import { worldSchedule } from "../shared/net/world";
import type { RemoteAuthority } from "./remote";
import type { GameStore } from "./store";

export interface OnlineOptions {
  store: GameStore;
  remote: RemoteAuthority;
  open?: OpenSocket;
  random?: RandomBelow;
  now?: () => number;
  /** Where focus is heard. Null in tests that do not need it. */
  focus?: Pick<Window, "addEventListener" | "removeEventListener"> | null;
}

const PLACES = Object.values(content.place);

/**
 * The place a character's socket and presence are for: a content place id, as
 * the server's place routes require, and the one the city opens on.
 * the view names only home, abroad (with its country) or the road;
 * the server's `placeOf` must answer the same hub, or the socket is refused.
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

  const refresh = () => {
    const state = store.getState();
    if (!state.signedOut) void state.refresh();
  };

  async function fetchWorld(): Promise<void> {
    try {
      store.setState({ world: await remote.world() });
    } catch {
      // The world is shown only through the view, which the refresh below brings anyway.
    }
    refresh();
  }

  async function fetchPresence(place: string): Promise<void> {
    try {
      const presence = await remote.presence(place);
      if (store.getState().view !== null) store.setState({ presence });
    } catch {
      // Presence is a sample for colour, and the next nudge asks again.
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

  const unsubscribe = store.subscribe(follow);
  follow();
  focus?.addEventListener("focus", refresh);

  return () => {
    unsubscribe();
    unlisten();
    world.stop();
    socket?.close();
    focus?.removeEventListener("focus", refresh);
  };
}
