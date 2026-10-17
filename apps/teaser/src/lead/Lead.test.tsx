import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { Player } from "@remotion/player";
import type { ComponentType } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Internals } from "remotion";
import { afterEach, describe, expect, test } from "vitest";

import { TALL_CLIPS } from "../clips";
import { GITHUB_MARK } from "../parts/brand";
import { TALL_VIDEO, VIDEO } from "../parts/tokens";
import { FEED_BARS, type Zone, ZONES } from "../parts/zones";
import { END_LINE, layLines, Lead, LEAD_COMPOSITIONS, LEAD_FRAMES, LEAD_SHOTS, LeadPortrait } from "./Lead";
import { STILLS } from "./stills";

// A page test reads the module as a web address, so the folders are found from the repository root the tests run in.
const CLIP_FOLDER = join(process.cwd(), "apps", "teaser", "clips");
const PARTS_FOLDER = join(process.cwd(), "apps", "teaser", "src", "parts");

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

/** The frames a walk of a shot looks at: its first, a quarter in, the middle, three quarters in, and its last. */
function walk(shot: { from: number; frames: number }): number[] {
  return [0, 0.25, 0.5, 0.75, 1].map((at) => shot.from + Math.min(shot.frames - 1, Math.round((shot.frames - 1) * at)));
}

/** Every piece of ours on the page, with its zone and its box in the tall frame's pixels. */
function piecesOf(page: HTMLElement): { name: string; zone: Zone; top: number; bottom: number; left: number | null; right: number | null }[] {
  return [...page.querySelectorAll<HTMLElement>("[data-piece]")].map((found) => {
    const top = Number.parseFloat(found.style.top);
    const left = found.style.left === "" ? null : Number.parseFloat(found.style.left);
    const width = found.style.width === "" ? null : Number.parseFloat(found.style.width);
    return { name: found.dataset.piece ?? "", zone: (found.dataset.zone ?? "safe") as Zone, top, bottom: top + Number.parseFloat(found.style.height), left, right: left === null || width === null ? null : left + width };
  });
}

/** The recordings a page draws, by file. */
function videosOf(page: HTMLElement): string[] {
  return [...page.querySelectorAll("video")].map((video) => video.getAttribute("src") ?? "");
}

