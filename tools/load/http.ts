// Requests to the load Worker from Node, for the seeder, the driver and the
// verifier. Node's fetch keeps connections alive by default (R-LOAD-008).
import { setTimeout as sleep } from "node:timers/promises";

export interface Reply<B> {
  status: number;
  body: B | null;
  /** Milliseconds from sending to the whole body read. */
  ms: number;
}

/** The base address of the load Worker and the account a request is sent as. */
export interface Target {
  base: string;
}

const SECOND_MS = 1000;

/** One request; a failed connection is status 0, never thrown (R-LOAD-008). */
export async function request<B>(target: Target, method: "GET" | "POST", path: string, account: string | null, body?: unknown): Promise<Reply<B>> {
  const headers: Record<string, string> = {};
  if (account !== null) headers["x-test-account"] = account;
  if (body !== undefined) headers["content-type"] = "application/json";
  const started = performance.now();
  try {
    const init: RequestInit = body === undefined ? { method, headers } : { method, headers, body: JSON.stringify(body) };
    const reply = await fetch(`${target.base}${path}`, init);
    const text = await reply.text();
    let parsed: B | null = null;
    try {
      parsed = JSON.parse(text) as B;
    } catch {
      parsed = null;
    }
    return { status: reply.status, body: parsed, ms: performance.now() - started };
  } catch {
    return { status: 0, body: null, ms: performance.now() - started };
  }
}

/** A request that waits out R-SERVER-025's `retryAfter` and tries again, for the seeder and the verifier only. */
export async function patient<B>(target: Target, method: "GET" | "POST", path: string, account: string | null, body?: unknown, tries = 20): Promise<Reply<B>> {
  for (let attempt = 1; ; attempt += 1) {
    const reply = await request<B>(target, method, path, account, body);
    const retryAfter = (reply.body as { retryAfter?: unknown } | null)?.retryAfter;
    if (reply.status !== 429 || attempt >= tries) return reply;
    await sleep((typeof retryAfter === "number" ? retryAfter : 1) * SECOND_MS);
  }
}

/** Runs `work` over `items` with at most `width` at once, in order of start. */
export async function pool<T>(items: readonly T[], width: number, work: (item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await work(items[index] as T, index);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(width, items.length)) }, lane));
}

/** Reads `--name value` from the command line, or the fallback. */
export function argument(args: readonly string[], name: string, fallback: string): string {
  const at = args.indexOf(`--${name}`);
  const value = at < 0 ? undefined : args[at + 1];
  return value ?? fallback;
}

export function wholeArgument(args: readonly string[], name: string, fallback: number): number {
  const value = Number(argument(args, name, String(fallback)));
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`--${name} takes a whole number, not ${String(value)}.`);
  return value;
}
