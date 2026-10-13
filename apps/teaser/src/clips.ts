// The game's moments the teaser shows as recorded, each a WebM under apps/teaser/clips/ written by pnpm teaser:record,
// and the painted map's two stills beside them. The recording session that makes each clip is named, so the recorder and
// the composition read the same list.

export type Session = "door" | "wide-day" | "wide-night" | "wide-sofa" | "wide-ride" | "morning";

export type ClipName = "wide-day" | "wide-night" | "wide-sofa" | "wide-ride" | "wide-street" | "morning";

export interface Clip {
  readonly name: ClipName;
  readonly file: string;
  readonly session: Session;
  /** A wide shot of the world alone (1920 by 1080), or a phone recording (780 by 1688). */
  readonly shape: "wide" | "phone";
}

export const CLIPS: readonly Clip[] = [
  { name: "wide-ride", file: "wide-ride.webm", session: "wide-ride", shape: "wide" },
  { name: "wide-street", file: "wide-street.webm", session: "wide-ride", shape: "wide" },
  { name: "wide-day", file: "wide-day.webm", session: "wide-day", shape: "wide" },
  { name: "wide-sofa", file: "wide-sofa.webm", session: "wide-sofa", shape: "wide" },
  { name: "morning", file: "morning.webm", session: "morning", shape: "phone" },
  { name: "wide-night", file: "wide-night.webm", session: "wide-night", shape: "wide" },
];

/** The painted map, by day for the opening and at night for the flight. */
export const STILLS = ["map-day.png", "map-night.png"] as const;
