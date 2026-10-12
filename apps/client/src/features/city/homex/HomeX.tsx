// The home redesign's development page (an exploration; `?homex=family|room|hostel`, `&night` for the night):
// one home's place file staged through the world's own builder (buildWorld), its models loaded by the game's loader, its
// people posed with the game's poses, lit as the design asks: a paler, cooler sky light, a warm sun and
// soft shadows by day; the bulb and the lantern by night. The camera stands at the file's shot, moved back only as far
// as the screen's shape needs so no corner of the home is cut off. Nothing here is shown to a player.
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import type { PoseName } from "@japacity/assets-src/people/poses";
import { Color, type DirectionalLight, type Object3D, PCFSoftShadowMap, PerspectiveCamera, PointLight, Vector3 } from "three";

import { loadModel } from "../../../shared/three/load";
import type { PublishManifest } from "../../../shared/three/manifest";
import { glowAt } from "../../../shared/three/motion";
import { type Figure, figureOf, poseFigure } from "../../../shared/three/people";
import type { ModeSettings } from "../mode";
import { FOG, HAZE } from "../mode";
import { filesOf, type PlaceFile, stageOf, type Vec3 } from "../placeFile";
import { aimShot, fitDistance, SHOT_FOV, WHOLE } from "../shot";
import { buildWorld, lampsOf, type World } from "../world";

import type { HomeName } from "./asked";

/** Someone posed in the home: a person of the kit, where, and how. */
interface Posed {
  file: string;
  at: [number, number, number];
  pose: PoseName;
}

/** What the exploration's place files add to a place file: the people posed in the home, and the lights' strengths. */
interface HomeExtras {
  people: Posed[];
  own: Posed;
  /** The bulb's and the lantern's light by night, as point lights at the lamps the stage names. */
  nightLights: { at: Vec3; strength: number; reach: number }[];
}

type HomeFile = PlaceFile & { homex: HomeExtras };

/** The exploration's files are published beside the game's under their own names: each path is its own URL. */
const AS_IS: PublishManifest = { files: new Proxy({}, { get: (_target, key) => (typeof key === "string" ? key : undefined) }) };

const HIGH: ModeSettings = { pixelRatio: 2, shadows: true, crowd: 6, fog: FOG.far, atmosphere: true, haze: HAZE.far, antialias: true, mesh: "fine" };

/** Day and night, as section 4 of the revamp plan asks. */
const LIGHT = {
  day: { background: 0xeef1f8, sky: 0xdfe8f4, ground: 0xcdb48c, skyStrength: 1.35, sun: 0xffdcaa, sunStrength: 2.3, sunAt: [7, 14, 9] as Vec3, softness: 4 },
  night: { background: 0x121a3a, sky: 0x5f76b8, ground: 0x2a2a3a, skyStrength: 0.55, sun: 0x7f95d0, sunStrength: 0.35, sunAt: [-6, 14, -8] as Vec3, softness: 3 },
};

