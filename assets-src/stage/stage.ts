// The stage every asset is shot on (assets:contributor-renders-fixed-views): one sun and one sky (assets:lighting-set-by-place), the
// palette's sand ground, a standard street for the phone shot, and a clear ground for the tile
// the interface cuts as a sticker (design page 09) and for a look's face and whole figure, which
// the front door cuts the same way. The shooter drives it
// through `window.stage`; it renders on the software renderer, so a model gives the same
// pixels every time. It loads the shipped file, as the client does, not the builder.
import { fullSides, palette, type PaletteName, wallOf } from "@japacity/assets";
import { attachSigns, prepareModel, SIGN_FONT } from "@japacity/assets/load";
import {
  Box3,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  type SkinnedMesh,
  Sphere,
  Vector3,
  WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

export type ViewName = "front" | "back" | "left" | "right" | "threeQuarter" | "plan" | "phone" | "phoneFar" | "tile" | "face" | "figure" | "cheer";
/** The views shot on a clear ground, cut as stickers by the interface: a thing's tile, and a look's face and whole figure. */
const CLEAR_VIEWS: readonly ViewName[] = ["tile", "face", "figure", "cheer"];
export type MaskView = "front" | "side" | "plan";

export interface LoadOptions {
  url: string;
  /** Sign text by key, from the content's text table. */
  text: Record<string, string>;
  /** Bone rotations (Euler XYZ) for a person, by bone name, and the hips' height if the pose moves it. */
  pose?: { rotations: Record<string, [number, number, number]>; hipsY?: number };
  /** A model shown beside the asset in the phone shot for scale. */
  scaleFigure?: { url: string; pose?: LoadOptions["pose"] };
  /** The ground the asset stands on in the shots: sand, or the lagoon for a bridge. */
  ground?: PaletteName;
  /** Where the far phone shot stands and looks, when a landmark is first seen from somewhere particular. */
  farView?: { position: [number, number, number]; target: [number, number, number] };
}

export interface ViewInfo {
  view: ViewName;
  camera: { kind: "orthographic" | "perspective"; position: number[]; target: number[]; fov?: number; width?: number; height?: number };
}

export interface MaskRequest {
  view: MaskView;
  width: number;
  height: number;
  pxPerMetre: number;
  /** Where the frame is centred, in metres, when not on the model's bounds. */
  centre?: [number, number, number];
  /** Named nodes left out of the mask, such as a stadium's ramps that stand outside its footprint. */
  exclude: string[];
}

const colour = (name: PaletteName): Color => new Color(palette[name]);
const DEG = Math.PI / 180;

// A logarithmic depth buffer: the software renderer's depth is coarse, and the stage shows a 4 m shop and a 600 m bridge alike.
// An alpha channel, so the tile can leave the sky and the ground out; every other view paints the sky over it.
const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new Scene();
scene.background = colour("sky");
const sky = new HemisphereLight(0xfff1d6, colour("sand"), 1.1);
const sun = new DirectionalLight(0xfff0d0, 2.0);
// The sun stands high over the front-right shoulder, so fronts are lit and the three-quarter view shows two faces.
sun.position.set(0.55, 1.0, 0.75).multiplyScalar(100);
scene.add(sky, sun, sun.target);

const ground = new Mesh(new PlaneGeometry(20000, 20000), new MeshStandardMaterial({ color: colour("sand"), roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.02;
scene.add(ground);

const street = new Group();
scene.add(street);
street.visible = false;

let model: Object3D | null = null;
let figure: Object3D | null = null;
let farView: LoadOptions["farView"];
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

async function loadModel(url: string, pose: LoadOptions["pose"], text: Record<string, string>): Promise<Object3D> {
  const gltf = await loader.loadAsync(url);
  const root = gltf.scene;
  prepareModel(root);
  attachSigns(root, (key) => text[key]);
  if (pose !== undefined) applyPose(root, pose);
  root.traverse((object) => {
    const skinned = object as SkinnedMesh;
    if (skinned.isSkinnedMesh) skinned.frustumCulled = false;
  });
  // A wide home's shell carries each outer side full and knee-high: the views show it as the game
  // does at rest, looking down its length from +z, the back and the left full and the front and the right low.
  const full = new Set<string>(fullSides(2));
  root.traverse((object) => {
    const wall = wallOf(object.name);
    if (wall !== null) object.visible = full.has(wall.side) === (wall.state === "full");
  });
  return root;
}

function applyPose(root: Object3D, pose: NonNullable<LoadOptions["pose"]>): void {
  root.traverse((object) => {
    const rotation = pose.rotations[object.name];
    if (rotation !== undefined) object.rotation.set(rotation[0], rotation[1], rotation[2]);
    if (object.name === "hips" && pose.hipsY !== undefined) object.position.y = pose.hipsY;
  });
  root.updateMatrixWorld(true);
}

function boundsOf(object: Object3D, exclude: readonly string[] = []): Box3 {
  object.updateMatrixWorld(true);
  const box = new Box3();
  object.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || mesh.name === "signs") return;
    let at: Object3D | null = mesh;
    while (at !== null) {
      if (exclude.includes(at.name)) return;
      at = at.parent;
    }
    box.expandByObject(mesh, true);
  });
  return box;
}

/** The standard street of the phone shot: a road, its kerbs and markings, between the camera and the asset. */
function buildStreet(front: number, width: number): void {
  street.clear();
  const plane = (w: number, d: number, x: number, y: number, z: number, name: PaletteName): void => {
    const mesh = new Mesh(new PlaneGeometry(w, d), new MeshStandardMaterial({ color: colour(name), roughness: 1, flatShading: true }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    street.add(mesh);
  };
  const length = Math.max(120, width * 3);
  plane(length, 7.5, 0, 0.0, front + 5.25, "asphalt");
  for (let x = -length / 2; x < length / 2; x += 6) plane(3, 0.15, x + 1.5, 0.02, front + 5.25, "marking");
  plane(length, 0.3, 0, 0.03, front + 1.65, "concrete");
  plane(length, 0.3, 0, 0.03, front + 8.85, "concrete");
}

function setOrtho(view: "front" | "back" | "left" | "right" | "plan", box: Box3): ViewInfo {
  const size = box.getSize(new Vector3());
  const centre = box.getCenter(new Vector3());
  const aspect = window.innerWidth / window.innerHeight;
  const across = view === "front" || view === "back" ? size.x : view === "plan" ? size.x : size.z;
  const up = view === "plan" ? size.z : size.y;
  const margin = 1.08;
  let halfH = (up * margin) / 2;
  if ((across * margin) / 2 > halfH * aspect) halfH = (across * margin) / 2 / aspect;
  const far = size.length() * 4 + 10;
  const camera = new OrthographicCamera(-halfH * aspect, halfH * aspect, halfH, -halfH, 0.01, far * 2);
  const away: Record<typeof view, [number, number, number]> = { front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0], plan: [0, 1, 0] };
  const [ax, ay, az] = away[view];
  camera.position.set(centre.x + ax * far, centre.y + ay * far, centre.z + az * far);
  if (view === "plan") camera.up.set(0, 0, -1);
  camera.lookAt(centre);
  camera.updateProjectionMatrix();
  current = camera;
  return { view, camera: { kind: "orthographic", position: camera.position.toArray(), target: centre.toArray(), width: halfH * aspect * 2, height: halfH * 2 } };
}

let current: OrthographicCamera | PerspectiveCamera = new PerspectiveCamera(32, 1, 0.1, 1000);

function setThreeQuarter(box: Box3): ViewInfo {
  const sphere = box.getBoundingSphere(new Sphere());
  const fov = 32;
  const aspect = window.innerWidth / window.innerHeight;
  const half = Math.min(fov / 2, (Math.atan(Math.tan((fov / 2) * DEG) * aspect) / DEG));
  const distance = (sphere.radius * 1.04) / Math.sin(half * DEG);
  const dir = new Vector3(Math.sin(45 * DEG) * Math.cos(30 * DEG), Math.sin(30 * DEG), Math.cos(45 * DEG) * Math.cos(30 * DEG));
  // A near plane in proportion to the distance keeps depth precision for a 250 m stadium as for a 4 m shop.
  const camera = new PerspectiveCamera(fov, aspect, Math.max(0.1, distance / 60), distance * 4);
  camera.position.copy(sphere.center).addScaledVector(dir, distance);
  camera.lookAt(sphere.center);
  current = camera;
  return { view: "threeQuarter", camera: { kind: "perspective", position: camera.position.toArray(), target: sphere.center.toArray(), fov } };
}

/** Every vertex of the model's meshes in world space, the signs' faces among them. */
function pointsOf(root: Object3D): Vector3[] {
  root.updateMatrixWorld(true);
  const points: Vector3[] = [];
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    const position = mesh.geometry.getAttribute("position");
    for (let at = 0; at < position.count; at++) points.push(new Vector3().fromBufferAttribute(position, at).applyMatrix4(mesh.matrixWorld));
  });
  return points;
}

