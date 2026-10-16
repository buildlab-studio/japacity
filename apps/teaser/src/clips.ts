// The game's moments the teaser shows as recorded, each a WebM under apps/teaser/clips/ written by pnpm teaser:record,
// and the painted map's two stills beside them. The recording session that makes each clip is named, so the recorder and
// the composition read the same list.

export type Session = "door" | "wide-day" | "wide-night" | "wide-sofa" | "wide-ride" | "morning" | "tall-day" | "tall-night" | "tall-sofa" | "tall-ride";

export type ClipName = "wide-day" | "wide-night" | "wide-sofa" | "wide-ride" | "wide-street" | "morning" | "tall-day" | "tall-night" | "tall-sofa" | "tall-ride" | "tall-street";

export interface Clip {
  readonly name: ClipName;
  readonly file: string;
  readonly session: Session;
  /**
   * A wide shot of the world alone (1920 by 1080), a phone recording (780 by 1688), or a tall shot of the world alone as
   * the phone shows it (recorded at 1170 by 2532 and cropped to 1080 by 1920, the portrait cut's frame).
   */
  readonly shape: "wide" | "phone" | "tall";
}

/** The clips of the landscape cut and the earlier thirty second cut. */
export const CLIPS: readonly Clip[] = [
  { name: "wide-ride", file: "wide-ride.webm", session: "wide-ride", shape: "wide" },
  { name: "wide-street", file: "wide-street.webm", session: "wide-ride", shape: "wide" },
  { name: "wide-day", file: "wide-day.webm", session: "wide-day", shape: "wide" },
  { name: "wide-sofa", file: "wide-sofa.webm", session: "wide-sofa", shape: "wide" },
  { name: "morning", file: "morning.webm", session: "morning", shape: "phone" },
  { name: "wide-night", file: "wide-night.webm", session: "wide-night", shape: "wide" },
];

/** The same sessions on the phone, for the portrait cut's hand: the world alone in the phone's own frame. */
export const TALL_CLIPS: readonly Clip[] = [
  { name: "tall-ride", file: "tall-ride.webm", session: "tall-ride", shape: "tall" },
  { name: "tall-street", file: "tall-street.webm", session: "tall-ride", shape: "tall" },
  { name: "tall-day", file: "tall-day.webm", session: "tall-day", shape: "tall" },
  { name: "tall-sofa", file: "tall-sofa.webm", session: "tall-sofa", shape: "tall" },
  { name: "tall-night", file: "tall-night.webm", session: "tall-night", shape: "tall" },
];

/** Every clip the recorder makes and a composition can draw. */
export const ALL_CLIPS: readonly Clip[] = [...CLIPS, ...TALL_CLIPS];

/** The painted map, by day for the opening and at night for the flight. */
export const STILLS = ["map-day.png", "map-night.png"] as const;
