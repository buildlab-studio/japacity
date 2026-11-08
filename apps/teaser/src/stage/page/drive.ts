// How the stage page is driven. Opened with `?drive=frames` (as the stageshow compositions open it inside an iframe), the
// page's clocks are the kit's virtual clock (kit/clock.ts): time moves only when the parent asks for a frame, so each
// frame of the video is the same on every render and a timed beat lands on a known frame. Opened without it (the dev
// server, film.mjs), the page keeps the browser's own clocks. This module is imported before anything else on the page,
// so the clock is in place before the kit's code runs.
import { type ClockControl, installVirtualClock } from "../kit/clock";

/** The frames a second of the videos the page is filmed into. */
export const FPS = 30;

/** What the page offers the composition that drives it, at `window.__teaserStage`. */
export interface StageDriver {
  /** Resolves once the fonts and pictures are in, the stage is placed and its script has started. */
  readonly ready: Promise<void>;
  /** The frame the page shows. */
  frame(): number;
  /** Moves time forward to a frame; a frame behind the one shown is refused, and the caller loads the page again. */
  seek(frame: number): Promise<void>;
}

type Host = { __teaserStage?: StageDriver };

const params = new URLSearchParams(window.location.search);
const driven = params.get("drive") === "frames";
// The native frame callback, taken before the virtual clock replaces it, so the page can wait for its own layout.
const nativeFrame = window.requestAnimationFrame.bind(window);
/** A fixed morning for anything that reads the date, so the status bar's clock is the same on every render. */
const EPOCH = Date.UTC(2026, 10, 5, 8, 41);
const clock: ClockControl | null = driven ? installVirtualClock({ fps: FPS, epoch: EPOCH }) : null;

function nextPaint(): Promise<void> {
  return new Promise((done) => nativeFrame(() => done()));
}

async function settled(root: HTMLElement, control: ClockControl): Promise<void> {
  await document.fonts.ready;
  for (let guard = 0; guard < 600; guard += 1) {
    const stage = root.querySelector(".ss-stage");
    const pictures = [...root.querySelectorAll("img")];
    const loaded = pictures.every((picture) => picture.complete);
    const placing = stage === null || stage.hasAttribute("data-placing") || control.layoutPending;
    const started = stage?.hasAttribute("data-mark") ?? false;
    if (loaded && !placing && started) return;
    if (placing) await control.flushLayout();
    await nextPaint();
  }
  throw new Error("The stage page did not settle: its pictures, its placing or its script never finished starting.");
}

/** Hands the composition its driver once the scene is mounted in `root`; nothing to do when the page keeps real time. */
export function offerDriver(root: HTMLElement): void {
  if (clock === null) return;
  const control = clock;
  let queue: Promise<void> = Promise.resolve();
  const ready = settled(root, control);
  const driver: StageDriver = {
    ready,
    frame: () => control.frame,
    seek(frame) {
      queue = queue.then(async () => {
        await ready;
        if (frame < control.frame) throw new Error(`The stage page shows frame ${String(control.frame)} and cannot go back to ${String(frame)}.`);
        if (frame > control.frame) await control.step(frame - control.frame);
      });
      return queue;
    },
  };
  (window as unknown as Host).__teaserStage = driver;
}
