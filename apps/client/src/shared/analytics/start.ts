// Starts the interface counters for a game played against the server: a
// batch every `batchSeconds` and one when the page is hidden, each sent by
// `navigator.sendBeacon` to `/api/counters` (R-ANALYTICS-003). Screens and
// the account feature count through `counting()`.
import { content } from "@japacity/content";

import { loadBand, makeCounters } from "./counters";
import type { AskKind, AskOutcome, Counters } from "./counters";

const SECOND_MS = 1000;

const quiet: Counters = { count: () => undefined, ask: () => undefined, setEnabled: () => undefined, flush: () => undefined };

let current: Counters = quiet;

/** The running counters, or ones that count nothing when the game has no server. */
export function counting(): Counters {
  return current;
}

/** For tests: counts into `counters` until the returned function puts the quiet ones back. */
export function countInto(counters: Counters): () => void {
  current = counters;
  return () => {
    current = quiet;
  };
}

/** R-ANALYTICS-011: the function the account feature calls for each ask it makes. */
export function countAsk(kind: AskKind, outcome: AskOutcome, afterEarlyWin: boolean): void {
  current.ask(kind, outcome, afterEarlyWin);
}

/**
 * R-ANALYTICS-006: the account's "Send usage counts" setting. The counters
 * start on; the boot and the settings sheet call this once the account says.
 */
export function setUsageCounts(on: boolean): void {
  current.setEnabled(on);
}

export interface StartOptions {
  baseUrl: string;
  beacon?: (url: string, body: Blob) => boolean;
  now?: () => number;
}

export function startCounting({ baseUrl, beacon = (url, body) => navigator.sendBeacon(url, body), now = () => performance.now() }: StartOptions): Counters {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/counters`;
  const counters = makeCounters({ send: (body) => void beacon(url, new Blob([body], { type: "text/plain" })) });
  current = counters;
  counters.count("load/time", loadBand(now()));
  setInterval(() => counters.flush(), content.tuning.analytics.batchSeconds * SECOND_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") counters.flush();
  });
  return counters;
}
