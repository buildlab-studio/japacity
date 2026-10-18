// The client keeps under the server's command limit on its own (server:per-account-rate-limits):
// the server takes ten commands from an account in any ten seconds and refuses the eleventh, so the client lets at most
// eight leave in any ten seconds and holds the next until there is room, rather than be refused in the middle of play.
// The two it leaves free are for what goes beside the game's own commands (the username, a feedback, an invite).

/** At most this many command requests leave in any `WINDOW_MS`. */
export const COMMANDS_PER_WINDOW = 8;
export const WINDOW_MS = 10_000;

/**
 * How long the next command must wait, in ms, given when the last ones left (oldest first): nothing while fewer than
 * `COMMANDS_PER_WINDOW` left in the last `WINDOW_MS`, else until the oldest of them leaves the window.
 */
export function waitBefore(sent: readonly number[], now: number): number {
  const recent = sent.filter((at) => now - at < WINDOW_MS);
  if (recent.length < COMMANDS_PER_WINDOW) return 0;
  const oldest = recent[recent.length - COMMANDS_PER_WINDOW] ?? now;
  return oldest + WINDOW_MS - now;
}

/** The most commands that left in any `WINDOW_MS`, for the tests: every window starts at a send. */
export function busiestWindow(sent: readonly number[]): number {
  return sent.reduce((most, start) => Math.max(most, sent.filter((at) => at >= start && at < start + WINDOW_MS).length), 0);
}

export interface Pacer {
  /** Waits until a command may leave, and counts it as gone. */
  take(): Promise<void>;
}

/** A pacer over a clock and a wait, so a test can run it on its own time. */
export function pacer(now: () => number, wait: (ms: number) => Promise<void>): Pacer {
  const sent: number[] = [];
  return {
    async take() {
      for (let ms = waitBefore(sent, now()); ms > 0; ms = waitBefore(sent, now())) await wait(ms);
      const at = now();
      sent.push(at);
      while (sent.length > 0 && at - (sent[0] ?? at) >= WINDOW_MS) sent.shift();
    },
  };
}
