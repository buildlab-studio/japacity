// What the place check hands its page and reads back (city:no-script-loop-per-sheet, city:places-meet-party-room-bar). The page
// lives with the city's code, which only the client imports, so the check hands it plain data: the
// place's file and entry, the city's tuning, and the day, figure, mode and device to draw them for.
// The page names the client's types for the first three.

export type CheckMode = "low" | "high";

export interface PlaceInput<File = unknown, Entry = unknown, City = unknown> {
  file: File;
  entry: Entry;
  city: City;
  /** The day the crowd is sampled for, so a run gives the same people every time. */
  date: string;
  /** The player's own figure. */
  own: string;
  mode: CheckMode;
  device: { finePointer: boolean; width: number; pixelRatio: number };
  /** Sign words by key, from the content's text table. */
  text: Record<string, string>;
  /** Still leaves out the motion list and the frame update; moving has both. */
  moving: boolean;
}

/** What routing cost on a place: its route map's cells and the milliseconds to build it, then each tap's. */
export interface RouteRecord {
  cells: number;
  mapMs: number;
  tapsMs: number[];
}

export interface FrameRecord {
  drawCalls: number;
  triangles: number;
  /** Microseconds of script before the frame is drawn. */
  scriptUs: number;
  /** Milliseconds from the frame's start until its drawing is finished. */
  frameMs: number;
}
