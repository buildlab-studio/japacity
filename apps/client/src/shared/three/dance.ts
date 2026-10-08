// The party room's two dance loops, written in code by bone name (city.md R-CITY-037; the lead's
// prototype, prototypes/asset-lab/party.js, `twoStep` and `shuffle`): a two-step with a shoulder
// bounce, and the low legwork shuffle. Each is a pose of the loop's share, read off the one shared
// clock in the scene's one frame loop; no dancer keeps a clock or a loop of its own.
import { poseRotations } from "@japacity/assets-src/people/poses";
import type { Bone } from "three";

import type { DanceName } from "../../features/city/placeFile";
import type { Figure } from "./people";

/** Seconds a loop takes, as the prototype baked them. */
export const DANCE_SECONDS: Record<DanceName, number> = { twoStep: 1.6, shuffle: 1.2 };

/** The hips' height the prototype's offsets were written for. */
const POSE_HIPS = 0.95;
const deg = (degrees: number): number => (degrees * Math.PI) / 180;

type Turn = (name: string, x?: number, y?: number, z?: number) => void;

/** Two-step: weight side to side, the free knee lifting, elbows bent and pumping, the head nodding on the beat. */
function twoStep(turn: Turn, hips: Bone | undefined, share: number, scale: number, standY: number): void {
  const phase = share * Math.PI * 2;
  const side = Math.sin(phase);
  const beat = Math.abs(Math.sin(phase * 2));
  if (hips !== undefined) hips.position.set(0.09 * side * scale, standY - 0.05 * beat * scale, hips.position.z);
  turn("hips", undefined, 0.12 * Math.sin(phase), -0.06 * side);
  turn("spine", undefined, undefined, 0.05 * side);
  turn("chest", -0.08 * beat, -0.18 * Math.sin(phase), 0.06 * side);
  turn("head", 0.1 * Math.sin(phase * 2 + 0.6), -0.1 * Math.sin(phase));
  const liftL = Math.max(0, -side);
  const liftR = Math.max(0, side);
  turn("upperLegL", -0.55 * liftL, undefined, 0.08 * side);
  turn("upperLegR", -0.55 * liftR, undefined, 0.08 * side);
  turn("lowerLegL", 0.9 * liftL + 0.12 * beat);
  turn("lowerLegR", 0.9 * liftR + 0.12 * beat);
  turn("footL", 0.3 * liftL);
  turn("footR", 0.3 * liftR);
  turn("upperArmL", -0.35 - 0.45 * Math.sin(phase * 2), undefined, -deg(30) + 0.12 * beat);
  turn("upperArmR", -0.35 + 0.45 * Math.sin(phase * 2), undefined, deg(30) - 0.12 * beat);
  turn("forearmL", -1.6 + 0.3 * beat, undefined, -0.3);
  turn("forearmR", -1.6 + 0.3 * beat, undefined, 0.3);
}

/** Shuffle: quick small steps, knees soft, body low, arms loose and swinging, shoulders rolling. */
function shuffle(turn: Turn, hips: Bone | undefined, share: number, scale: number, standY: number): void {
  const phase = share * Math.PI * 4;
  const sine = Math.sin(phase);
  const cosine = Math.cos(phase);
  const low = 0.06 + 0.02 * Math.abs(cosine);
  if (hips !== undefined) hips.position.set(0.03 * sine * scale, standY - low * scale, hips.position.z);
  turn("hips", undefined, 0.25 * sine, 0.04 * cosine);
  turn("spine", 0.12);
  turn("chest", 0.08 + 0.04 * Math.abs(sine), -0.3 * sine, 0.08 * cosine);
  turn("head", -0.12 + 0.06 * cosine, 0.2 * sine);
  const stepL = Math.max(0, sine);
  const stepR = Math.max(0, -sine);
  turn("upperLegL", -0.35 - 0.4 * stepL, 0.25 * sine);
  turn("upperLegR", -0.35 - 0.4 * stepR, 0.25 * sine);
  turn("lowerLegL", 0.7 + 0.5 * stepL);
  turn("lowerLegR", 0.7 + 0.5 * stepR);
  turn("footL", -0.2 + 0.4 * stepL);
  turn("footR", -0.2 + 0.4 * stepR);
  turn("upperArmL", 0.7 * sine - 0.2, 0.2 * cosine, -deg(20));
  turn("upperArmR", -0.7 * sine - 0.2, 0.2 * cosine, deg(20));
  turn("forearmL", -0.9 - 0.4 * Math.max(0, -sine));
  turn("forearmR", -0.9 - 0.4 * Math.max(0, sine));
}

/** The share of its loop a dancer is at, `time` seconds in: each starts at its own phase. */
export function danceShare(dance: DanceName, time: number, phase: number): number {
  const seconds = DANCE_SECONDS[dance];
  const at = (time + phase) % seconds;
  return (at < 0 ? at + seconds : at) / seconds;
}

/** Sets a figure's bones for its dance at `time` seconds: the standing pose, then the loop's turns over it. */
export function danceFigure(figure: Figure, time: number, dance: DanceName): void {
  const { rotations } = poseRotations("stand");
  for (const [name, bone] of figure.bones) {
    const turn = rotations[name as keyof typeof rotations] ?? figure.rest.get(name) ?? [0, 0, 0];
    bone.rotation.set(turn[0], turn[1], turn[2]);
  }
  const turn: Turn = (name, x, y, z) => {
    const bone = figure.bones.get(name);
    if (bone === undefined) return;
    if (x !== undefined) bone.rotation.x = x;
    if (y !== undefined) bone.rotation.y = y;
    if (z !== undefined) bone.rotation.z = z;
  };
  const scale = figure.hipsY / POSE_HIPS;
  const share = danceShare(dance, time, figure.phase);
  const hips = figure.bones.get("hips");
  switch (dance) {
    case "twoStep":
      twoStep(turn, hips, share, scale, figure.hipsY);
      return;
    case "shuffle":
      shuffle(turn, hips, share, scale, figure.hipsY);
      return;
    default: {
      const never: never = dance;
      throw new Error(`Unknown dance: ${String(never)}`);
    }
  }
}
