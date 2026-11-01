// Work laid in slices (world:map-is-painted-lagos): a generator that yields every few steps, run a slice at a time in
// the browser's idle time, each slice ending once its budget is spent, so the layout never holds the screen in one long
// task. Where the browser has no idle callback the slices run on a plain timer, one after another, with the screen
// free to draw between them.

/** The most one slice runs, in milliseconds, before it hands the screen back. */
export const SLICE_MS = 6;

/**
 * Runs a job until it is done or `deadline` passes on the clock `now`. Returns whether the job has more to do and the
 * clock's last reading. The clock is read at every yield, so a slice ends within one step of its budget.
 */
export function runUntil(job: Iterator<unknown, unknown, undefined>, deadline: number, now: () => number): { more: boolean; at: number } {
  for (;;) {
    const done = job.next().done === true;
    const at = now();
    if (done) return { more: false, at };
    if (at >= deadline) return { more: true, at };
  }
}

/** The browser's way of calling back when it is idle, or a plain timer where it has none. */
export interface Later {
  /** Calls `run` with the time left to spend, in milliseconds; returns a function that cancels the call. */
  (run: (left: number) => void): () => void;
}

/** How long an idle callback may wait before it runs anyway, so a busy screen still sees the work end. */
const IDLE_TIMEOUT = 120;

export const later: Later = (run) => {
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback((idle) => run(idle.didTimeout ? SLICE_MS : Math.min(SLICE_MS, Math.max(1, idle.timeRemaining()))), { timeout: IDLE_TIMEOUT });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(() => run(SLICE_MS), 0);
  return () => clearTimeout(handle);
};

/** A clock for the slices: the page's own where it has one. */
export const clock = (): number => (typeof performance === "undefined" ? Date.now() : performance.now());
