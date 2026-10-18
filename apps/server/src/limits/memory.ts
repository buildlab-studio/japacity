// A counting limiter in memory with the shape of Cloudflare's rate-limit
// binding (server:limits-are-approximate), for tests and local runs.
import type { ServerConfig } from "../config";
import type { Limiter, Limiters } from "../deps";

const SECONDS_10 = 10_000;
const SECONDS_60 = 60_000;

/** At most `limit` calls for one key in each window of `periodMs` from the key's first call in it. */
export function memoryLimiter(limit: number, periodMs: number, now: () => number): Limiter {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    limit: ({ key }) => {
      const at = now();
      const open = windows.get(key);
      const window = open === undefined || at - open.start >= periodMs ? { start: at, count: 0 } : open;
      window.count += 1;
      windows.set(key, window);
      return Promise.resolve({ success: window.count <= limit });
    },
  };
}

/** server:per-account-rate-limits, server:anonymous-limit-by-address and server:noisy-socket-closed: every limit of the config, counted in memory. */
export function memoryLimiters(limits: ServerConfig["limits"], now: () => number): Limiters {
  return {
    commands10s: memoryLimiter(limits.commandsPer10s, SECONDS_10, now),
    commands60s: memoryLimiter(limits.commandsPer60s, SECONDS_60, now),
    reads60s: memoryLimiter(limits.readsPer60s, SECONDS_60, now),
    anon60s: memoryLimiter(limits.anonPer60s, SECONDS_60, now),
    socket10s: memoryLimiter(limits.socketPer10s, SECONDS_10, now),
  };
}
