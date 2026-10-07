import type { Stream } from "./types";

/** The engine's own event. It ends every accepted command and carries the four counters (R-ENGINE-013). */
export interface EngineStepped {
  type: "engine/stepped";
  v: number;
  tick: number;
  draws: Partial<Record<Stream, number>>;
  nextInstance: number;
}

export type EngineEvent = EngineStepped;
