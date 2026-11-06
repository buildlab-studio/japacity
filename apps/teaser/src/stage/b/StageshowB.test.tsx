// The second stageshow cut's measures: its length, where each scene and the end card start, and where the pictures that
// stand for it are taken.
import { describe, expect, test } from "vitest";

import { END_FRAMES, FADE, framesOf } from "../cut";
import { STAGE_STILLS } from "../stills";
import { ORDER_B, STAGESHOW_B_COMPOSITIONS, STAGESHOW_B_FRAMES, STAGESHOW_B_FROM } from "./StageshowB";
import { RACKS_BEAT, TIMINGS_B } from "./timings";

const FPS = STAGESHOW_B_COMPOSITIONS.StageshowBPortrait.fps;

describe("the second stageshow cut", () => {
  test("given the portrait composition, when its size and length are read, then it is 1080 by 1920 and runs between eighteen and twenty two seconds", () => {
    const { width, height, durationInFrames } = STAGESHOW_B_COMPOSITIONS.StageshowBPortrait;
    expect([width, height]).toEqual([1080, 1920]);
    expect(durationInFrames).toBe(STAGESHOW_B_FRAMES);
    expect(durationInFrames / FPS).toBeGreaterThanOrEqual(18);
    expect(durationInFrames / FPS).toBeLessThanOrEqual(22);
  });

  test("given the scenes in order, when each one's start is read, then each starts as the one before fades out and the end card closes the cut", () => {
    let at = 0;
    for (const scene of ORDER_B) {
      expect(STAGESHOW_B_FROM[scene]).toBe(at);
      at += framesOf(TIMINGS_B[scene]) - FADE;
    }
    expect(STAGESHOW_B_FROM.end).toBe(at);
    expect(STAGESHOW_B_FROM.end + END_FRAMES).toBe(STAGESHOW_B_FRAMES);
  });

  test("given the hook, when its press is read, then Start work is pressed within the cut's first second", () => {
    expect(ORDER_B[0]).toBe("b-racks");
    expect(RACKS_BEAT.press).toBeLessThan(1000);
  });

  test("given its stills, when their frames are read, then the opening is before Start work is pressed and the end is on the end card", () => {
    const open = STAGE_STILLS.find((still) => still.name === "b-portrait-open");
    const end = STAGE_STILLS.find((still) => still.name === "b-portrait-end");
    expect(open?.id).toBe("StageshowBPortrait");
    expect(end?.id).toBe("StageshowBPortrait");
    expect(open?.frame).toBeLessThan(Math.round((RACKS_BEAT.press * FPS) / 1000));
    expect(end?.frame).toBeGreaterThan(STAGESHOW_B_FROM.end);
    expect(end?.frame).toBeLessThan(STAGESHOW_B_FRAMES);
  });
});
