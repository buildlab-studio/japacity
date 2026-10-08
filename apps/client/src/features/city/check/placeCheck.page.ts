// The place check's page (city.md R-CITY-027, R-CITY-038): a staged place built by the client's own
// world code from the shipped files, seen from the start's street camera on the cheap phone profile,
// once still and once moving. Still is the place without its motion list and with no frame update;
// moving adds the motion, the clock and the crowd's idling as the city's frame loop runs them. Each
// run records the draw calls, triangles and microseconds of script of every frame. The check
// (tools/assets/place-check.ts) serves it from the repository and drives it through `window.placeCheck`.
import { attachSigns, prepareModel, SIGN_FONT } from "@japacity/assets/load";
import { ACESFilmicToneMapping, DirectionalLight, Fog, HemisphereLight, type Object3D, PCFShadowMap, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

import type { FrameRecord } from "../../../../../../tools/assets/place-check.types";
import { advanceClock } from "../../../shared/three/clock";
import { danceFigure } from "../../../shared/three/dance";
import { loadGrids } from "../../../shared/three/motion";
import { poseFigure } from "../../../shared/three/people";
import { cameraAim, FOV } from "../camera";
import { crossAt } from "../cross";
import type { Stage } from "../placeFile";
import { WALK_SPEED } from "../walk";
import { buildWorld, colourOf, skyColours, type World } from "../world";
import { type CheckInput, type PlaceRun, runOf } from "./placeCheck";

/** One frame of the city's clock at 30 frames a second. */
const STEP = 1 / 30;
/** Frames drawn before any is recorded, so shader compiles are not counted. */
const WARM = 3;
const ASSETS = "/apps/client/public/assets/";

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const loaded = new Map<string, Promise<Object3D>>();

function loadModel(path: string, text: Record<string, string>): Promise<Object3D> {
  let held = loaded.get(path);
  if (held === undefined) {
    held = loader.loadAsync(`${ASSETS}${path}`).then((gltf) => {
      prepareModel(gltf.scene);
      attachSigns(gltf.scene, (key) => text[key] ?? "");
      return gltf.scene;
    });
    loaded.set(path, held);
  }
  return held;
}

/** What the city's frame loop moves for the place, apart from the walk and the camera (CityScene). */
function animate(world: World, time: number): void {
  for (const { figure, cross } of world.crowd) {
    if (cross === undefined) {
      poseFigure(figure, time);
      continue;
    }
    const pace = crossAt(cross.from, cross.to, time, WALK_SPEED, cross.phase);
    figure.root.position.set(pace.x, 0, pace.z);
    figure.root.rotation.y = pace.facing;
    if (pace.walking) poseFigure(figure, time, cross.walk, pace.stride);
    else poseFigure(figure, time);
  }
  for (const { figure, dance } of world.dancers) danceFigure(figure, time, dance);
  poseFigure(world.own, time, "stand");
  world.indicator.position.y = 1.98 + Math.sin(time * 2.4) * 0.05;
  world.indicator.rotation.y = time * 1.5;
}

async function build(run: PlaceRun): Promise<{ scene: Scene; camera: PerspectiveCamera; world: World }> {
  const stage: Stage = run.moving ? run.stage : { ...run.stage, motion: [] };
  const files = [...new Set([...stage.models.map((model) => model.file), ...(stage.dancers ?? []).map((dancer) => dancer.file), ...run.people.map((shown) => shown.person.file), run.own])];
  const models = new Map<string, Object3D>();
  await Promise.all(files.map(async (path) => models.set(path, await loadModel(path, run.text))));
  await loadGrids(stage.motion.map((motion) => motion.kind), run.settings.mesh, (path) => loadModel(path, run.text));
  const world = buildWorld(stage, models, run.people, run.own, run.settings, (key) => run.text[key]);
  const [x, z, facing] = stage.start;
  world.own.root.position.set(x, 0, z);
  world.own.root.rotation.y = facing;

  const scene = new Scene();
  const { sky, background, fog } = skyColours(stage.light.sky, stage.light.ground, run.settings.haze);
  scene.background = background;
  scene.fog = new Fog(fog, run.settings.fog.near, run.settings.fog.far);
  scene.add(new HemisphereLight(sky, colourOf(stage.light.ground), 1.1));
  const sun = new DirectionalLight(0xfff0d0, 2);
  sun.castShadow = run.settings.shadows;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, far: 140 });
  sun.position.set(x + stage.light.sun[0], stage.light.sun[1], z + stage.light.sun[2]);
  sun.target.position.set(x, 0, z);
  scene.add(sun, sun.target, world.root);

  const aspect = window.innerWidth / window.innerHeight;
  const camera = new PerspectiveCamera(FOV, aspect, 0.1, 240);
  const { position, target } = cameraAim({ x, z }, facing, 0, aspect);
  camera.position.set(...position);
  camera.lookAt(...target);
  return { scene, camera, world };
}

/** The place being measured, and the renderer it is drawn with. */
let current: { world: World; scene: Scene; camera: PerspectiveCamera; renderer: WebGLRenderer; moving: boolean } | null = null;

const placeCheck = {
  /**
   * Builds the place on a renderer of its own, as the mode's antialias is fixed at creation, and
   * draws a few frames so shader compiles are not counted. The last place's renderer is dropped
   * with its context, so a long check never runs out of contexts.
   */
  async build(input: CheckInput): Promise<void> {
    await document.fonts.load(`64px ${SIGN_FONT}`).catch(() => undefined);
    const run = runOf(input);
    const { scene, camera, world } = await build(run);
    current?.renderer.dispose();
    current?.renderer.forceContextLoss();
    const renderer = new WebGLRenderer({ antialias: run.settings.antialias, powerPreference: "high-performance", preserveDrawingBuffer: true });
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.shadowMap.enabled = run.settings.shadows;
    renderer.shadowMap.type = PCFShadowMap;
    renderer.setPixelRatio(run.settings.pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.replaceChildren(renderer.domElement);
    current = { world, scene, camera, renderer, moving: run.moving };
    placeCheck.frames(WARM);
  },

  /** Draws `count` frames of the built place and records each. */
  frames(count: number): FrameRecord[] {
    if (current === null) throw new Error("No place is built");
    const { world, scene, camera, renderer, moving } = current;
    const gl = renderer.getContext();
    const pixel = new Uint8Array(4);
    const records: FrameRecord[] = [];
    for (let frame = 0; frame < count; frame += 1) {
      const start = performance.now();
      if (moving) animate(world, advanceClock(STEP));
      const scripted = performance.now();
      renderer.render(scene, camera);
      // Reading a pixel waits for the frame to be drawn, where finish() may return before it is.
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      const end = performance.now();
      records.push({ drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, scriptUs: (scripted - start) * 1000, frameMs: end - start });
    }
    return records;
  },

  /**
   * Microseconds of script a frame, timed as one block of `count` frames' updates with nothing drawn,
   * so the slowed processor's pauses are spread over the block rather than landing on a few frames.
   */
  script(count: number): number {
    if (current === null) throw new Error("No place is built");
    const { world, moving } = current;
    const start = performance.now();
    for (let frame = 0; frame < count; frame += 1) if (moving) animate(world, advanceClock(STEP));
    return ((performance.now() - start) * 1000) / count;
  },
};

declare global {
  interface Window {
    placeCheck: typeof placeCheck;
    placeCheckReady: boolean;
  }
}

window.placeCheck = placeCheck;
window.placeCheckReady = true;
