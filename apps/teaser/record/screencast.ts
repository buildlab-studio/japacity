// The phone's screen recorded frame by frame at its own pixels. Playwright's recordVideo writes the page at its CSS size
// (390 by 844 for the phone), half of what the phone shows at scale 2; Chromium's screencast, reached through the same
// Playwright page, hands each frame at the device's pixels with its time, which is what a 1080 frame needs.
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Page } from "@playwright/test";

export interface Frame {
  readonly at: number;
  readonly file: string;
}

export interface Recording {
  /** Seconds since the recording started, read from the browser's own frame times. */
  readonly now: () => number;
  readonly stop: () => Promise<readonly Frame[]>;
}

/** Starts the screencast on a page; frames are written as JPEG files into the folder given. */
export async function startScreencast(page: Page, folder: string, size: { width: number; height: number }): Promise<Recording> {
  rmSync(folder, { recursive: true, force: true });
  mkdirSync(folder, { recursive: true });
  const session = await page.context().newCDPSession(page);
  const frames: Frame[] = [];
  const started = Date.now();
  let first: number | null = null;
  let offset = 0;
  session.on("Page.screencastFrame", (event: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
    const stamp = event.metadata.timestamp ?? Date.now() / 1000;
    if (first === null) {
      first = stamp;
      offset = (Date.now() - started) / 1000;
    }
    const file = join(folder, `${String(frames.length).padStart(5, "0")}.jpg`);
    writeFileSync(file, Buffer.from(event.data, "base64"));
    frames.push({ at: stamp - first + offset, file });
    void session.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => undefined);
  });
  await session.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: size.width, maxHeight: size.height, everyNthFrame: 1 });
  return {
    now: () => (Date.now() - started) / 1000,
    stop: async () => {
      await session.send("Page.stopScreencast").catch(() => undefined);
      await session.detach().catch(() => undefined);
      return frames;
    },
  };
}

/**
 * Writes the frames between two times as a WebM at a steady 30 frames a second: each frame holds until the next one came,
 * as the screencast only sends a frame when the screen changed. `shape` is an ffmpeg filter run on each frame first (the
 * tall shots' crop to 1080 by 1920).
 */
export function cutClip(frames: readonly Frame[], from: number, to: number, out: string, ffmpeg: string, shape?: string): number {
  const inside = frames.filter((frame) => frame.at <= to);
  const startAt = inside.findLastIndex((frame) => frame.at <= from);
  const chosen = inside.slice(Math.max(0, startAt));
  if (chosen.length === 0) throw new Error(`No frames between ${String(from)} and ${String(to)} for ${out}`);
  const lines = ["ffconcat version 1.0"];
  chosen.forEach((frame, index) => {
    const begins = Math.max(frame.at, from);
    const ends = index + 1 < chosen.length ? (chosen[index + 1]?.at ?? to) : to;
    lines.push(`file '${frame.file}'`, `duration ${Math.max(ends - begins, 0.001).toFixed(4)}`);
  });
  // The concat format needs the last file named again for its duration to count.
  const last = chosen.at(-1);
  if (last !== undefined) lines.push(`file '${last.file}'`);
  const list = `${out}.ffconcat`;
  writeFileSync(list, `${lines.join("\n")}\n`);
  const result = spawnSync(
    ffmpeg,
    ["-loglevel", "error", "-y", "-safe", "0", "-f", "concat", "-i", list, "-vf", `${shape === undefined ? "" : `${shape},`}fps=30,format=yuv420p`, "-c:v", "libvpx-vp9", "-crf", "30", "-b:v", "0", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-an", out],
    { stdio: "inherit" },
  );
  rmSync(list, { force: true });
  if (result.status !== 0) throw new Error(`ffmpeg failed for ${out}`);
  return to - from;
}
