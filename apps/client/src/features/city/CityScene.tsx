// The 3D scene of a place, loaded only where WebGL exists. One sun and one sky light set by the
// place (R-ASSET-006), fog near or far by mode, a 32 degree lens at a person's height that rises to a
// plan view while the screen is held, and one frame loop that moves the clock, the crowd's idling,
// the walk and the camera. Taps walk the character or open a card; nothing here sends a command
// (city.md R-CITY-001).
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { type Camera, type DirectionalLight, Fog, type Object3D, Vector3 } from "three";

import { advanceClock } from "../../shared/three/clock";
import { loadModel } from "../../shared/three/load";
import { loadManifest } from "../../shared/three/manifest";
import { poseFigure } from "../../shared/three/people";
import { BEHIND, cameraAim, EYE, FOV } from "./camera";
import { filesOf, stageOf } from "./placeFile";
import type { CityProbe, Picked, SceneProps } from "./scene.types";
import { standAt, stepWalk, strideOf, type Walker, walkTo } from "./walk";
import { buildWorld, colourOf, skyColours, type World } from "./world";

/** How much further the fog stands while looking from above, so the plan is not lost in it. */
const PLAN_FOG = 90;
const HOLD_MS = 450;
const INDICATOR_Y = 1.98;
/** Behind the panels the scene only idles: a frame a second, so the panels keep the processor. */
const IDLE_MS = 1000;

function pickedOf(object: Object3D | null): Picked | null {
  let at: Object3D | null = object;
  while (at !== null) {
    const data = at.userData as { slot?: number; own?: boolean; file?: string; signs?: string[] };
    if (data.own === true) return { kind: "own" };
    if (typeof data.slot === "number") return { kind: "person", slot: data.slot };
    if (typeof data.file === "string") return { kind: "model", file: data.file, signs: data.signs ?? [] };
    at = at.parent;
  }
  return null;
}

/** The street camera behind the character along the start's facing, or the plan view as far as `plan` has risen. */
function aimCamera(camera: Camera, walker: Walker, heading: number, plan: number, aspect: number): void {
  const { position, target } = cameraAim(walker, heading, plan, aspect);
  camera.position.set(...position);
  camera.lookAt(...target);
}

interface WorldProps extends SceneProps {
  plan: boolean;
  takeTap: () => boolean;
}

function Idle({ looking }: { looking: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (looking) return;
    const timer = window.setInterval(() => invalidate(), IDLE_MS);
    return () => window.clearInterval(timer);
  }, [looking, invalidate]);
  return null;
}

