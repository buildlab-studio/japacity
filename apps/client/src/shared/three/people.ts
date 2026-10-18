// People in the city: a copy of a shipped person, posed by bone name with the pipeline's poses, then
// idling by a few small rotations driven by the shared clock. One update runs for the whole crowd;
// no person has a loop of its own.
import { type PoseName, poseRotations } from "@japacity/models/people/poses";
import { type Bone, type Object3D, type SkinnedMesh } from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";

/** The hips' height the poses are written for: a 1.70 m body (poses.ts). */
const POSE_HIPS = 0.95;

export interface Figure {
  root: Object3D;
  bones: Map<string, Bone>;
  /** The hips' height in the file's bind pose. */
  hipsY: number;
  /** Each bone's rotation as bound, kept where a pose names no turn for it, as the stage does. */
  rest: Map<string, [number, number, number]>;
  /** A phase so no two people breathe together. */
  phase: number;
  pose: PoseName;
}

/** A posable copy of a loaded person; the copy shares the original's geometry and materials. */
export function figureOf(model: Object3D, pose: PoseName, phase: number): Figure {
  const root = clone(model);
  const bones = new Map<string, Bone>();
  root.traverse((object) => {
    const bone = object as Bone;
    if (bone.isBone) bones.set(bone.name, bone);
    const skinned = object as SkinnedMesh;
    // A skinned body's bounds do not follow its pose, so it is never culled by them.
    if (skinned.isSkinnedMesh) skinned.frustumCulled = false;
  });
  const hipsY = bones.get("hips")?.position.y ?? POSE_HIPS;
  const rest = new Map([...bones].map(([name, bone]): [string, [number, number, number]] => [name, [bone.rotation.x, bone.rotation.y, bone.rotation.z]]));
  return { root, bones, rest, hipsY, phase, pose };
}

/**
 * Sets a figure's bones for a pose at `time` seconds. A standing pose breathes, shifts its weight
 * and looks about; a walk takes `stride` from 0 to 1 through a step.
 */
export function poseFigure(figure: Figure, time: number, pose: PoseName = figure.pose, stride = 0): void {
  const { rotations, hipsY } = poseRotations(pose, stride);
  for (const [name, bone] of figure.bones) {
    const turn = rotations[name as keyof typeof rotations] ?? figure.rest.get(name) ?? [0, 0, 0];
    bone.rotation.set(turn[0], turn[1], turn[2]);
  }
  const hips = figure.bones.get("hips");
  if (hips !== undefined) hips.position.y = hipsY === undefined ? figure.hipsY : (hipsY * figure.hipsY) / POSE_HIPS;
  if (pose === "walk" || pose === "trayWalk") return;
  const breath = Math.sin(time * 1.4 + figure.phase);
  const sway = Math.sin(time * 0.6 + figure.phase);
  const nudge = (name: string, x: number, y: number, z: number): void => {
    const bone = figure.bones.get(name);
    if (bone === undefined) return;
    bone.rotation.x += x;
    bone.rotation.y += y;
    bone.rotation.z += z;
  };
  nudge("chest", breath * 0.025, 0, 0);
  nudge("spine", 0, 0, sway * 0.03);
  nudge("hips", 0, 0, -sway * 0.02);
  nudge("head", breath * 0.02, Math.sin(time * 0.37 + figure.phase * 2) * 0.22, 0);
  nudge("upperArmL", sway * 0.05, 0, 0);
  nudge("upperArmR", -sway * 0.05, 0, 0);
  if (hips !== undefined) hips.position.y += breath * 0.004;
}

/**
 * Sets a figure's bones `share` of the way, 0 to 1, from one pose to another, with no breathing: a
 * short move such as climbing onto a bike, where the poses alone would jump.
 */
export function blendFigure(figure: Figure, from: PoseName, to: PoseName, share: number): void {
  const a = poseRotations(from);
  const b = poseRotations(to);
  const s = Math.min(1, Math.max(0, share));
  for (const [name, bone] of figure.bones) {
    const rest = figure.rest.get(name) ?? [0, 0, 0];
    const p = a.rotations[name as keyof typeof a.rotations] ?? rest;
    const q = b.rotations[name as keyof typeof b.rotations] ?? rest;
    bone.rotation.set(p[0] + (q[0] - p[0]) * s, p[1] + (q[1] - p[1]) * s, p[2] + (q[2] - p[2]) * s);
  }
  const hips = figure.bones.get("hips");
  if (hips === undefined) return;
  const low = a.hipsY ?? POSE_HIPS;
  const high = b.hipsY ?? POSE_HIPS;
  hips.position.y = ((low + (high - low) * s) * figure.hipsY) / POSE_HIPS;
}
