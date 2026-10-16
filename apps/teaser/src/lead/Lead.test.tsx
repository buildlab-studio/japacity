import { existsSync } from "node:fs";
import { join } from "node:path";

import { Player } from "@remotion/player";
import type { ComponentType } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Internals } from "remotion";
import { afterEach, describe, expect, test } from "vitest";

import { TALL_CLIPS } from "../clips";
import { TALL_VIDEO, VIDEO } from "../parts/tokens";
import { type Act, END_LINE, Lead, LEAD_COMPOSITIONS, LEAD_FRAMES, LEAD_SHOTS, LeadPortrait, STRIP } from "./Lead";
import { PORTRAIT_STILLS } from "./stills";

// A page test reads the module as a web address, so the folder is found from the repository root the tests run in.
const CLIP_FOLDER = join(process.cwd(), "apps", "teaser", "clips");

// React's act() needs this flag in a test page.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mounted: { unmount: () => void; host: HTMLElement } | null = null;

function unmount(): void {
  act(() => mounted?.unmount());
  mounted?.host.remove();
  mounted = null;
}

afterEach(unmount);

/** One of the cut's two compositions drawn at one frame, as Remotion's player draws it; the page is returned to be read. */
function mountAt(component: ComponentType, size: { width: number; height: number; fps: number }, frame: number): HTMLElement {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => {
    // The player registers a video's sequence with the studio's timeline, which a page in a test has not got: the
    // manager the studio would give is given here.
    root.render(
      <Internals.SequenceManagerProvider>
        <Player component={component} compositionWidth={size.width} compositionHeight={size.height} durationInFrames={LEAD_FRAMES} fps={size.fps} initialFrame={frame} numberOfSharedAudioTags={0} acknowledgeRemotionLicense />
      </Internals.SequenceManagerProvider>,
    );
  });
  mounted = { unmount: () => root.unmount(), host };
  return host;
}

const portraitAt = (frame: number) => mountAt(LeadPortrait, TALL_VIDEO, frame);

/** The middle frame of every shot in an act. */
function middles(of: Act): number[] {
  return LEAD_SHOTS.filter((shot) => shot.act === of).map((shot) => shot.from + Math.floor(shot.frames / 2));
}

/** The window onto the world as the page draws it, in the frame's pixels. */
function windowOf(page: HTMLElement): { width: number; height: number } | null {
  const found = page.querySelector<HTMLElement>("[data-stage-window]");
  return found === null ? null : { width: Number.parseFloat(found.style.width), height: Number.parseFloat(found.style.height) };
}

describe("the decision in its two frames", () => {
  test("given the landscape and the portrait compositions, when their lengths are read, then they last the same frames from the one list of shots, at their own sizes", () => {
    expect(LEAD_COMPOSITIONS.Lead).toEqual({ ...VIDEO, durationInFrames: LEAD_FRAMES });
    expect(LEAD_COMPOSITIONS.LeadPortrait).toEqual({ width: 1080, height: 1920, fps: 30, durationInFrames: LEAD_FRAMES });
    expect(LEAD_COMPOSITIONS.LeadPortrait.durationInFrames).toBe(LEAD_COMPOSITIONS.Lead.durationInFrames);
    const last = LEAD_SHOTS.at(-1);
    expect(last === undefined ? 0 : last.from + last.frames).toBe(LEAD_FRAMES);
  });

  test("given the portrait cut, when it is mounted in the middle of each strip shot, then the world is drawn in a window narrower than the frame", () => {
    const frames = middles("strip");
    expect(frames.length).toBeGreaterThan(0);
    const seen = frames.map((frame) => {
      const drawn = windowOf(portraitAt(frame));
      unmount();
      return drawn;
    });
    for (const drawn of seen) {
      expect(drawn).toEqual({ width: STRIP.w, height: STRIP.h });
      expect(drawn?.width ?? TALL_VIDEO.width).toBeLessThan(TALL_VIDEO.width);
    }
  });

  test("given the portrait cut, when it is mounted in the middle of each shot in the hand, then the window is the whole frame", () => {
    const frames = middles("hand");
    expect(frames.length).toBeGreaterThan(0);
    const seen = frames.map((frame) => {
      const drawn = windowOf(portraitAt(frame));
      unmount();
      return drawn;
    });
    expect(seen).toEqual(frames.map(() => ({ width: TALL_VIDEO.width, height: TALL_VIDEO.height })));
  });

  test("given the turn, when it is mounted at its start and at its end, then the window grows from the strip to the frame and the phone's recording is drawn inside it", () => {
    const turn = LEAD_SHOTS.find((shot) => shot.act === "turn");
    expect(turn).toBeDefined();
    if (turn === undefined) return;
    expect(windowOf(portraitAt(turn.from))).toEqual({ width: STRIP.w, height: STRIP.h });
    unmount();
    const page = portraitAt(turn.from + turn.frames - 1);
    expect(windowOf(page)).toEqual({ width: TALL_VIDEO.width, height: TALL_VIDEO.height });
    const sources = [...page.querySelectorAll("video")].map((video) => video.getAttribute("src") ?? "");
    expect(sources.some((source) => source.includes("clips/tall-day.webm"))).toBe(true);
  });

  test("given the end card, when each composition is mounted on its last frame, then it carries the line under the address", () => {
    expect(END_LINE).toBe("Free. Open source.");
    for (const [component, size] of [
      [Lead, VIDEO],
      [LeadPortrait, TALL_VIDEO],
    ] as const) {
      const page = mountAt(component, size, LEAD_FRAMES - 1);
      const text = page.textContent;
      expect(text).toContain("japacity.app");
      expect(text).toContain(END_LINE);
      expect(text.indexOf(END_LINE)).toBeGreaterThan(text.indexOf("japacity.app"));
      unmount();
    }
  });

  test("given the portrait stills a render keeps, when their frames are read, then each lands in the act it is named for", () => {
    const landed = PORTRAIT_STILLS.map((still) => ({ name: still.name, act: LEAD_SHOTS.find((one) => still.frame >= one.from && still.frame < one.from + one.frames)?.act }));
    expect(landed).toEqual(PORTRAIT_STILLS.map((still) => ({ name: still.name, act: still.act })));
  });

  test("given the tall clips listed, when the folder is read, then every one is on disk", () => {
    expect(TALL_CLIPS.filter((clip) => !existsSync(join(CLIP_FOLDER, clip.file))).map((clip) => clip.file)).toEqual([]);
  });
});
