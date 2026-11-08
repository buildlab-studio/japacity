// The second cut's beats in milliseconds from the start of each scene's script, and the sounds laid on them: plain data,
// so the composition reads them without the scenes, and each script lands its taps on the same moments.
import type { Timing } from "../timeline";

/** The racks: Start work is pressed within the first second, the sheet sinks and the act's toast slides in under the band. */
export const RACKS_BEAT = { press: 600, toast: 1000, end: 3800 } as const;

export const RACKS: Timing = {
  length: RACKS_BEAT.end,
  cues: [
    { at: RACKS_BEAT.press, sound: "click.wav", volume: 0.9 },
    { at: RACKS_BEAT.press + 80, sound: "swish.wav", volume: 0.4 },
    { at: RACKS_BEAT.toast, sound: "pop.wav", volume: 0.7 },
  ],
};

/** The month's end: the results rise, the savings fill once they have landed, Back is pressed and the brief's toast says what is in. */
export const PAYDAY_BEAT = { rise: 120, fill: 1000, back: 3900, toast: 4300, end: 6300 } as const;
/** The money held for the move in naira, before the month's pay and after it, of what the way asks. */
export const SAVED_WATER = { before: 500_000, after: 538_000, required: 1_300_000 } as const;

export const PAYDAY: Timing = {
  length: PAYDAY_BEAT.end,
  cues: [
    { at: PAYDAY_BEAT.rise, sound: "swish.wav", volume: 0.35 },
    ...[0, 120, 240, 360, 480, 600, 720].map((at, index) => ({ at: PAYDAY_BEAT.fill + at, sound: "coin.wav", volume: 0.3 + index * 0.04 })),
    { at: PAYDAY_BEAT.back, sound: "click.wav", volume: 0.8 },
    { at: PAYDAY_BEAT.back + 80, sound: "swish.wav", volume: 0.35 },
    { at: PAYDAY_BEAT.toast, sound: "chime.wav", volume: 0.55 },
  ],
};

/** The road: the brief's chip tapped, the phone rises on the brief it carries, then the app moves down to the ways out. */
export const ROAD_BEAT = { chip: 700, ways: 3400, end: 6400 } as const;

export const ROAD: Timing = {
  length: ROAD_BEAT.end,
  cues: [
    { at: ROAD_BEAT.chip, sound: "pop.wav", volume: 0.7 },
    { at: ROAD_BEAT.chip + 60, sound: "swish.wav", volume: 0.45 },
    { at: ROAD_BEAT.ways, sound: "swish.wav", volume: 0.35 },
    { at: ROAD_BEAT.ways + 500, sound: "chime.wav", volume: 0.6 },
  ],
};

export type SceneNameB = "b-racks" | "b-payday" | "b-road";

/** Each scene's length and sounds, for the composition that cuts them together. */
export const TIMINGS_B: Readonly<Record<SceneNameB, Timing>> = { "b-racks": RACKS, "b-payday": PAYDAY, "b-road": ROAD };