function Place(props: WorldProps) {
  const { place, file, people, own, settings, text, onProgress, onFailed, onPick, onFrame, looking, plan, takeTap } = props;
  const [world, setWorld] = useState<World | null>(null);
  const walker = useRef<Walker>(standAt(0, 0, 0));
  const planShare = useRef(0);
  const sun = useRef<DirectionalLight>(null);
  const frames = useRef<number[]>([]);
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const stage = stageOf(file);
  const peopleKey = people.map((shown) => `${shown.person.file}:${String(shown.tag)}`).join("|");

  useEffect(() => {
    let alive = true;
    const wanted = filesOf(file, [...people.map((shown) => shown.person.file), own]);
    let done = 0;
    onProgress(0, wanted.length);
    void (async () => {
      const manifest = await loadManifest();
      const models = new Map<string, Object3D>();
      await Promise.all(
        wanted.map(async (path) => {
          models.set(path, await loadModel(manifest, path, text));
          done += 1;
          if (alive) onProgress(done, wanted.length);
        }),
      );
      if (!alive) return;
      const [x, z, facing] = stage.start;
      walker.current = standAt(x, z, facing);
      setWorld(buildWorld(stage, models, people, own, settings, text));
    })().catch((error: unknown) => {
      if (alive) onFailed(error instanceof Error ? error.message : String(error));
    });
    return () => {
      alive = false;
    };
    // The world is rebuilt for a new place, a new crowd or a new mode; the callbacks are the screen's and may change freely.
  }, [place, file, peopleKey, own, settings.mesh, settings.shadows]);

  useEffect(() => {
    if (world === null) return;
    const probe: CityProbe = {
      place,
      ready: true,
      drawCalls: 0,
      triangles: 0,
      frames: [],
      walker: walker.current,
      people: world.crowd.length + 1,
      screenOf: (slot) => {
        const placed = world.crowd.find((entry) => entry.slot === slot);
        if (placed === undefined) return null;
        const at = new Vector3();
        placed.figure.root.getWorldPosition(at);
        at.y += 1.1;
        at.project(camera);
        if (at.z > 1 || Math.abs(at.x) > 1 || Math.abs(at.y) > 1) return null;
        return { x: ((at.x + 1) / 2) * size.width, y: ((1 - at.y) / 2) * size.height };
      },
    };
    window.__city = probe;
    return () => {
      if (window.__city === probe) delete window.__city;
    };
  }, [world, place, camera, size]);

  useFrame((state, delta) => {
    const time = advanceClock(delta);
    if (world === null) return;
    const ms = delta * 1000;
    if (looking) {
      onFrame(ms);
      frames.current = [...frames.current, ms].slice(-100);
    }
    for (const { figure } of world.crowd) poseFigure(figure, time);
    const next = stepWalk(walker.current, delta);
    walker.current = next;
    world.own.root.position.set(next.x, 0, next.z);
    world.own.root.rotation.y = next.facing;
    if (next.target === null) poseFigure(world.own, time, "stand");
    else poseFigure(world.own, time, "walk", strideOf(next));
    world.indicator.position.y = INDICATOR_Y + Math.sin(time * 2.4) * 0.05;
    world.indicator.rotation.y = time * 1.5;
    planShare.current += ((plan ? 1 : 0) - planShare.current) * Math.min(1, delta * 4);
    aimCamera(state.camera, next, stage.start[2], planShare.current, state.size.width / Math.max(1, state.size.height));
    if (state.scene.fog instanceof Fog) {
      state.scene.fog.near = settings.fog.near + planShare.current * PLAN_FOG;
      state.scene.fog.far = settings.fog.far + planShare.current * PLAN_FOG;
    }
    const light = sun.current;
    if (light !== null) {
      light.position.set(next.x + stage.light.sun[0], stage.light.sun[1], next.z + stage.light.sun[2]);
      light.target.position.set(next.x, 0, next.z);
      light.target.updateMatrixWorld();
    }
    const probe = window.__city;
    if (probe !== undefined) {
      probe.drawCalls = gl.info.render.calls;
      probe.triangles = gl.info.render.triangles;
      probe.frames = frames.current;
      probe.walker = next;
    }
  });

  const tapped = (event: ThreeEvent<MouseEvent>): void => {
    event.stopPropagation();
    if (!looking || takeTap()) return;
    const picked = pickedOf(event.object);
    // A person, the player, or a shopfront with its signs opens a card; anything else is ground to walk to.
    if (picked !== null && (picked.kind !== "model" || picked.signs.length > 0)) {
      onPick(picked);
      return;
    }
    walker.current = walkTo(walker.current, event.point.x, event.point.z);
  };

  const { sky, background, fog } = skyColours(stage.light.sky, stage.light.ground, settings.haze);
  return (
    <>
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[fog, settings.fog.near, settings.fog.far]} />
      <hemisphereLight args={[sky, colourOf(stage.light.ground), 1.1]} />
      <directionalLight
        ref={sun}
        intensity={2}
        color={0xfff0d0}
        castShadow={settings.shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-camera-far={140}
      />
      {world === null ? null : <primitive object={world.root} onClick={tapped} />}
    </>
  );
}

export default function CityScene(props: SceneProps) {
  const [plan, setPlan] = useState(false);
  const holding = useRef<number | null>(null);
  const held = useRef(false);
  const release = (): void => {
    if (holding.current !== null) window.clearTimeout(holding.current);
    holding.current = null;
    setPlan(false);
  };
  const { settings, looking } = props;
  return (
    <div
      className="size-full touch-none"
      onPointerDown={() => {
        if (!looking) return;
        held.current = false;
        holding.current = window.setTimeout(() => {
          held.current = true;
          setPlan(true);
        }, HOLD_MS);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
    >
      <Canvas
        key={settings.antialias ? "smooth" : "plain"}
        dpr={settings.pixelRatio}
        gl={{ antialias: settings.antialias, powerPreference: "high-performance" }}
        shadows={settings.shadows ? "percentage" : false}
        frameloop={looking ? "always" : "demand"}
        camera={{ fov: FOV, near: 0.1, far: 240, position: [0, EYE, BEHIND] }}
        aria-hidden
      >
        <Idle looking={looking} />
        <Place
          {...props}
          plan={plan}
          takeTap={() => {
            const was = held.current;
            held.current = false;
            return was;
          }}
        />
      </Canvas>
    </div>
  );
}
