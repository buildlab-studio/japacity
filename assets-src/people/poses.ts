// The design's poses as data. Rotations only, so one pose works on every body; a stage or the
// client poses a loaded skinned mesh by bone name. The hips may also move up or down.
import type { BoneName } from "./people";

export type PoseName = "stand" | "walk" | "hip" | "selfie" | "cheer" | "ride" | "pillion" | "tray" | "trayWalk" | "sell" | "sit";

export interface Pose {
  /** Euler XYZ in radians, from the bind pose. Bones not named stay as bound. */
  rotations: Partial<Record<BoneName, [number, number, number]>>;
  /** The hips bone's height in metres for a 1.70 m body, where the pose moves it. */
  hipsY?: number;
}

const deg = (d: number): number => (d * Math.PI) / 180;

/** `t` runs 0 to 1 through one step of a walk. `stride` is the outfit's (a long wrapper shortens it). */
export function poseRotations(name: PoseName, t = 0, stride = 1): Pose {
  const r: Partial<Record<BoneName, [number, number, number]>> = {};
  const get = (b: BoneName): [number, number, number] => {
    const found = r[b] ?? [0, 0, 0];
    r[b] = found;
    return found;
  };
  const setX = (b: BoneName, v: number): void => {
    get(b)[0] = v;
  };
  const setY = (b: BoneName, v: number): void => {
    get(b)[1] = v;
  };
  const setZ = (b: BoneName, v: number): void => {
    get(b)[2] = v;
  };
  const armsDown = (a: number): void => {
    setZ("upperArmL", -deg(a));
    setZ("upperArmR", deg(a));
  };
  let hipsY: number | undefined;
  switch (name) {
    case "stand":
      armsDown(24);
      setX("forearmL", -0.18);
      setX("forearmR", -0.18);
      setZ("forearmL", -0.06);
      setZ("forearmR", 0.06);
      break;
    case "walk": {
      const ph = t * Math.PI * 2;
      const sw = Math.sin(ph);
      armsDown(26);
      setX("upperLegL", -0.42 * stride * sw);
      setX("upperLegR", 0.42 * stride * sw);
      setX("lowerLegL", 0.15 * stride + 0.55 * stride * Math.max(0, Math.cos(ph)));
      setX("lowerLegR", 0.15 * stride + 0.55 * stride * Math.max(0, -Math.cos(ph)));
      setX("footL", -0.1 * sw);
      setX("footR", 0.1 * sw);
      setX("upperArmL", 0.4 * sw);
      setX("upperArmR", -0.4 * sw);
      setX("forearmL", -0.35 - 0.2 * Math.max(0, -sw));
      setX("forearmR", -0.35 - 0.2 * Math.max(0, sw));
      setY("chest", 0.1 * sw);
      setY("hips", -0.06 * sw);
      hipsY = 0.95 - 0.02 + 0.015 * Math.abs(Math.cos(ph));
      break;
    }
    case "hip":
      // One hand on the hip, weight on one leg.
      armsDown(22);
      setZ("upperArmL", deg(15));
      setZ("forearmL", -deg(100));
      setX("forearmR", -0.15);
      setZ("hips", 0.07);
      setZ("spine", -0.05);
      setZ("chest", -0.05);
      setZ("head", 0.04);
      setZ("upperLegR", -0.06);
      setZ("upperLegL", -0.07);
      break;
    case "selfie":
      // A phone held up in the right hand.
      armsDown(22);
      setX("upperArmR", -deg(34));
      setZ("upperArmR", deg(26));
      setX("forearmR", -deg(128));
      setX("forearmL", -0.15);
      setZ("head", -0.1);
      setY("head", -0.2);
      setZ("hips", -0.05);
      setZ("chest", 0.05);
      break;
    case "cheer":
      setZ("upperArmL", deg(105));
      setZ("upperArmR", -deg(105));
      setZ("forearmL", deg(20));
      setZ("forearmR", -deg(20));
      setX("head", -0.15);
      setX("chest", -0.06);
      break;
    case "ride":
    case "pillion":
      hipsY = 0.845;
      armsDown(20);
      setX("spine", name === "ride" ? 0.14 : 0.04);
      for (const [sd, sg] of [["L", 1], ["R", -1]] as const) {
        setX(`upperLeg${sd}`, -deg(68));
        setZ(`upperLeg${sd}`, sg * deg(15));
        setX(`lowerLeg${sd}`, deg(78));
        if (name === "ride") {
          setX(`upperArm${sd}`, -deg(62));
          setX(`forearm${sd}`, -deg(12));
        } else {
          setX(`upperArm${sd}`, -deg(20));
          setX(`forearm${sd}`, -deg(55));
        }
      }
      break;
    case "tray":
    case "trayWalk":
      // One arm up to steady the load, the elbow out and the hand curled onto the basin's rim, not up through the goods.
      armsDown(22);
      setZ("upperArmL", deg(105));
      setZ("forearmL", deg(65));
      setX("forearmR", -0.2);
      if (name === "trayWalk") {
        const sw = Math.sin(t * Math.PI * 2);
        setX("upperLegL", -0.36 * sw);
        setX("upperLegR", 0.36 * sw);
        setX("lowerLegL", 0.12 + 0.4 * Math.max(0, Math.cos(t * Math.PI * 2)));
        setX("lowerLegR", 0.12 + 0.4 * Math.max(0, -Math.cos(t * Math.PI * 2)));
        setX("upperArmR", -0.3 * sw);
      }
      break;
    case "sell":
      armsDown(22);
      setX("upperArmR", -deg(95));
      setZ("upperArmR", deg(18));
      setX("forearmR", -deg(35));
      setY("chest", -0.15);
      setY("head", -0.2);
      break;
    case "sit":
      hipsY = 0.5;
      armsDown(22);
      for (const sd of ["L", "R"] as const) {
        setX(`upperLeg${sd}`, -deg(88));
        setX(`lowerLeg${sd}`, deg(86));
        setX(`upperArm${sd}`, -0.35);
        setX(`forearm${sd}`, -1.0);
      }
      break;
    default: {
      const never: never = name;
      throw new Error(`pose: ${String(never)}`);
    }
  }
  return hipsY === undefined ? { rotations: r } : { rotations: r, hipsY };
}
