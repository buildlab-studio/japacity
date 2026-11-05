// The stageshow teaser: the game's own screens as product shots, in the order of a life. Who you are at the front door, a
// step on the brief done on the phone, the month's results with a sponsor that may not be one, the ways out on the phone,
// and the end card the lead cut closes on. Each scene is the stage page (page/main.tsx) in an iframe, its clock moved
// to this composition's frame (page/drive.ts), so every frame is the same on every render and the sounds fall on the
// taps they belong to. `Stageshow` is the laptop (1920 by 1080); `StageshowPortrait` the phone in the hand (1080 by 1920).
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { useEffect, useRef } from "react";
import { AbsoluteFill, Audio, cancelRender, continueRender, delayRender, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

import { NAVY } from "@japacity/brand";

import { LightsOut } from "../lead/Lead";
import { loadRubik } from "../parts/fonts";
import { FrameContext, TALL_VIDEO, VIDEO } from "../parts/frame";
import type { Shape } from "./host";
import type { StageDriver } from "./page/drive";
import { type SceneName, TIMINGS } from "./timings";

/** The scenes in the order the cut plays them. */
export const ORDER: readonly SceneName[] = ["door", "step", "month", "ways"];
/** Frames each cut takes to fade from one scene to the next. */
export const FADE = 8;
/** The end card's length, as the lead cut holds it. */
export const END_FRAMES = 96;

const FPS = VIDEO.fps;

/** A scene's length in frames. */
export function sceneFrames(scene: SceneName): number {
  return Math.round((TIMINGS[scene].length * FPS) / 1000);
}

/** The whole cut's length: the scenes and the end card, less the frames each fade lays two shots over each other. */
export const STAGESHOW_FRAMES = ORDER.reduce((sum, scene) => sum + sceneFrames(scene), 0) + END_FRAMES - FADE * ORDER.length;

/** Where each scene and the end card start in the cut. */
export const STAGESHOW_FROM: Readonly<Record<SceneName | "end", number>> = (() => {
  const from: Record<string, number> = {};
  let at = 0;
  for (const scene of ORDER) {
    from[scene] = at;
    at += sceneFrames(scene) - FADE;
  }
  from.end = at;
  return from as Record<SceneName | "end", number>;
})();

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
function StageShot({ scene, shape }: { scene: SceneName; shape: Shape }) {
  const frame = useCurrentFrame();
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
  const size = shape === "tall" ? TALL_VIDEO : VIDEO;
  return <iframe ref={ref} src={src} title={scene} style={{ width: size.width, height: size.height, border: 0, display: "block" }} />;
}

/** A sound at a moment of a scene, from public/sound. */
function Sound({ name, at, volume }: { name: string; at: number; volume: number }) {
  return (
    <Sequence from={at} layout="none">
      <Audio src={staticFile(`sound/${name}`)} volume={volume} />
    </Sequence>
  );
}

function SceneWithSound({ scene, shape }: { scene: SceneName; shape: Shape }) {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <StageShot scene={scene} shape={shape} />
      {TIMINGS[scene].cues.map((cue, index) => (
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

function Cut({ shape }: { shape: Shape }) {
  loadRubik();
  const end = STAGESHOW_FROM.end;
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Audio
        src={staticFile("sound/bed.m4a")}
        volume={(f) => {
          const dark = f >= end + 22 && f < end + 46 ? 0.12 : 1;
          const tail = interpolate(f, [STAGESHOW_FRAMES - 36, STAGESHOW_FRAMES], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const head = interpolate(f, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return 0.42 * dark * tail * head;
        }}
      />
      <TransitionSeries>
        {ORDER.flatMap((scene) => [
          <TransitionSeries.Sequence key={scene} durationInFrames={sceneFrames(scene)}>
            <SceneWithSound scene={scene} shape={shape} />
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

/** The stageshow teaser on a laptop, 1920 by 1080. */
export function Stageshow() {
  return <Cut shape="wide" />;
}

/** The stageshow teaser in the hand, 1080 by 1920. */
export function StageshowPortrait() {
  return <Cut shape="tall" />;
}

export const STAGESHOW_COMPOSITIONS = {
  Stageshow: { ...VIDEO, durationInFrames: STAGESHOW_FRAMES },
  StageshowPortrait: { ...TALL_VIDEO, durationInFrames: STAGESHOW_FRAMES },
} as const;
