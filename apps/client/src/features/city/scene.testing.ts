// What the scene's tests read: a camera drawn the way the scene draws it, so a test can ask where a point of the
// place falls on the screen.
import { PerspectiveCamera, Vector3 } from "three";

import { SHOT_FOV, SHOT_NEAR_PLANE } from "./shot";

/** Phones held upright and sideways, a tablet and a desktop: the screens the whole view must fit. */
export const SCREENS = { phone: 390 / 844, small: 360 / 640, sideways: 844 / 390, tablet: 820 / 1180, desktop: 1440 / 900 } as const;

/** A camera standing and looking where the scene would put it, on a screen of that shape. */
export function cameraAt(aim: { position: [number, number, number]; target: [number, number, number]; fov?: number }, aspect: number): PerspectiveCamera {
  const camera = new PerspectiveCamera(aim.fov ?? SHOT_FOV, aspect, SHOT_NEAR_PLANE, 240);
  camera.position.set(...aim.position);
  camera.lookAt(...aim.target);
  camera.updateMatrixWorld(true);
  return camera;
}

/** Where a point falls on the screen, from -1 to 1 across and up, and whether it is in front of the camera. */
export function projected(camera: PerspectiveCamera, x: number, y: number, z: number): { x: number; y: number; inFront: boolean } {
  const at = new Vector3(x, y, z).project(camera);
  return { x: at.x, y: at.y, inFront: at.z < 1 };
}

export function onScreen(camera: PerspectiveCamera, x: number, y: number, z: number): boolean {
  const at = projected(camera, x, y, z);
  return at.inFront && Math.abs(at.x) <= 1 && Math.abs(at.y) <= 1;
}