describe("the lead cut in its two frames", () => {
  test("given the landscape and the portrait compositions, when their lengths are read, then they last the same frames from the one list of shots, at their own sizes", () => {
    expect(LEAD_COMPOSITIONS.Lead).toEqual({ ...VIDEO, durationInFrames: LEAD_FRAMES });
    expect(LEAD_COMPOSITIONS.LeadPortrait).toEqual({ width: 1080, height: 1920, fps: 30, durationInFrames: LEAD_FRAMES });
    expect(LEAD_COMPOSITIONS.LeadPortrait.durationInFrames).toBe(LEAD_COMPOSITIONS.Lead.durationInFrames);
    const last = LEAD_SHOTS.at(-1);
    expect(last === undefined ? 0 : last.from + last.frames).toBe(LEAD_FRAMES);
  });

  test("given the portrait teaser, when every shot of the city and the turn is mounted at its middle, then the phone's own recording fills the frame and no wide one is drawn", () => {
    const shots = LEAD_SHOTS.filter((shot) => shot.act === "city" || shot.act === "turn");
    expect(shots.length).toBe(8);
    for (const shot of shots) {
      const page = portraitAt(shot.from + Math.floor(shot.frames / 2));
      const picture = page.querySelector<HTMLElement>("[data-picture]");
      expect(picture?.dataset.picture).toMatch(/^tall-/);
      expect(Number.parseFloat(picture?.style.width ?? "0")).toBeGreaterThanOrEqual(TALL_VIDEO.width);
      expect(Number.parseFloat(picture?.style.height ?? "0")).toBeGreaterThanOrEqual(TALL_VIDEO.height);
      expect(videosOf(page).filter((source) => source.includes("clips/wide-"))).toEqual([]);
      unmount();
    }
  });

  test("given the portrait teaser, when every shot is walked at five frames, then every piece of ours stands in its zone, inside the frame and clear of the feed's bars above 220 and below 1540", () => {
    const outside: string[] = [];
    for (const [index, shot] of LEAD_SHOTS.entries()) {
      const counted = walk(shot).map((frame) => {
        const pieces = piecesOf(portraitAt(frame));
        unmount();
        for (const piece of pieces) {
          const [top, bottom] = ZONES[piece.zone];
          const where = `shot ${String(index)} frame ${String(frame)} ${piece.name} (${piece.zone}) ${String(Math.round(piece.top))} to ${String(Math.round(piece.bottom))}`;
          if (piece.top < Math.max(top, FEED_BARS.top) || piece.bottom > Math.min(bottom, FEED_BARS.bottom)) outside.push(where);
          if ((piece.left !== null && piece.left < 0) || (piece.right !== null && piece.right > TALL_VIDEO.width)) outside.push(`${where}, sideways`);
        }
        return pieces.length;
      });
      expect(Math.max(...counted), `shot ${String(index)} draws pieces`).toBeGreaterThan(0);
    }
    expect(outside).toEqual([]);
  });

  test("given a bubble's words, when they are laid in lines, then every line fits and a line ends where the sense does", () => {
    expect(layLines("Small small, I go reach.", 28)).toEqual([["Small", "small,", "I", "go", "reach."]]);
    expect(layLines("Oshodi, Oshodi. Enter with your change o.", 28)).toEqual([["Oshodi,", "Oshodi."], ["Enter", "with", "your", "change", "o."]]);
    expect(layLines("Who get change for one thousand?", 26).map((line) => line.join(" "))).toEqual(["Who get change", "for one thousand?"]);
    expect(() => layLines("Unbreakable", 4)).toThrow();
  });

  test("given both end cards, when each composition is mounted on its last frame, then GitHub's mark stands before the open source line, under the address", () => {
    expect(END_LINE).toBe("Free. Open source on GitHub.");
    for (const [component, size] of [
      [Lead, VIDEO],
      [LeadPortrait, TALL_VIDEO],
    ] as const) {
      const page = mountAt(component, size, LEAD_FRAMES - 1);
      const text = page.textContent;
      expect(text).toContain("japacity.app");
      expect(text).toContain(END_LINE);
      expect(text.indexOf(END_LINE)).toBeGreaterThan(text.indexOf("japacity.app"));
      const line = page.querySelector<HTMLElement>("[data-end-line]");
      expect(line?.textContent).toBe(END_LINE);
      const mark = line?.firstElementChild;
      expect(mark?.hasAttribute("data-github-mark")).toBe(true);
      expect(mark?.querySelector("path")?.getAttribute("d")).toBe(GITHUB_MARK.path);
      unmount();
    }
  });

  test("given GitHub's mark as GitHub hands it out, when the file kept beside the brand is read, then the drawn mark has its box and its path unaltered", () => {
    const file = readFileSync(join(PARTS_FOLDER, "GitHub_Invertocat_White.svg"), "utf8");
    expect(file).toContain(`viewBox="0 0 ${String(GITHUB_MARK.width)} ${String(GITHUB_MARK.height)}"`);
    expect(/<path d="([^"]+)"/.exec(file)?.[1]).toBe(GITHUB_MARK.path);
  });

  test("given the stills a render keeps, when their frames are read, then each lands in the act it is named for, in its composition's length", () => {
    const landed = STILLS.map((still) => ({ name: still.name, act: LEAD_SHOTS.find((one) => still.frame >= one.from && still.frame < one.from + one.frames)?.act }));
    expect(landed).toEqual(STILLS.map((still) => ({ name: still.name, act: still.act })));
    expect(STILLS.map((still) => still.name)).toEqual(["portrait-open", "portrait-street", "portrait-turn", "portrait-hand", "portrait-end", "portrait-feed", "landscape-end"]);
  });

  test("given the tall clips listed, when the folder is read, then every one is on disk", () => {
    expect(TALL_CLIPS.filter((clip) => !existsSync(join(CLIP_FOLDER, clip.file))).map((clip) => clip.file)).toEqual([]);
  });
});
