// R-CLOCK-020 to 022: the NudgeBus over the place objects. A nudge goes to the
// object of the account's place, which sends it down every socket whose
// attachment names the account. A subscriber here is a listener socket in
// that place: it receives the account's nudges and is never shown or counted.
import type { Nudge, NudgeBus, NudgeHandler } from "@japacity/store";

import { CLOSE_NORMAL } from "./place.socket";
import { acceptedEnd } from "./place.presence";
import { nudgeRooms, openSocket } from "./place.rooms";
import type { Rooms } from "./place.rooms";

/** The character's place from its state, or null when the account has none. The core provides it. */
export type PlaceOf = (account: string) => Promise<string | null>;

/** How long a send waits for this bus's own listeners to hear it; the nudge is best effort past that. */
const HEARD_WITHIN_MS = 2000;

interface Listener {
  account: string;
  handler: NudgeHandler;
  ended: boolean;
  heard: number;
  /** Resolves the waits of sends that expect a count already heard. */
  waiting: { count: number; done: () => void }[];
  end: WebSocket | null;
}

/** R-CLOCK-020: reads a socket's text back into a nudge, or null for anything else. */
export function readNudge(text: unknown): Nudge | null {
  if (typeof text !== "string") return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const held = value as Record<string, unknown>;
  const keys = Object.keys(held).sort().join(",");
  if (held.nudge === "view" && keys === "nudge,v" && typeof held.v === "number") return { nudge: "view", v: held.v };
  if ((held.nudge === "messages" || held.nudge === "presence") && keys === "nudge") return { nudge: held.nudge };
  return null;
}

function heard(listener: Listener, nudge: Nudge): void {
  listener.heard++;
  if (!listener.ended) {
    // Best effort (R-CLOCK-022): one broken handler must not keep the nudge from the others.
    try {
      listener.handler(nudge);
    } catch {
      // Dropped.
    }
  }
  listener.waiting = listener.waiting.filter((wait) => {
    if (wait.count > listener.heard) return true;
    wait.done();
    return false;
  });
}

function heardBy(listener: Listener, count: number): Promise<void> {
  if (listener.heard >= count || listener.ended) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, HEARD_WITHIN_MS);
    listener.waiting.push({
      count,
      done: () => {
        clearTimeout(timer);
        resolve();
      },
    });
  });
}

export function placeNudgeBus(rooms: Rooms, placeOf: PlaceOf): NudgeBus {
  const listeners = new Set<Listener>();
  let opening: Promise<unknown>[] = [];

  async function listen(listener: Listener): Promise<void> {
    const place = await placeOf(listener.account);
    if (place === null || listener.ended) return;
    const end = acceptedEnd(await openSocket(rooms, place, { kind: "listener", socket: crypto.randomUUID(), account: listener.account }));
    end.addEventListener("message", (event) => {
      const nudge = readNudge(event.data);
      if (nudge !== null) heard(listener, nudge);
    });
    listener.end = end;
    if (listener.ended) end.close(CLOSE_NORMAL, "ended");
  }

  return {
    send: async (account, nudge) => {
      await Promise.allSettled(opening);
      opening = [];
      const place = await placeOf(account).catch(() => null);
      if (place === null) return;
      const mine = [...listeners].filter((listener) => listener.account === account && listener.end !== null && !listener.ended);
      const expected = mine.map((listener) => listener.heard + 1);
      try {
        await nudgeRooms(rooms, place, account, nudge);
      } catch {
        return;
      }
      await Promise.all(mine.map((listener, index) => heardBy(listener, expected[index] ?? 0)));
    },
    subscribe: (account, handler) => {
      const listener: Listener = { account, handler, ended: false, heard: 0, waiting: [], end: null };
      listeners.add(listener);
      opening.push(listen(listener).catch(() => undefined));
      return () => {
        if (listener.ended) return;
        listener.ended = true;
        listeners.delete(listener);
        listener.end?.close(CLOSE_NORMAL, "ended");
        for (const wait of listener.waiting) wait.done();
        listener.waiting = [];
      };
    },
  };
}