function Home({ home, night }: { home: HomeName; night: boolean }) {
  const [built, setBuilt] = useState<{ world: World; file: HomeFile; figures: Figure[]; lamps: Object3D[] } | null>(null);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const gl = useThree((state) => state.gl);
  const light = night ? LIGHT.night : LIGHT.day;

  useEffect(() => {
    let live = true;
    void (async () => {
      const response = await fetch(`${import.meta.env.BASE_URL}assets/places/home-${home}/place.json`, { cache: "no-cache" });
      const file = (await response.json()) as HomeFile;
      const stage = stageOf(file);
      const people = [...file.homex.people.map((one) => one.file), file.homex.own.file];
      const paths = filesOf(file, people);
      const loaded = await Promise.all(paths.map(async (path) => [path, await loadModel(AS_IS, path, () => undefined)] as const));
      const models = new Map<string, Object3D>(loaded);
      const world = buildWorld(stage, models, [], file.homex.own.file, HIGH, () => undefined, `home-${home}`, false);
      world.indicator.visible = false;
      const [ox, oz, oy] = file.homex.own.at;
      world.own.root.position.set(ox, 0, oz);
      world.own.root.rotation.y = oy;
      world.own.pose = file.homex.own.pose;
      const figures: Figure[] = [world.own];
      file.homex.people.forEach((one, index) => {
        const model = models.get(one.file);
        if (model === undefined) return;
        const figure = figureOf(model, one.pose, 3 + index * 1.7);
        figure.root.position.set(one.at[0], 0, one.at[1]);
        figure.root.rotation.y = one.at[2];
        figure.root.traverse((object) => {
          object.castShadow = true;
        });
        world.root.add(figure.root);
        figures.push(figure);
      });
      // Every model takes the shadows the people and the car cast, so they stand on the floor and lean on the walls.
      world.root.traverse((object) => {
        object.receiveShadow = true;
      });
      const lamps = lampsOf(stage.light.lamps ?? []);
      for (const lamp of lamps) glowAt(lamp, night ? 1 : 0);
      if (live) setBuilt({ world, file, figures, lamps });
    })();
    return () => {
      live = false;
    };
  }, [home, night]);

  // The shot: the file's pitch and facing, as far back as the width needs, and further while any corner is off screen.
  useEffect(() => {
    if (built === null || !(camera instanceof PerspectiveCamera)) return;
    const stage = stageOf(built.file);
    const shot = stage.shot;
    if (shot === undefined) return;
    const aspect = size.width / Math.max(1, size.height);
    camera.fov = SHOT_FOV;
    camera.near = 0.5;
    camera.far = 200;
    camera.aspect = aspect;
    const [width, depth] = stage.ground.size;
    // The floor's four corners, and the far wall's top over the far two.
    const corners = [-1, 1].flatMap((sx) => [new Vector3((sx * width) / 2, 0, depth / 2), new Vector3((sx * width) / 2, 0, -depth / 2), new Vector3((sx * width) / 2, 2.2, -depth / 2)]);
    let far = Math.max(shot.far, fitDistance(shot.width ?? width, aspect));
    for (let tries = 0; tries < 60; tries++) {
      const { position, target } = aimShot({ ...shot, far, width: 0 }, WHOLE, { x: 0, z: 0 }, aspect);
      camera.position.set(...position);
      camera.lookAt(...target);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
      const inside = corners.every((corner) => {
        const seen = corner.clone().project(camera);
        return Math.abs(seen.x) <= 0.97 && Math.abs(seen.y) <= 0.97;
      });
      if (inside) break;
      far *= 1.03;
    }
  }, [built, camera, size]);

  useEffect(() => {
    gl.shadowMap.type = PCFSoftShadowMap;
    scene.background = new Color(light.background);
  }, [gl, scene, light.background]);

  const nightLights = useMemo(() => {
    if (built === null || !night) return [];
    return built.file.homex.nightLights.map((one) => {
      const point = new PointLight(0xffb46a, one.strength, one.reach, 1.6);
      point.position.set(...one.at);
      return point;
    });
  }, [built, night]);

  const [frames, setFrames] = useState(0);
  useFrame((state) => {
    if (built === null) return;
    const time = 2.4;
    for (const figure of built.figures) poseFigure(figure, time, figure.pose);
    if (frames < 8) setFrames((count) => count + 1);
    else {
      // The last frame's draw calls and triangles, the shadow pass included, as the place check reads them (R-ASSET-007).
      document.body.dataset.homexCalls = String(state.gl.info.render.calls);
      document.body.dataset.homexTriangles = String(state.gl.info.render.triangles);
      document.body.dataset.homexReady = "1";
    }
  });

  const stage = built === null ? null : stageOf(built.file);
  const reach = stage === null ? 12 : Math.max(...stage.ground.size) / 2 + 2;
  return (
    <>
      <hemisphereLight args={[light.sky, light.ground, light.skyStrength]} />
      <directionalLight
        ref={(sun: DirectionalLight | null) => {
          if (sun === null) return;
          sun.shadow.radius = light.softness;
          sun.shadow.blurSamples = 16;
          sun.target.position.set(0, 0, 0);
          sun.target.updateMatrixWorld();
        }}
        position={light.sunAt}
        color={light.sun}
        intensity={light.sunStrength}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.04}
        shadow-camera-left={-reach}
        shadow-camera-right={reach}
        shadow-camera-top={reach}
        shadow-camera-bottom={-reach}
        shadow-camera-far={60}
      />
      {built === null ? null : <primitive object={built.world.root} />}
      {built === null ? null : built.lamps.map((lamp, index) => <primitive key={`lamp-${String(index)}`} object={lamp} />)}
      {nightLights.map((point, index) => (
        <primitive key={`light-${String(index)}`} object={point} />
      ))}
    </>
  );
}

export function HomeX({ home }: { home: HomeName }) {
  const night = new URLSearchParams(location.search).has("night");
  return (
    <main style={{ position: "fixed", inset: 0 }} data-homex={home}>
      <Canvas dpr={window.devicePixelRatio} shadows gl={{ antialias: true, preserveDrawingBuffer: true }} camera={{ fov: SHOT_FOV, near: 0.5, far: 200, position: [0, 10, 14] }}>
        <Home home={home} night={night} />
      </Canvas>
    </main>
  );
}

export default HomeX;
