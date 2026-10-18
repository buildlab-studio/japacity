// The nudge socket (clock:socket-only-nudges, clock:nudge-triggers-ordinary-fetch, clock:nudges-are-best-effort, clock:sockets-reconnect-with-backoff and clock:client-sends-only-pings). It only hears that something changed
// and asks for it through an ordinary request; game state never comes this
// way. It sends nothing but a ping. `open` is the seam tests fake.
import { type Nudge, PING, readKnownNudge } from "@japacity/api";

import type { RandomBelow } from "./random";

/** clock.md Numbers: `client.reconnect` and `client.pingMs`, mirrored from the server's page. */
export const SOCKET_NUMBERS = { reconnectFirstMs: 1000, reconnectMaxMs: 60_000, pingMs: 30_000 } as const;

/** The part of the browser's WebSocket this uses. */
export interface SocketLike {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
}

export type OpenSocket = (url: string) => SocketLike;

export const browserSocket: OpenSocket = (url) => {
  const socket = new WebSocket(url);
  const like: SocketLike = {
    send: (data) => {
      socket.send(data);
    },
    close: () => {
      socket.close();
    },
    onopen: null,
    onmessage: null,
    onclose: null,
    onerror: null,
  };
  socket.onopen = () => like.onopen?.();
  socket.onmessage = (event) => like.onmessage?.({ data: event.data });
  socket.onclose = () => like.onclose?.();
  socket.onerror = () => like.onerror?.();
  return like;
};

/** clock:sockets-reconnect-with-backoff: the wait before reconnect number `attempt` (from 0): 1 s doubling to 60 s, plus up to half again. */
export function reconnectWait(attempt: number, random: RandomBelow): number {
  const { reconnectFirstMs, reconnectMaxMs } = SOCKET_NUMBERS;
  const base = Math.min(reconnectFirstMs * 2 ** Math.min(attempt, 16), reconnectMaxMs);
  return base + random(Math.floor(base / 2) + 1);
}

export interface NudgeSocketOptions {
  url: string;
  open: OpenSocket;
  random: RandomBelow;
  /** The version of the view the client holds now. */
  held: () => number | null;
  fetchView: () => void;
  fetchPresence: () => void;
  /** A pair's conversation has a new row: an open conversation fetches from where it left off (pair:conversation-phrases-stored). */
  fetchMessages?: () => void;
}

export interface NudgeSocket {
  close(): void;
}

export function nudgeSocket(options: NudgeSocketOptions): NudgeSocket {
  let attempt = 0;
  let closed = false;
  let socket: SocketLike | null = null;
  let ping: ReturnType<typeof setInterval> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;

  function heard(nudge: Nudge): void {
    switch (nudge.nudge) {
      case "view": {
        const held = options.held();
        if (held === null || nudge.v > held) options.fetchView();
        return;
      }
      case "presence":
        options.fetchPresence();
        return;
      case "messages":
        options.fetchMessages?.();
        return;
      default: {
        const never: never = nudge;
        throw new Error(`Unknown nudge: ${JSON.stringify(never)}`);
      }
    }
  }

  function connect(): void {
    const opened = options.open(options.url);
    socket = opened;
    opened.onopen = () => {
      attempt = 0;
      options.fetchView();
      ping = setInterval(() => {
        opened.send(PING);
      }, SOCKET_NUMBERS.pingMs);
    };
    opened.onmessage = (event) => {
      const nudge = readKnownNudge(event.data);
      if (nudge !== null) heard(nudge);
    };
    opened.onerror = () => {
      // A close always follows an error, and the close reconnects.
    };
    opened.onclose = () => {
      clearInterval(ping);
      if (closed || socket !== opened) return;
      retry = setTimeout(connect, reconnectWait(attempt, options.random));
      attempt += 1;
    };
  }

  connect();
  return {
    close() {
      closed = true;
      clearTimeout(retry);
      clearInterval(ping);
      socket?.close();
    },
  };
}
