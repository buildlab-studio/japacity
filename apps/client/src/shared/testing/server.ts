// A stand-in for the server's HTTP side: answers queued per route, and every
// request kept so a test can say what was sent. The real server is tested in
// apps/server; this holds the client to the contract in shared/net/contract.ts.
import type { Fetch } from "../net/http";

export interface Sent {
  method: string;
  path: string;
  body: unknown;
  headers: Record<string, string>;
  credentials: RequestCredentials | undefined;
}

export interface Answer {
  status?: number;
  body: unknown;
  headers?: Record<string, string>;
}

export interface FakeServer {
  fetch: Fetch;
  sent: Sent[];
  /** Queues answers for `METHOD /path`, used in order; the last one repeats until new ones are queued. */
  answer(route: string, ...answers: (Answer | (() => Promise<Answer>))[]): void;
}

export const BASE = "https://play.test";

export function fakeServer(): FakeServer {
  const queues = new Map<string, (Answer | (() => Promise<Answer>))[]>();
  const sent: Sent[] = [];
  const used = new Set<string>();
  return {
    sent,
    answer(route, ...answers) {
      // An answer already given and kept only to repeat makes way for new ones.
      const kept = used.has(route) ? [] : (queues.get(route) ?? []);
      used.delete(route);
      queues.set(route, [...kept, ...answers]);
    },
    async fetch(input, init) {
      const url = new URL(input);
      const method = init?.method ?? "GET";
      const path = url.pathname;
      const headers = Object.fromEntries(new Headers(init?.headers).entries());
      sent.push({ method, path, body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined, headers, credentials: init?.credentials });
      const queue = queues.get(`${method} ${path}`);
      const next = queue === undefined ? undefined : queue.length > 1 ? queue.shift() : queue[0];
      if (queue?.length === 1) used.add(`${method} ${path}`);
      if (next === undefined) return new Response(JSON.stringify({ error: `no answer for ${method} ${path}` }), { status: 404 });
      const answer = typeof next === "function" ? await next() : next;
      return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200, headers: { "content-type": "application/json", ...answer.headers } });
    },
  };
}

/** A promise and its resolver, to hold an answer back until the test lets it go. */
export function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
