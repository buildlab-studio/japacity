// Each scene's beats in milliseconds from the start of its script, and the sounds laid on them: plain data, so the
// composition reads them without the scenes, and each scene's script lands its taps on the same moments.
import type { Timing } from "./timeline";

export const DOOR_BEAT = { pick: 1300, next: 3700, end: 4500 } as const;

export const DOOR: Timing = {
  length: DOOR_BEAT.end,
  cues: [
    { at: DOOR_BEAT.pick, sound: "pop.wav", volume: 0.8 },
    { at: DOOR_BEAT.pick + 120, sound: "swish.wav", volume: 0.35 },
    { at: DOOR_BEAT.next, sound: "click.wav", volume: 0.8 },
  ],
};

export const STEP_BEAT = { chip: 1200, card: 3500, away: 6000, end: 8600 } as const;

export const STEP: Timing = {
  length: STEP_BEAT.end,
  cues: [
    { at: STEP_BEAT.chip, sound: "pop.wav", volume: 0.7 },
    { at: STEP_BEAT.chip + 60, sound: "swish.wav", volume: 0.45 },
    { at: STEP_BEAT.card, sound: "pop.wav", volume: 0.8 },
    { at: STEP_BEAT.card + 160, sound: "chime.wav", volume: 0.5 },
    { at: STEP_BEAT.away, sound: "swish.wav", volume: 0.35 },
    { at: STEP_BEAT.away + 260, sound: "coin.wav", volume: 0.55 },
  ],
};

export const MONTH_BEAT = { fill: 500, row: 3600, look: 5900, end: 9200 } as const;
/** The savings for the move in pounds, before the month's money and after it, of what the way asks. */
export const SAVED = { before: 1020, after: 1139, required: 1270 } as const;

export const MONTH: Timing = {
  length: MONTH_BEAT.end,
  cues: [
    ...[0, 120, 240, 360, 480, 600, 720].map((at, index) => ({ at: MONTH_BEAT.fill + at, sound: "coin.wav", volume: 0.3 + index * 0.04 })),
    { at: MONTH_BEAT.row, sound: "pop.wav", volume: 0.7 },
    { at: MONTH_BEAT.row + 80, sound: "swish.wav", volume: 0.4 },
    { at: MONTH_BEAT.look, sound: "pop.wav", volume: 0.8 },
    { at: MONTH_BEAT.look + 200, sound: "stamp.wav", volume: 0.55 },
  ],
};

export const WAYS_BEAT = { japa: 900, end: 4300 } as const;

export const WAYS: Timing = {
  length: WAYS_BEAT.end,
  cues: [
    { at: WAYS_BEAT.japa, sound: "pop.wav", volume: 0.8 },
    { at: WAYS_BEAT.japa + 60, sound: "swish.wav", volume: 0.45 },
    { at: WAYS_BEAT.japa + 380, sound: "chime.wav", volume: 0.6 },
  ],
};

export type SceneName = "door" | "step" | "month" | "ways";

/** Each scene's length and sounds, for the composition that cuts them together. */
export const TIMINGS: Readonly<Record<SceneName, Timing>> = { door: DOOR, step: STEP, month: MONTH, ways: WAYS };
