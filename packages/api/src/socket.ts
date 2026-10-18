// The nudge socket's messages (R-CLOCK-020 to 024): the server sends a nudge
// as JSON text, the client sends nothing but a ping, and the place object
// answers the ping by itself. Both sides read a nudge with `readNudge`.
import type { Nudge } from "@japacity/store";

export type { Nudge };

/** R-CLOCK-024: the client's ping and the automatic reply. */
export const PING = "ping";
export const PONG = "pong";

/** R-CLOCK-020: reads a socket's text back into a nudge, or null for anything else, a nudge with any other key too. */
export function readNudge(text: unknown): Nudge | null {
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
  if (held.nudge === "view" && keys === "nudge,v" && typeof held.v === "number") return { nudge: "view", v: held.v };
  if ((held.nudge === "messages" || held.nudge === "presence") && keys === "nudge") return { nudge: held.nudge };
  return null;
}
