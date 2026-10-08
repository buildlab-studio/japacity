// What the place check hands its page and reads back (city.md R-CITY-027, R-CITY-038), apart from
// the page so the check can read it without the browser's types.
import type { Shown } from "../../apps/client/src/features/city/crowd";
import type { ModeSettings } from "../../apps/client/src/features/city/mode";
import type { Stage } from "../../apps/client/src/features/city/placeFile";

export interface PlaceRun {
  stage: Stage;
  people: Shown[];
  own: string;
  settings: ModeSettings;
  /** Sign words by key, from the content's text table. */
  text: Record<string, string>;
  /** Still leaves out the motion list and the frame update; moving has both. */
  moving: boolean;
}

export interface FrameRecord {
  drawCalls: number;
  triangles: number;
  /** Microseconds of script before the frame is drawn. */
  scriptUs: number;
  /** Milliseconds from the frame's start until its drawing is finished. */
  frameMs: number;
}
