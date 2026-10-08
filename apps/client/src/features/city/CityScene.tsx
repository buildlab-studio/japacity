// The 3D scene of a place, loaded only where WebGL exists. One sun and one sky light set by the
// place (R-ASSET-006), fog near or far by mode, a 32 degree lens at a person's height that rises to a
// plan view while the screen is held, and one frame loop that moves the clock, the crowd's idling,
// the walk and the camera. Taps walk the character or open a card; nothing here sends a command
// (city.md R-CITY-001).
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { type Camera, type DirectionalLight, Fog, type Object3D, PerspectiveCamera, Vector3 } from "three";

import { advanceClock } from "../../shared/three/clock";
import { loadModel } from "../../shared/three/load";
import { loadManifest } from "../../shared/three/manifest";
import { loadGrids } from "../../shared/three/motion";
import { poseFigure } from "../../shared/three/people";
import { BEHIND, cameraAim, EYE, FOV, WORLD_FOV, worldAim } from "./camera";
import { filesOf, stageOf } from "./placeFile";
import type { CityProbe, Picked, SceneProps } from "./scene.types";
import { standAt, stepWalk, strideOf, type Walker, walkRoute } from "./walk";
import { findRoute } from "./walk/route";
import { animateWorld, buildWorld, colourOf, skyColours, type World } from "./world";

/** How much further the fog stands while looking from above, so the plan is not lost in it. */
const PLAN_FOG = 90;
const HOLD_MS = 450;
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
function aimCamera(camera: Camera, walker: Walker, heading: number, plan: number, aspect: number, world = false): void {
  const { position, target } = world ? worldAim(walker, heading, plan, aspect) : cameraAim(walker, heading, plan, aspect);
  camera.position.set(...position);
  camera.lookAt(...target);
}

