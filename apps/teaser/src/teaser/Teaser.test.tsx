import { existsSync } from "node:fs";
import { join } from "node:path";

import { Player } from "@remotion/player";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Internals } from "remotion";
import { afterEach, describe, expect, test } from "vitest";

import { CLIPS, STILLS } from "../clips";
import { VIDEO } from "../parts/frame";
import { shotStarts, Teaser, TEASER_FRAMES, TEASER_SHOTS } from "./Teaser";

// A page test reads the module as a web address, so the folder is found from the repository root the tests run in.
const CLIP_FOLDER = join(process.cwd(), "apps", "teaser", "clips");

// React's act() needs this flag in a test page.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mounted: { unmount: () => void; host: HTMLElement } | null = null;

afterEach(() => {
  act(() => mounted?.unmount());
  mounted?.host.remove();
  mounted = null;
});

/** The teaser drawn at one frame, as Remotion's player draws it; the page is returned to be read. */
function mountAt(frame: number): HTMLElement {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  act(() => {
    // The player registers a video's sequence with the studio's timeline, which a page in a test has not got: the
    // manager the studio would give is given here.
    root.render(
      <Internals.SequenceManagerProvider>
        <Player component={Teaser} compositionWidth={VIDEO.width} compositionHeight={VIDEO.height} durationInFrames={TEASER_FRAMES} fps={VIDEO.fps} initialFrame={frame} acknowledgeRemotionLicense />
      </Internals.SequenceManagerProvider>,
    );
  });
  mounted = { unmount: () => root.unmount(), host };
  return host;
}

describe("the teaser", () => {
  test("given the composition, when its length is read, then it lasts thirty seconds at thirty frames a second, 1920 by 1080", () => {
    expect(VIDEO).toEqual({ width: 1920, height: 1080, fps: 30 });
    expect(TEASER_FRAMES).toBe(30 * VIDEO.fps);
    expect(shotStarts(TEASER_SHOTS).at(-1)! + TEASER_SHOTS.at(-1)!.frames).toBe(TEASER_FRAMES);
  });

  test("given the clips listed, when the teaser is mounted in the middle of each shot that shows one, then that shot draws the clip, every clip listed is shown and its file and the map's stills are on disk", () => {
    const starts = shotStarts(TEASER_SHOTS);
    const missing: string[] = [];
    const shown = new Set<string>();
    TEASER_SHOTS.forEach((shot, index) => {
      if (shot.clips.length === 0) return;
      const page = mountAt((starts[index] ?? 0) + Math.floor(shot.frames / 2));
      const sources = [...page.querySelectorAll("video")].map((video) => video.getAttribute("src") ?? "");
      for (const name of shot.clips) {
        const file = CLIPS.find((one) => one.name === name)?.file ?? `${name} (not listed)`;
        if (sources.some((source) => source.includes(`clips/${file}`))) shown.add(name);
        else missing.push(`${name} in shot ${String(index)}`);
      }
      act(() => mounted?.unmount());
      mounted?.host.remove();
      mounted = null;
    });
    expect(missing).toEqual([]);
    expect([...shown].sort()).toEqual(CLIPS.map((clip) => clip.name).sort());
    const absent = [...CLIPS.map((clip) => clip.file), ...STILLS].filter((file) => !existsSync(join(CLIP_FOLDER, file)));
    expect(absent).toEqual([]);
  });
});