/**
 * The tile: the three-quarter view's angle and lens, framed on the asset's own corners rather than
 * its sphere, so the asset fills the square with a margin for the sticker's white edge. The distance
 * is the nearest at which every corner is inside the margin, and the aim is moved so the corners'
 * picture sits in the middle; a few rounds settle both.
 */
function setTile(box: Box3, root: Object3D): ViewInfo {
  const fov = 32;
  const aspect = window.innerWidth / window.innerHeight;
  const fill = 0.88;
  const tanV = Math.tan((fov / 2) * DEG) * fill;
  const tanH = tanV * aspect;
  const dir = new Vector3(Math.sin(45 * DEG) * Math.cos(30 * DEG), Math.sin(30 * DEG), Math.cos(45 * DEG) * Math.cos(30 * DEG));
  const right = new Vector3().crossVectors(new Vector3(0, 1, 0), dir).normalize();
  const up = new Vector3().crossVectors(dir, right).normalize();
  const corners = pointsOf(root);
  const target = box.getCenter(new Vector3());
  let distance = 1;
  for (let round = 0; round < 4; round++) {
    distance = 0;
    for (const corner of corners) {
      const offset = corner.clone().sub(target);
      const toward = offset.dot(dir);
      distance = Math.max(distance, toward + Math.abs(offset.dot(right)) / tanH, toward + Math.abs(offset.dot(up)) / tanV);
    }
    let low = [Infinity, Infinity];
    let high = [-Infinity, -Infinity];
    for (const corner of corners) {
      const offset = corner.clone().sub(target);
      const depth = distance - offset.dot(dir);
      const across = offset.dot(right) / (depth * tanH);
      const upward = offset.dot(up) / (depth * tanV);
      low = [Math.min(low[0] ?? 0, across), Math.min(low[1] ?? 0, upward)];
      high = [Math.max(high[0] ?? 0, across), Math.max(high[1] ?? 0, upward)];
    }
    target.addScaledVector(right, (((low[0] ?? 0) + (high[0] ?? 0)) / 2) * distance * tanH);
    target.addScaledVector(up, (((low[1] ?? 0) + (high[1] ?? 0)) / 2) * distance * tanV);
  }
  const reach = box.getSize(new Vector3()).length();
  const camera = new PerspectiveCamera(fov, aspect, Math.max(0.05, (distance - reach) * 0.5, distance / 200), distance + reach * 2);
  camera.position.copy(target).addScaledVector(dir, distance);
  camera.lookAt(target);
  current = camera;
  return { view: "tile", camera: { kind: "perspective", position: camera.position.toArray(), target: target.toArray(), fov } };
}

