// The stageshow cut's measures: its length in both frames, where each scene and the end card start, and where the
// pictures that stand for it are taken.
import { describe, expect, test } from "vitest";

import { DOOR_BEAT } from "./timings";
import { END_FRAMES, FADE, ORDER, sceneFrames, STAGESHOW_COMPOSITIONS, STAGESHOW_FRAMES, STAGESHOW_FROM } from "./Stageshow";
import { STAGE_STILLS } from "./stills";

const FPS = STAGESHOW_COMPOSITIONS.Stageshow.fps;

describe("the stageshow cut", () => {
  test("given the landscape and the portrait compositions, when their lengths are read, then both run the same frames, between twenty five and thirty seconds", () => {
    expect(STAGESHOW_COMPOSITIONS.Stageshow.durationInFrames).toBe(STAGESHOW_FRAMES);
    expect(STAGESHOW_COMPOSITIONS.StageshowPortrait.durationInFrames).toBe(STAGESHOW_FRAMES);
    expect(STAGESHOW_FRAMES / FPS).toBeGreaterThanOrEqual(25);
    expect(STAGESHOW_FRAMES / FPS).toBeLessThanOrEqual(30);
  });

  test("given the scenes in order, when each one's start is read, then each starts as the one before fades out and the end card closes the cut", () => {
    let at = 0;
    for (const scene of ORDER) {
      expect(STAGESHOW_FROM[scene]).toBe(at);
      at += sceneFrames(scene) - FADE;
    }
    expect(STAGESHOW_FROM.end).toBe(at);
    expect(STAGESHOW_FROM.end + END_FRAMES).toBe(STAGESHOW_FRAMES);
  });

  test("given the stills, when their frames are read, then the landscape's end is on the end card and the portrait's opening on the door once the life is picked", () => {
    const end = STAGE_STILLS.find((still) => still.name === "landscape-end");
    const open = STAGE_STILLS.find((still) => still.name === "portrait-open");
    expect(end?.id).toBe("Stageshow");
    expect(open?.id).toBe("StageshowPortrait");
    expect(end?.frame).toBeGreaterThan(STAGESHOW_FROM.end);
    expect(end?.frame).toBeLessThan(STAGESHOW_FRAMES);
    expect(open?.frame).toBeGreaterThan(Math.round((DOOR_BEAT.pick * FPS) / 1000) + 10);
    expect(open?.frame).toBeLessThan(Math.round((DOOR_BEAT.next * FPS) / 1000));
  });
});
