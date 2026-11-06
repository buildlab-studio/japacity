// A stageshow cut: scenes of the stage page (page/main.tsx), each in an iframe whose clock is moved to the composition's
// frame (page/drive.ts), so every frame is the same on every render and the sounds fall on the taps they belong to;
// the scenes fade one into the next and close on the end card the lead cut plays. `Stageshow` and `StageshowB` are cuts.
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { useEffect, useRef } from "react";
import { AbsoluteFill, Audio, cancelRender, continueRender, delayRender, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

import { NAVY } from "@japacity/brand";

import { LightsOut } from "../lead/Lead";
import { loadRubik } from "../parts/fonts";
import { FrameContext, VIDEO } from "../parts/frame";
import type { Shape } from "./host";
import type { StageDriver } from "./page/drive";
import type { Timing } from "./timeline";

/** Frames each cut takes to fade from one scene to the next. */
export const FADE = 8;
/** The end card's length, as the lead cut holds it. */
export const END_FRAMES = 96;

const FPS = VIDEO.fps;

/** A cut's scenes in the order it plays them, each with its length and sounds. */
export interface CutPlan {
  readonly order: readonly string[];
  readonly timings: Readonly<Record<string, Timing>>;
}

/** A scene's length in frames. */
export function framesOf(timing: Timing): number {
  return Math.round((timing.length * FPS) / 1000);
}

/** A whole cut's length: the scenes and the end card, less the frames each fade lays two shots over each other. */
export function cutFrames(plan: CutPlan): number {
  return plan.order.reduce((sum, scene) => sum + framesOf(timingOf(plan, scene)), 0) + END_FRAMES - FADE * plan.order.length;
}

/** Where each scene and the end card start in a cut. */
export function cutFrom(plan: CutPlan): Readonly<Record<string, number>> {
  const from: Record<string, number> = {};
  let at = 0;
  for (const scene of plan.order) {
    from[scene] = at;
    at += framesOf(timingOf(plan, scene)) - FADE;
  }
  from.end = at;
  return from;
}

function timingOf(plan: CutPlan, scene: string): Timing {
  const timing = plan.timings[scene];
  if (timing === undefined) throw new Error(`The cut has no timing for the scene ${scene}.`);
  return timing;
}

type Host = { __teaserStage?: StageDriver };

async function driverOf(frame: HTMLIFrameElement): Promise<StageDriver> {
  for (let waited = 0; waited < 120_000; waited += 25) {
    const host: (Window & Host) | null = frame.contentWindow;
    const driver = host?.__teaserStage;
    if (driver !== undefined) {
      await driver.ready;
      return driver;
    }
    await new Promise((done) => setTimeout(done, 25));
  }
  throw new Error("The stage page never offered its driver.");
}

/** One scene of the stage page, its clock held to this sequence's frame. A frame behind the page's loads it again. */
function StageShot({ scene, shape }: { scene: string; shape: Shape }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ref = useRef<HTMLIFrameElement>(null);
  const src = `${staticFile("dist/index.html")}?scene=${scene}&shape=${shape}&drive=frames`;
  useEffect(() => {
    const handle = delayRender(`The ${scene} scene at its frame ${String(frame)}`, { timeoutInMilliseconds: 120_000 });
    const iframe = ref.current;
    if (iframe === null) {
      continueRender(handle);
      return;
    }
    void (async () => {
      let driver = await driverOf(iframe);
      if (driver.frame() > frame) {
        iframe.contentWindow?.location.reload();
        await new Promise((done) => setTimeout(done, 50));
        driver = await driverOf(iframe);
      }
      await driver.seek(frame);
      continueRender(handle);
    })().catch((error: unknown) => cancelRender(error));
  }, [frame, scene]);
  return <iframe ref={ref} src={src} title={scene} style={{ width, height, border: 0, display: "block" }} />;
}

/** A sound at a moment of a scene, from public/sound. */
function Sound({ name, at, volume }: { name: string; at: number; volume: number }) {
  return (
    <Sequence from={at} layout="none">
      <Audio src={staticFile(`sound/${name}`)} volume={volume} />
    </Sequence>
  );
}

function SceneWithSound({ scene, shape, timing }: { scene: string; shape: Shape; timing: Timing }) {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <StageShot scene={scene} shape={shape} />
      {timing.cues.map((cue, index) => (
        <Sound key={index} name={cue.sound} at={Math.round((cue.at * fps) / 1000)} volume={cue.volume} />
      ))}
    </AbsoluteFill>
  );
}

/** The end card as the lead cut plays it, with its sounds: the seal's pop, the two clicks, the swell and the button. */
function End({ shape }: { shape: Shape }) {
  return (
    <FrameContext.Provider value={shape}>
      <AbsoluteFill>
        <LightsOut />
        <Sound name="pop.wav" at={1} volume={0.6} />
        <Sound name="click.wav" at={22} volume={1} />
        <Sound name="click.wav" at={46} volume={1} />
        <Sound name="swell.wav" at={46} volume={0.9} />
        <Sound name="pop.wav" at={67} volume={0.6} />
      </AbsoluteFill>
    </FrameContext.Provider>
  );
}

/** A cut in one frame: its scenes in order, the bed under them with the lead cut's dip and fade, and the end card. */
export function Cut({ plan, shape }: { plan: CutPlan; shape: Shape }) {
  loadRubik();
  const total = cutFrames(plan);
  const end = cutFrom(plan).end ?? total - END_FRAMES;
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Audio
        src={staticFile("sound/bed.m4a")}
        volume={(f) => {
          const dark = f >= end + 22 && f < end + 46 ? 0.12 : 1;
          const tail = interpolate(f, [total - 36, total], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const head = interpolate(f, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return 0.42 * dark * tail * head;
        }}
      />
      <TransitionSeries>
        {plan.order.flatMap((scene) => [
          <TransitionSeries.Sequence key={scene} durationInFrames={framesOf(timingOf(plan, scene))}>
            <SceneWithSound scene={scene} shape={shape} timing={timingOf(plan, scene)} />
          </TransitionSeries.Sequence>,
          <TransitionSeries.Transition key={`${scene}-fade`} presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />,
        ])}
        <TransitionSeries.Sequence durationInFrames={END_FRAMES}>
          <End shape={shape} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
}