/**
 * A look's portrait for the front door: the face, head and shoulders, or the whole figure, standing with a hand on the
 * hip or both arms up in a cheer, each seen from 25 degrees to the figure's left, a little above, with a long lens so
 * the face is not stretched. The box is the posed figure's, so raised arms stay inside the frame.
 */
function setPortrait(box: Box3, view: "face" | "figure" | "cheer"): ViewInfo {
  const size = box.getSize(new Vector3());
  const centre = box.getCenter(new Vector3());
  const aspect = window.innerWidth / window.innerHeight;
  const fov = view === "face" ? 22 : 24;
  const yaw = 25 * DEG;
  const face = view === "face";
  const target = face ? new Vector3(centre.x, box.max.y - size.y * 0.14, centre.z) : centre.clone();
  // The whole figure fits its height with a margin for the sticker's edge; the face fills the square from the hair to the collar.
  const span = face ? size.y * 0.4 : size.y * 1.1;
  const distance = span / 2 / Math.tan((fov / 2) * DEG);
  const lift = face ? size.y * 0.04 : size.y * 0.12;
  const camera = new PerspectiveCamera(fov, aspect, Math.max(0.05, distance / 50), distance * 4);
  camera.position.set(target.x + Math.sin(yaw) * distance, target.y + lift, target.z + Math.cos(yaw) * distance);
  camera.lookAt(target);
  current = camera;
  return { view, camera: { kind: "perspective", position: camera.position.toArray(), target: target.toArray(), fov } };
}

