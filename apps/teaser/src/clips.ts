// The game's moments the teaser shows as recorded, each a WebM under apps/teaser/clips/ written by pnpm teaser:record.
// The recording session that makes each one is named, so the recorder and the composition read the same list.

export type ClipName = "door" | "map" | "ride" | "house" | "sofa" | "night" | "bank" | "morning" | "wide-day" | "wide-night" | "wide-map" | "wide-ride" | "wide-street";

export interface Clip {
  readonly name: ClipName;
  readonly file: string;
  readonly session: "door" | "map" | "house" | "night" | "bank" | "morning" | "wide-day" | "wide-night" | "wide-ride";
  /** A phone recording (780 by 1688) or a wide one of the world alone (1920 by 1080). */
  readonly shape: "phone" | "wide";
}

export const CLIPS: readonly Clip[] = [
  { name: "door", file: "door.webm", session: "door", shape: "phone" },
  { name: "map", file: "map.webm", session: "map", shape: "phone" },
  { name: "ride", file: "ride.webm", session: "map", shape: "phone" },
  { name: "house", file: "house.webm", session: "house", shape: "phone" },
  { name: "sofa", file: "sofa.webm", session: "house", shape: "phone" },
  { name: "night", file: "night.webm", session: "night", shape: "phone" },
  { name: "bank", file: "bank.webm", session: "bank", shape: "phone" },
  { name: "morning", file: "morning.webm", session: "morning", shape: "phone" },
  { name: "wide-day", file: "wide-day.webm", session: "wide-day", shape: "wide" },
  { name: "wide-night", file: "wide-night.webm", session: "wide-night", shape: "wide" },
  { name: "wide-map", file: "wide-map.webm", session: "wide-ride", shape: "wide" },
  { name: "wide-ride", file: "wide-ride.webm", session: "wide-ride", shape: "wide" },
  { name: "wide-street", file: "wide-street.webm", session: "wide-ride", shape: "wide" },
];
