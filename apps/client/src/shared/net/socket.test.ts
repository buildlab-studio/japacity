import { PING } from "@japacity/api";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { fakeSockets } from "../testing/socket";
import { nudgeSocket, reconnectWait, SOCKET_NUMBERS } from "./socket";

const none = () => 0;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function setUp(held: number | null = 5) {
  const { open, opened } = fakeSockets();
  const counts = { view: 0, presence: 0 };
  const socket = nudgeSocket({
    url: "wss://play.test/api/place/home/socket",
    open,
    random: none,
    held: () => held,
    fetchView: () => (counts.view += 1),
    fetchPresence: () => (counts.presence += 1),
  });
  return { socket, opened, counts };
}

describe("the reconnect wait", () => {
  test("[clock:sockets-reconnect-with-backoff] given no random part, then the waits run 1, 2, 4, 8, 16, 32 seconds and stop at 60", () => {
    expect(Array.from({ length: 9 }, (_, attempt) => reconnectWait(attempt, none))).toEqual([1000, 2000, 4000, 8000, 16000, 32000, 60000, 60000, 60000]);
  });

  test("[clock:sockets-reconnect-with-backoff] given the random part, then it is drawn up to half the wait and never more", () => {
    const asked: number[] = [];
    const most = (below: number) => (asked.push(below), below - 1);
    expect([0, 1, 6, 20].map((attempt) => reconnectWait(attempt, most))).toEqual([1500, 3000, 90000, 90000]);
    expect(asked).toEqual([501, 1001, 30001, 30001]);
  });

  test("[clock:sockets-reconnect-with-backoff] given the numbers on clock.md, then the client mirrors them", () => {
    expect(SOCKET_NUMBERS).toEqual({ reconnectFirstMs: 1000, reconnectMaxMs: 60000, pingMs: 30000 });
  });
});

describe("the nudge socket", () => {
  test("[clock:sockets-reconnect-with-backoff] given the socket connects, then the view is fetched once", () => {
    const { opened, counts } = setUp();
    expect(opened).toHaveLength(1);
    expect(opened[0]?.url).toBe("wss://play.test/api/place/home/socket");
    opened[0]?.accept();
    expect(counts.view).toBe(1);
  });

  test("[clock:sockets-reconnect-with-backoff] given the socket drops again and again, then it reconnects after 1, 2 and 4 seconds and fetches the view on each connect", () => {
    const { opened, counts } = setUp();
    opened[0]?.drop();
    vi.advanceTimersByTime(999);
    expect(opened).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(opened).toHaveLength(2);
    opened[1]?.drop();
    vi.advanceTimersByTime(1999);
    expect(opened).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(opened).toHaveLength(3);
    opened[2]?.drop();
    vi.advanceTimersByTime(4000);
    expect(opened).toHaveLength(4);
    opened[3]?.accept();
    expect(counts.view).toBe(1);
  });

  test("[clock:sockets-reconnect-with-backoff] given a connection that opened, when it drops, then the wait starts again from 1 second", () => {
    const { opened } = setUp();
    opened[0]?.drop();
    vi.advanceTimersByTime(1000);
    opened[1]?.drop();
    vi.advanceTimersByTime(2000);
    opened[2]?.accept();
    opened[2]?.drop();
    vi.advanceTimersByTime(1000);
    expect(opened).toHaveLength(4);
  });

  test("[clock:nudge-triggers-ordinary-fetch] given the client holds version 5, then a view nudge at 5 or below is ignored and one at 6 fetches the view", () => {
    const { opened, counts } = setUp(5);
    const socket = opened[0]!;
    socket.accept();
    socket.push({ nudge: "view", v: 5 });
    socket.push({ nudge: "view", v: 4 });
    expect(counts.view).toBe(1);
    socket.push({ nudge: "view", v: 6 });
    expect(counts.view).toBe(2);
  });

  test("[clock:nudge-triggers-ordinary-fetch] given a presence nudge, then presence is fetched and the view is not", () => {
    const { opened, counts } = setUp();
    opened[0]?.push({ nudge: "presence" });
    expect(counts).toEqual({ view: 0, presence: 1 });
  });

  test("[clock:socket-only-nudges] given a message that is not a nudge, then nothing happens", () => {
    const { opened, counts } = setUp();
    opened[0]?.push("pong");
    opened[0]?.push({ nudge: "view" });
    opened[0]?.push({ view: { v: 99 } });
    expect(counts).toEqual({ view: 0, presence: 0 });
  });

  test("[clock:client-sends-only-pings] given an open socket for 95 seconds of nudges, then the only messages sent are three pings, one every 30 seconds", () => {
    const { opened } = setUp();
    const socket = opened[0]!;
    socket.accept();
    socket.push({ nudge: "view", v: 9 });
    socket.push({ nudge: "presence" });
    vi.advanceTimersByTime(29_999);
    expect(socket.outgoing).toEqual([]);
    vi.advanceTimersByTime(65_001);
    expect(socket.outgoing).toEqual([PING, PING, PING]);
  });

  test("[clock:client-sends-only-pings] given the socket closed by the client, then it sends nothing more and does not reconnect", () => {
    const { socket, opened } = setUp();
    opened[0]?.accept();
    socket.close();
    vi.advanceTimersByTime(120_000);
    expect(opened).toHaveLength(1);
    expect(opened[0]?.outgoing).toEqual([]);
  });
});