/**
 * The phone shot: eye height on the far pavement, 12 m from the asset's front, a 32 degree lens.
 * For a landmark too big to read from 12 m, `phoneFar` is the same lens from where a player
 * would first see it whole: from the front-right, 20 degrees up, far enough to fit its width.
 */
function setPhone(box: Box3, far: boolean): ViewInfo {
  const fov = 32;
  const aspect = window.innerWidth / window.innerHeight;
  const front = box.max.z;
  const height = box.max.y - box.min.y;
  const centreX = (box.min.x + box.max.x) / 2;
  if (far && farView !== undefined) {
    const camera = new PerspectiveCamera(fov, aspect, 0.5, 5000);
    camera.position.set(...farView.position);
    camera.lookAt(new Vector3(...farView.target));
    current = camera;
    return { view: "phoneFar", camera: { kind: "perspective", position: farView.position, target: farView.target, fov } };
  }
  if (far) {
    const sphere = box.getBoundingSphere(new Sphere());
    const halfW = Math.atan(Math.tan((fov / 2) * DEG) * aspect);
    const distance = (sphere.radius * 1.02) / Math.sin(halfW);
    const dir = new Vector3(Math.sin(30 * DEG) * Math.cos(20 * DEG), Math.sin(20 * DEG), Math.cos(30 * DEG) * Math.cos(20 * DEG));
    const camera = new PerspectiveCamera(fov, aspect, Math.max(0.1, distance / 60), distance * 4);
    camera.position.copy(sphere.center).addScaledVector(dir, distance);
    camera.lookAt(sphere.center);
    current = camera;
    return { view: "phoneFar", camera: { kind: "perspective", position: camera.position.toArray(), target: sphere.center.toArray(), fov } };
  }
  const target = Math.min(Math.max(height * 0.45, 1.5), 4.5);
  const camera = new PerspectiveCamera(fov, aspect, 0.1, 2000);
  camera.position.set(centreX, 1.6, front + 12);
  camera.lookAt(centreX, target, front);
  current = camera;
  return { view: "phone", camera: { kind: "perspective", position: camera.position.toArray(), target: [centreX, target, front], fov } };
}

const originals = new Map<Mesh, Material | Material[]>();
// Both sides, so a silhouette has no holes where a face is seen from behind.
const black = new MeshBasicMaterial({ color: 0x000000, side: DoubleSide });