interface WorldProps extends SceneProps {
  /** The DOM box the marks are laid out in. */
  markBox: HTMLDivElement | null;
  /** How far toward the plan view the camera stands, 0 to 1. */
  plan: number;
  takeTap: () => boolean;
  /** A tap landed: the overview comes down to the street. */
  onTap: () => void;
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
  const { place, file, people, own, settings, text, onProgress, onFailed, onPick, onFrame, looking, plan, takeTap, onTap, actionOf, marks = [], markBox } = props;
  const markNodes = useRef<HTMLButtonElement[]>([]);
  // The marks' buttons live in the DOM box beside the canvas; the frame loop moves them.
  useEffect(() => {
    if (markBox === null) return;
    const nodes = marks.map((mark) => {
      const node = document.createElement("button");
      node.type = "button";
      node.textContent = mark.text;
      node.dataset.mark = mark.text;
      node.className = "pointer-events-auto absolute -translate-x-1/2 -translate-y-full rounded-full border-2 border-ink bg-accent px-3 py-1 text-sm font-bold text-ink shadow-md";
      node.style.display = "none";
      node.onclick = () => onPick(mark.picked);
      markBox.append(node);
      return node;
    });
    markNodes.current = nodes;
    return () => {
      for (const node of nodes) node.remove();
      markNodes.current = [];
    };
    // The marks are rebuilt when the list changes; the pick callback is the screen's and may change freely.
  }, [marks, markBox]);
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
      await loadGrids(stage.motion.map((motion) => motion.kind), settings.mesh, (path) => loadModel(manifest, path, text));
      if (!alive) return;
      const [x, z, facing] = stage.start;
      walker.current = standAt(x, z, facing);
      setWorld(buildWorld(stage, models, people, own, settings, text, place));
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
      people: world.crowd.length + world.dancers.length + 1,
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
      screenOfModel: (suffix) => {
        // Copies are instanced at the origin, so the spot comes from the stage, not the scene graph.
        const spot = stage.models.find((model) => model.file.endsWith(suffix))?.at[0];
        if (spot === undefined) return null;
        const at = new Vector3(spot[0], 1.5, spot[1]);
        at.project(camera);
        if (at.z > 1 || Math.abs(at.x) > 1 || Math.abs(at.y) > 1) return null;
        return { x: ((at.x + 1) / 2) * size.width, y: ((1 - at.y) / 2) * size.height };
      },
    };
    window.__city = probe;
    return () => {
      if (window.__city === probe) delete window.__city;
    };
  }, [world, place, camera, size, stage]);

  useFrame((state, delta) => {
    const time = advanceClock(delta);
    if (world === null) return;
    const ms = delta * 1000;
    if (looking) {
      onFrame(ms);
      frames.current = [...frames.current, ms].slice(-100);
    }
    animateWorld(world, time, delta);
    const next = stepWalk(walker.current, delta);
    walker.current = next;
    world.own.root.position.set(next.x, 0, next.z);
    world.own.root.rotation.y = next.facing;
    if (next.target === null) poseFigure(world.own, time, "stand");
    else poseFigure(world.own, time, "walk", strideOf(next));
    planShare.current += (plan - planShare.current) * Math.min(1, delta * 4);
    const raised = props.overview === true;
    aimCamera(state.camera, next, stage.start[2], planShare.current, state.size.width / Math.max(1, state.size.height), raised);
    if (state.camera instanceof PerspectiveCamera) {
      const fov = raised ? WORLD_FOV : FOV;
      if (state.camera.fov !== fov) {
        state.camera.fov = fov;
        state.camera.updateProjectionMatrix();
      }
    }
    if (state.scene.fog instanceof Fog) {
      if (raised) {
        // The raised view stands far back, so the fog starts beyond the place and only softens the edge of the city.
        const distance = state.camera.position.distanceTo(new Vector3(next.x, 0, next.z));
        state.scene.fog.near = distance + 30;
        state.scene.fog.far = distance * 2 + 90;
      } else {
        state.scene.fog.near = settings.fog.near + planShare.current * PLAN_FOG;
        state.scene.fog.far = settings.fog.far + planShare.current * PLAN_FOG;
      }
    }
    const light = sun.current;
    if (light !== null) {
      light.position.set(next.x + stage.light.sun[0], stage.light.sun[1], next.z + stage.light.sun[2]);
      light.target.position.set(next.x, 0, next.z);
      light.target.updateMatrixWorld();
    }
    const at = new Vector3();
    markNodes.current.forEach((node, index) => {
      const mark = marks[index];
      if (mark === undefined) return;
      at.set(mark.x, 2.4, mark.z).project(state.camera);
      const visible = at.z < 1 && Math.abs(at.x) < 1.1 && Math.abs(at.y) < 1.1;
      node.style.display = visible ? "" : "none";
      if (visible) {
        node.style.left = `${String(((at.x + 1) / 2) * state.size.width)}px`;
        node.style.top = `${String(((1 - at.y) / 2) * state.size.height)}px`;
      }
    });
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
    onTap();
    const picked = pickedOf(event.object);
    const probe = window.__city;
    const does = picked?.kind === "model" && actionOf !== undefined ? actionOf(picked.file) : null;
    if (probe !== undefined) probe.lastTap = { picked, action: does === null ? null : does.kind === "action" ? does.activity : does.kind === "ride" ? does.vehicle : does.kind === "enter" ? does.place : null };
    // In the world mode a thing that stages an action, gives a ride or opens a door does that (docs/design/11, rules 3 and 13).
    if (does !== null) {
      onPick(does);
      return;
    }
    // A person, the player, or a shopfront with its signs opens a card; anything else is ground to walk to.
    if (picked !== null && (picked.kind !== "model" || picked.signs.length > 0)) {
      onPick(picked);
      return;
    }
    // A route round the things in the way on the place's map; where no ground can be reached, the character stays.
    if (world !== null) walker.current = walkRoute(walker.current, findRoute(world.routes, walker.current, { x: event.point.x, z: event.point.z }));
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

/** Where the world mode's view starts and how far the pinch may move it (docs/design/11, rule 11). */
export const OVERVIEW = { start: 0.55, min: 0, max: 1 };

export default function CityScene(props: SceneProps) {
  const [plan, setPlan] = useState(false);
  const [height, setHeight] = useState(props.zoom ?? OVERVIEW.start);
  const pinch = useRef<{ gap: number; height: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const world = props.overview === true;
  const [markBox, setMarkBox] = useState<HTMLDivElement | null>(null);
  const holding = useRef<number | null>(null);
  const held = useRef(false);
  const release = (): void => {
    if (holding.current !== null) window.clearTimeout(holding.current);
    holding.current = null;
    setPlan(false);
  };
  const { settings, looking, place, marks } = props;
  const startZoom = props.zoom ?? OVERVIEW.start;
  useEffect(() => setHeight(startZoom), [place, startZoom]);
  const clamp = (value: number): number => Math.min(OVERVIEW.max, Math.max(OVERVIEW.min, value));
  return (
    <div
      className="relative size-full touch-none"
      onPointerDown={(event) => {
        if (!looking) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (world && pointers.current.size === 2) {
          const [a, b] = [...pointers.current.values()];
          if (a !== undefined && b !== undefined) pinch.current = { gap: Math.hypot(a.x - b.x, a.y - b.y), height };
          held.current = true;
          return;
        }
        if (world) return;
        held.current = false;
        holding.current = window.setTimeout(() => {
          held.current = true;
          setPlan(true);
        }, HOLD_MS);
      }}
      onPointerMove={(event) => {
        if (!world || !pointers.current.has(event.pointerId)) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const start = pinch.current;
        if (start === null || pointers.current.size < 2) return;
        const [a, b] = [...pointers.current.values()];
        if (a === undefined || b === undefined) return;
        const gap = Math.hypot(a.x - b.x, a.y - b.y);
        // Fingers apart brings the view closer; together pulls it back.
        setHeight(clamp(start.height - (gap - start.gap) / 400));
      }}
      onPointerUp={(event) => {
        pointers.current.delete(event.pointerId);
        if (pointers.current.size < 2) pinch.current = null;
        release();
      }}
      onPointerCancel={(event) => {
        pointers.current.delete(event.pointerId);
        pinch.current = null;
        release();
      }}
      onPointerLeave={release}
      onWheel={(event) => {
        if (!world || !looking) return;
        setHeight(clamp(height + event.deltaY * 0.0015));
      }}
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
          markBox={markBox}
          plan={world ? height : plan ? 1 : 0}
          onTap={() => undefined}
          takeTap={() => {
            const was = held.current;
            held.current = false;
            return was;
          }}
        />
      </Canvas>
      <div ref={setMarkBox} className="pointer-events-none absolute inset-0" aria-hidden={marks === undefined} data-marks />
    </div>
  );
}
