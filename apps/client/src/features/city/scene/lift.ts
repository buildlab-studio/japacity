// Buy mode's hand in the scene: the hold areas over the things you own, the lifted
// thing's copy with its shadow, and where on the floor a finger points. Nothing clever on a phone: a plain lift, a plain
// drag, short eases on the thing's position and turn alone.
import { CircleGeometry, type Camera, Mesh, MeshBasicMaterial, type Object3D, Plane, Raycaster, Vector2, Vector3 } from "three";

import { sceneWords } from "../scene.words";

/** How long a press must rest on a thing you own before it lifts, in ms. */
export const LIFT_HOLD_MS = 420;
/** How far a press may wander before it is a drag, not a press, in CSS pixels. */
export const LIFT_DRAG_PX = 8;
/** How high a lifted thing rides over the floor, in metres. */
export const LIFT_Y = 0.28;
/** How long a thing that does not fit takes to shake back, in ms (under half a second, R-WORLD-023). */
export const SHAKE_MS = 300;

/** The hold area over a thing you own: a round target for a thumb, quiet until the thing is lifted, then a ring. */
export function liftNode(thing: string): HTMLDivElement {
  const node = document.createElement("div");
  node.dataset.lift = thing;
  node.className = "lift-handle pointer-events-auto absolute size-14 -translate-x-1/2 -translate-y-1/2 touch-none rounded-[28px]";
  node.style.display = "none";
  return node;
}

/** The hint under a lifted thing: drag to move, tap to turn. */
export function liftHintNode(): HTMLDivElement {
  const node = document.createElement("div");
  node.dataset.liftHint = "";
  node.className = "chip pointer-events-none absolute -translate-x-1/2 whitespace-nowrap px-3 py-1 text-[12px] font-extrabold";
  node.textContent = sceneWords("city.lift.hint");
  node.style.display = "none";
  return node;
}

/** A soft shadow under the lifted thing, on the floor. */
export function liftShadow(radius: number): Mesh {
  const shadow = new Mesh(new CircleGeometry(Math.max(0.25, radius), 24), new MeshBasicMaterial({ color: 0x1b2440, transparent: true, opacity: 0.22, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.025;
  shadow.renderOrder = 2;
  return shadow;
}

/** Frees what a lifted thing's copy and shadow hold. The copy shares the loaded model's geometry, so only the shadow's is its own. */
export function dropLifted(copy: Object3D | null, shadow: Mesh | null): void {
  copy?.removeFromParent();
  if (shadow !== null) {
    shadow.removeFromParent();
    shadow.geometry.dispose();
    (shadow.material as MeshBasicMaterial).dispose();
  }
}

const ray = new Raycaster();
const pointer = new Vector2();
const floor = new Plane(new Vector3(0, 1, 0), 0);
const hit = new Vector3();

/** Where on the floor a point of the screen falls, in the place's metres, or null when it points above the horizon. */
export function floorAt(camera: Camera, canvas: HTMLElement, clientX: number, clientY: number): [number, number] | null {
  const box = canvas.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return null;
  pointer.set(((clientX - box.left) / box.width) * 2 - 1, -((clientY - box.top) / box.height) * 2 + 1);
  ray.setFromCamera(pointer, camera);
  return ray.ray.intersectPlane(floor, hit) === null ? null : [hit.x, hit.z];
}