const stage = {
  async load(options: LoadOptions): Promise<{ bounds: number[] }> {
    await document.fonts.load(`32px ${SIGN_FONT}`);
    if (model !== null) scene.remove(model);
    if (figure !== null) scene.remove(figure);
    model = await loadModel(options.url, options.pose, options.text);
    farView = options.farView;
    ground.material.color = colour(options.ground ?? "sand");
    scene.add(model);
    figure = null;
    if (options.scaleFigure !== undefined) {
      figure = await loadModel(options.scaleFigure.url, options.scaleFigure.pose, {});
      figure.visible = false;
      scene.add(figure);
    }
    const box = boundsOf(model);
    return { bounds: [...box.min.toArray(), ...box.max.toArray()] };
  },

  show(view: ViewName): ViewInfo {
    if (model === null) throw new Error("stage: nothing loaded");
    const box = boundsOf(model);
    const phone = view === "phone" || view === "phoneFar";
    street.visible = phone;
    if (phone) buildStreet(box.max.z, box.max.x - box.min.x);
    if (figure !== null) {
      figure.visible = phone;
      // A person for scale, standing on the pavement in front of the asset, inside the phone's narrow frame.
      figure.position.set((box.min.x + box.max.x) / 2 + 1.2, 0, box.max.z + 0.4);
    }
    scene.fog = null;
    // The tile, the face and the figure are cut as stickers: no sky and no ground, on a page as clear as the canvas.
    const tile = CLEAR_VIEWS.includes(view);
    scene.background = tile ? null : colour("sky");
    ground.visible = !tile;
    document.documentElement.style.background = tile ? "transparent" : "";
    document.body.style.background = tile ? "transparent" : "";
    let info: ViewInfo;
    switch (view) {
      case "front":
      case "back":
      case "left":
      case "right":
      case "plan":
        info = setOrtho(view, box);
        break;
      case "threeQuarter":
        info = setThreeQuarter(box);
        break;
      case "phone":
      case "phoneFar":
        info = setPhone(box, view === "phoneFar");
        break;
      case "tile":
        info = setTile(box, model);
        break;
      case "face":
      case "figure":
      case "cheer":
        info = setPortrait(box, view);
        break;
      default: {
        const never: never = view;
        throw new Error(`stage: no view ${String(never)}`);
      }
    }
    renderer.render(scene, current);
    return info;
  },

  /** The model's bounds in metres, leaving out named nodes. */
  bounds(exclude: string[]): number[] {
    if (model === null) throw new Error("stage: nothing loaded");
    const box = boundsOf(model, exclude);
    return [...box.min.toArray(), ...box.max.toArray()];
  },

  /** A flat black silhouette on white for the outline score (assets:landmarks-match-reference-outlines), one byte a pixel, 1 where the model is. */
  mask(request: MaskRequest): { pixels: string; bounds: number[] } {
    if (model === null) throw new Error("stage: nothing loaded");
    const root = model;
    const box = boundsOf(root, request.exclude);
    const hidden: Object3D[] = [];
    root.traverse((object) => {
      if (request.exclude.includes(object.name) && object.visible) {
        object.visible = false;
        hidden.push(object);
      }
      const mesh = object as Mesh;
      if (mesh.isMesh) {
        originals.set(mesh, mesh.material);
        mesh.material = black;
      }
    });
    renderer.setPixelRatio(1);
    renderer.setSize(request.width, request.height);
    ground.visible = false;
    street.visible = false;
    if (figure !== null) figure.visible = false;
    scene.background = new Color(0xffffff);
    const centre = request.centre === undefined ? box.getCenter(new Vector3()) : new Vector3(...request.centre);
    const halfW = request.width / request.pxPerMetre / 2;
    const halfH = request.height / request.pxPerMetre / 2;
    const reach = box.getSize(new Vector3()).length() * 2 + 10;
    const camera = new OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.01, reach * 2);
    const away = request.view === "front" ? [0, 0, 1] : request.view === "side" ? [1, 0, 0] : [0, 1, 0];
    camera.position.set(centre.x + (away[0] ?? 0) * reach, centre.y + (away[1] ?? 0) * reach, centre.z + (away[2] ?? 0) * reach);
    if (request.view === "plan") camera.up.set(0, 0, -1);
    camera.lookAt(centre);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    const gl = renderer.getContext();
    const rgba = new Uint8Array(request.width * request.height * 4);
    gl.readPixels(0, 0, request.width, request.height, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
    const out = new Uint8Array(request.width * request.height);
    for (let y = 0; y < request.height; y++) {
      for (let x = 0; x < request.width; x++) {
        // readPixels starts at the bottom row; the mask starts at the top.
        out[y * request.width + x] = (rgba[((request.height - 1 - y) * request.width + x) * 4] ?? 255) < 128 ? 1 : 0;
      }
    }
    for (const [mesh, material] of originals) mesh.material = material;
    originals.clear();
    for (const object of hidden) object.visible = true;
    scene.background = colour("sky");
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    let binary = "";
    for (const byte of out) binary += String.fromCharCode(byte);
    return { pixels: btoa(binary), bounds: [...box.min.toArray(), ...box.max.toArray()] };
  },
};

declare global {
  interface Window {
    stage: typeof stage;
    stageReady: boolean;
  }
}

window.stage = stage;
window.stageReady = true;
