// The stageshow teaser: the game's own screens as product shots, in the order of a life. Who you are at the front door, a
// step on the brief done on the phone, the month's results with a sponsor that may not be one, the ways out on the phone,
// and the end card the lead cut closes on (cut.tsx plays them). `Stageshow` is the laptop (1920 by 1080);
// `StageshowPortrait` the phone in the hand (1080 by 1920).
import { TALL_VIDEO, VIDEO } from "../parts/frame";
import { Cut, type CutPlan, cutFrames, cutFrom, END_FRAMES, FADE, framesOf } from "./cut";
import { type SceneName, TIMINGS } from "./timings";

export { END_FRAMES, FADE };

/** The scenes in the order the cut plays them. */
export const ORDER: readonly SceneName[] = ["door", "step", "month", "ways"];

const PLAN: CutPlan = { order: ORDER, timings: TIMINGS };

/** A scene's length in frames. */
export function sceneFrames(scene: SceneName): number {
  return framesOf(TIMINGS[scene]);
}

/** The whole cut's length: the scenes and the end card, less the frames each fade lays two shots over each other. */
export const STAGESHOW_FRAMES = cutFrames(PLAN);

/** Where each scene and the end card start in the cut. */
export const STAGESHOW_FROM = cutFrom(PLAN) as Readonly<Record<SceneName | "end", number>>;

/** The stageshow teaser on a laptop, 1920 by 1080. */
export function Stageshow() {
  return <Cut plan={PLAN} shape="wide" />;
}

/** The stageshow teaser in the hand, 1080 by 1920. */
export function StageshowPortrait() {
  return <Cut plan={PLAN} shape="tall" />;
}

export const STAGESHOW_COMPOSITIONS = {
  Stageshow: { ...VIDEO, durationInFrames: STAGESHOW_FRAMES },
  StageshowPortrait: { ...TALL_VIDEO, durationInFrames: STAGESHOW_FRAMES },
} as const;
