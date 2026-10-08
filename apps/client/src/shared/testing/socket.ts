// A socket the tests drive by hand: they open it, close it and push nudges in,
// and every message the client sends out is kept.
import type { OpenSocket, SocketLike } from "../net/socket";

export interface FakeSocket extends SocketLike {
  url: string;
  outgoing: string[];
  closed: boolean;
  /** The server accepts the socket. */
  accept(): void;
  /** The server sends a text message. */
  push(data: unknown): void;
  /** The connection drops, from either side. */
  drop(): void;
}

export function fakeSockets(): { open: OpenSocket; opened: FakeSocket[] } {
  const opened: FakeSocket[] = [];
  const open: OpenSocket = (url) => {
    const socket: FakeSocket = {
      url,
      outgoing: [],
      closed: false,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send(data) {
        socket.outgoing.push(data);
      },
      close() {
        if (socket.closed) return;
        socket.closed = true;
        socket.onclose?.();
      },
      accept() {
        socket.onopen?.();
      },
      push(data) {
        socket.onmessage?.({ data: typeof data === "string" ? data : JSON.stringify(data) });
      },
      drop() {
        socket.onerror?.();
        socket.close();
      },
    };
    opened.push(socket);
    return socket;
  };
  return { open, opened };
}
