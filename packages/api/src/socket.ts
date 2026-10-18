// The nudge socket's messages (clock:socket-only-nudges, clock:nudge-triggers-ordinary-fetch, clock:nudges-are-best-effort, clock:sockets-reconnect-with-backoff and clock:client-sends-only-pings): the server sends a nudge
// as JSON text, the client sends nothing but a ping, and the place object
// answers the ping by itself. The server reads a nudge with `readNudge`, the client with `readKnownNudge`.
import type { Nudge } from "@japacity/store";

export type { Nudge };

/** clock:client-sends-only-pings: the client's ping and the automatic reply. */
export const PING = "ping";
export const PONG = "pong";

/** clock:socket-only-nudges: reads a socket's text back into a nudge exactly, as the server reads what it wrote: null for anything else, a nudge with any other key too. */
export function readNudge(text: unknown): Nudge | null {
  return nudgeIn(text, true);
}

/**
 * clock:socket-only-nudges: reads a socket's text back into a nudge as the client reads it, passing over any key it does not know,
 * so a field a newer server adds never stops an older client fetching; null for anything that is no nudge.
 */
export function readKnownNudge(text: unknown): Nudge | null {
  return nudgeIn(text, false);
}

function nudgeIn(text: unknown, exact: boolean): Nudge | null {
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
  if (held.nudge === "view" && (!exact || keys === "nudge,v") && typeof held.v === "number") return { nudge: "view", v: held.v };
  if ((held.nudge === "messages" || held.nudge === "presence") && (!exact || keys === "nudge")) return { nudge: held.nudge };
  return null;
}
