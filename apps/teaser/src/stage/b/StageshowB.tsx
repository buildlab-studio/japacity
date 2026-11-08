// The second stageshow cut, a life on the water: Start work pressed at the racks in Makoko within the first second, the
// month's pay leading the results with the money held for the move filling, the brief the Japa app carries with the way
// out heard at a send-off first, the four ways out in the game's order, and the end card the lead cut closes on. Built
// for the phone in the hand (`StageshowBPortrait`, 1080 by 1920), from the same kit, host and pipeline as `Stageshow`.
import { TALL_VIDEO } from "../../parts/frame";
import { Cut, type CutPlan, cutFrames, cutFrom } from "../cut";
import { type SceneNameB, TIMINGS_B } from "./timings";

/** The scenes in the order the cut plays them. */
export const ORDER_B: readonly SceneNameB[] = ["b-racks", "b-payday", "b-road"];

const PLAN: CutPlan = { order: ORDER_B, timings: TIMINGS_B };

/** The whole cut's length in frames. */
export const STAGESHOW_B_FRAMES = cutFrames(PLAN);

/** Where each scene and the end card start in the cut. */
export const STAGESHOW_B_FROM = cutFrom(PLAN) as Readonly<Record<SceneNameB | "end", number>>;

/** The second cut in the hand, 1080 by 1920. */
export function StageshowBPortrait() {
  return <Cut plan={PLAN} shape="tall" />;
}

export const STAGESHOW_B_COMPOSITIONS = {
  StageshowBPortrait: { ...TALL_VIDEO, durationInFrames: STAGESHOW_B_FRAMES },
} as const;
