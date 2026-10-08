// The 3D scene of a place, loaded only where WebGL exists. One sun and one sky light set by the
// place (R-ASSET-006), fog near or far by mode, and one frame loop that moves the clock, the crowd's
// idling, the walk and the camera. In the world (docs/rules/world.md) the camera is the place's
// raised shot, turned by one finger and zoomed by the pinch to the whole place or close on the
// character (R-WORLD-009); the things carry labels, and a tap on one walks the character straight to
// it and floats its acts over it (R-WORLD-005, 010). The street camera at a person's eyes, the plan
// view while the screen is held and the routed walks stay for the city behind the panels and for
// `tuning.city.roam`. Nothing here sends a command (city.md R-CITY-001).
import { onWalkable } from "@japacity/assets";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import { type Camera, type DirectionalLight, Fog, type Object3D, PerspectiveCamera, Vector3 } from "three";

import type { Act, Shot, Thing } from "../../shared/world/contract";
import { advanceClock } from "../../shared/three/clock";
import { loadModel } from "../../shared/three/load";
import { loadManifest } from "../../shared/three/manifest";
import { loadGrids } from "../../shared/three/motion";
import { poseFigure } from "../../shared/three/people";
import { BEHIND, cameraAim, EYE, FOV } from "./camera";
import { limitMotion } from "./limits";
import { filesOf, type Stage, stageOf } from "./placeFile";
import type { CityProbe, ScenePick, SceneProps } from "./scene.types";
import { sceneWords } from "./scene.words";
import { aimShot, clampTurn, SHOT_FOV, SHOT_NEAR_PLANE, shotOf, snapZoom, widthEnds } from "./shot";
import { thingSpot, walkSpot } from "./things";
import { standAt, stepWalk, strideOf, type Walker, walkRoute, walkTo } from "./walk";
import { walkableOf } from "./walk/map";
import { findRoute } from "./walk/route";
import { SHEET_KINDS } from "../../../../../tools/assets/world-check";
import { animateWorld, buildWorld, colourOf, skyColours, type World } from "./world";

/** How much further the fog stands while looking from above, so the plan is not lost in it. */
const PLAN_FOG = 90;
const HOLD_MS = 450;
/** Behind the panels the scene only idles: a frame a second, so the panels keep the processor. */
const IDLE_MS = 1000;
/** A finger that moves further than this before it lifts turned the view; it did not tap. */
const DRAG_PX = 8;
/** Degrees the view turns for each pixel a finger moves across the screen. */
const TURN_PER_PX = 0.25;
/** Pixels the fingers of a pinch move apart for the view to go from the whole place to close. */
const PINCH_PX = 260;
/** How quickly the view eases to where it is going, a share a second. */
const EASE = 7;
/** A label, and a thing's acts, float this high over the thing's spot. */
const LABEL_Y = 2.6;
/** The sun's shadow covers the place's width and this much round it, in metres. */
const SHADOW_MARGIN = 4;
const SHADOW_BIAS = -0.0005;
const SHADOW_NORMAL_BIAS = 0.04;

/** What a ray landed on, before the scene reads it as a thing. */
type Hit = { kind: "own" } | { kind: "person"; slot: number } | { kind: "model"; file: string; signs: string[] };

function hitOf(object: Object3D | null): Hit | null {
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

/** The view the player has made with the pinch and one finger (R-WORLD-009), shared by the gestures and the frame loop. */
interface Rig {
  /** 1 the whole place, 0 close on the character; between while a pinch is held. */
  zoom: number;
  /** Where the zoom is easing to: always 0 or 1. */
  zoomTo: 0 | 1;
  /** Degrees either side of the shot's facing. */
  turn: number;
  pinching: boolean;
}

const wholeRig = (): Rig => ({ zoom: 1, zoomTo: 1, turn: 0, pinching: false });

/** Where a point of the place falls on the screen, in CSS pixels, or null when it is off it or behind the camera. */
function onScreen(camera: Camera, size: { width: number; height: number }, x: number, y: number, z: number, margin = 1): { x: number; y: number } | null {
  const at = new Vector3(x, y, z).project(camera);
  if (at.z > 1 || Math.abs(at.x) > margin || Math.abs(at.y) > margin) return null;
  return { x: ((at.x + 1) / 2) * size.width, y: ((1 - at.y) / 2) * size.height };
}

/** The street camera behind the character along the start's facing, or the plan view as far as `plan` has risen. */
function aimStreet(camera: Camera, walker: Walker, heading: number, plan: number, aspect: number): void {
  const { position, target } = cameraAim(walker, heading, plan, aspect);
  camera.position.set(...position);
  camera.lookAt(...target);
}

function lens(camera: Camera, fov: number, near: number): void {
  if (!(camera instanceof PerspectiveCamera) || (camera.fov === fov && camera.near === near)) return;
  camera.fov = fov;
  camera.near = near;
  camera.updateProjectionMatrix();
}

interface PlaceProps extends SceneProps {
  /** The DOM box the labels and the acts are laid out in. */
  markBox: HTMLDivElement | null;
  /** How far toward the plan view the street camera stands, 0 to 1. */
  plan: number;
  /** The raised view's state, moved by the gestures. */
  rig: MutableRefObject<Rig>;
  /** The place's shot. */
  shot: Shot;
  /** True when the view is the raised shot; false for the street camera. */
  raised: boolean;
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

/** A thing's label: its name, over it, tapped like the thing itself. */
function labelNode(thing: Thing, onTap: () => void): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = sceneWords(thing.label);
  node.dataset.mark = thing.id;
  node.className = "chip pointer-events-auto absolute -translate-x-1/2 -translate-y-full whitespace-nowrap px-2.5 py-1 text-[12px] font-extrabold";
  node.style.display = "none";
  node.onclick = onTap;
  return node;
}

/** A thing's name and its one or two acts, floating over it with a small arrow down to it (R-WORLD-005). */
function chipNode(thing: Thing, onAct: (act: Act) => void): HTMLDivElement {
  const chip = document.createElement("div");
  chip.dataset.thingChip = thing.id;
  chip.setAttribute("role", "group");
  chip.setAttribute("aria-label", sceneWords(thing.label));
  chip.className = "pointer-events-auto absolute -translate-x-1/2 -translate-y-full pb-2";
  chip.style.display = "none";
  const body = document.createElement("div");
  body.className = "panel chip-in flex flex-col items-center gap-1.5 px-3 pt-2 pb-2.5";
  const name = document.createElement("p");
  name.className = "title text-[15px] leading-tight whitespace-nowrap";
  name.textContent = sceneWords(thing.label);
  const acts = document.createElement("div");
  acts.className = "flex gap-1.5";
  for (const act of thing.acts) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.act = act.id;
    button.className = "rounded-[5px] bg-action px-3 py-2 text-[13px] font-extrabold whitespace-nowrap text-action-text";
    button.textContent = sceneWords(act.label);
    button.onclick = () => onAct(act);
    acts.append(button);
  }
  const arrow = document.createElement("div");
  arrow.className = "absolute bottom-0 left-1/2 size-0 -translate-x-1/2 border-x-8 border-t-8 border-x-transparent border-t-sheet";
  body.append(name, acts);
  chip.append(body, arrow);
  return chip;
}

function Place(props: PlaceProps) {
  const { place, file, people, own, settings, text, onProgress, onFailed, onPick, onFrame, looking, plan, takeTap, markBox, rig, shot, raised } = props;
  const roam = props.overview !== true || props.roam === true;
  const things = useMemo(() => props.things ?? [], [props.things]);
  const chosen = props.chosen ?? null;
  const [world, setWorld] = useState<World | null>(null);
  const walker = useRef<Walker>(standAt(0, 0, 0));
  const planShare = useRef(0);
  const sun = useRef<DirectionalLight>(null);
  const frames = useRef<number[]>([]);
  /** An act chosen while the character still walks to its thing: it follows on arrival (R-WORLD-010). */
  const pending = useRef<{ thing: Thing; act: Act } | null>(null);
  const labels = useRef<{ thing: Thing; node: HTMLButtonElement }[]>([]);
  const chip = useRef<{ thing: Thing; node: HTMLDivElement } | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const plain = stageOf(file);
  const level = settings.mesh === "fine" ? "high" : "low";
  // The moving sheets a mode may draw, the cheapest kept (R-WORLD-011); the roaming city draws them all.
  const stage: Stage = useMemo(() => (roam ? plain : { ...plain, motion: limitMotion(plain.motion, level) }), [plain, roam, level]);
  const peopleKey = people.map((shown) => `${shown.person.file}:${String(shown.tag)}`).join("|");

  const choose = (thing: Thing): void => {
    const to = walkSpot(stage, thing, walker.current);
    if (to !== null) walker.current = walkTo(walker.current, to[0], to[1]);
    pending.current = null;
    pick.current({ kind: "thing", thing });
  };
  const chooseRef = useRef(choose);
  chooseRef.current = choose;

  // The labels live in the DOM box beside the canvas, one over each thing; the frame loop moves them.
  useEffect(() => {
    if (markBox === null) return;
    const made = things.map((thing) => ({ thing, node: labelNode(thing, () => chooseRef.current(thing)) }));
    for (const { node } of made) markBox.append(node);
    labels.current = made;
    return () => {
      for (const { node } of made) node.remove();
      labels.current = [];
    };
  }, [things, markBox]);

  // The chosen thing's acts float over it until another tap puts them away.
  useEffect(() => {
    if (markBox === null || chosen === null) return;
    const node = chipNode(chosen, (act) => {
      pending.current = { thing: chosen, act };
    });
    markBox.append(node);
    chip.current = { thing: chosen, node };
    return () => {
      node.remove();
      chip.current = null;
    };
  }, [chosen, markBox]);

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
      pending.current = null;
      setWorld(buildWorld(stage, models, people, own, settings, text, place, roam));
    })().catch((error: unknown) => {
      if (alive) onFailed(error instanceof Error ? error.message : String(error));
    });
    return () => {
      alive = false;
    };
    // The world is rebuilt for a new place, a new crowd or a new mode; the callbacks are the screen's and may change freely.
  }, [place, file, peopleKey, own, settings.mesh, settings.shadows, roam]);

  useEffect(() => {
    if (world === null) return;
    const spotOf = (id: string): [number, number] | null => {
      const thing = things.find((candidate) => candidate.id === id);
      return thing === undefined ? null : thingSpot(stage, thing);
    };
    const probe: CityProbe = {
      place,
      ready: true,
      drawCalls: 0,
      triangles: 0,
      frames: [],
      walker: walker.current,
      people: world.crowd.length + world.dancers.length + 1,
      sheets: stage.motion.filter((motion) => SHEET_KINDS.has(motion.kind)).length,
      ...(sun.current === null ? {} : { shadow: { bias: sun.current.shadow.bias, normalBias: sun.current.shadow.normalBias, reach: sun.current.shadow.camera.right } }),
      screenOf: (slot) => {
        const placed = world.crowd.find((entry) => entry.slot === slot);
        if (placed === undefined) return null;
        const at = new Vector3();
        placed.figure.root.getWorldPosition(at);
        return onScreen(camera, size, at.x, at.y + 1.1, at.z);
      },
      screenOfModel: (suffix) => {
        // Copies are instanced at the origin, so the spot comes from the stage, not the scene graph.
        const spot = stage.models.find((model) => model.file.endsWith(suffix))?.at[0];
        return spot === undefined ? null : onScreen(camera, size, spot[0], 1.5, spot[1]);
      },
      ...(raised
        ? {
            shot,
            zoom: rig.current.zoom,
            zoomTo: rig.current.zoomTo,
            screenOfThing: (id: string) => {
              const spot = spotOf(id);
              return spot === null ? null : onScreen(camera, size, spot[0], 1, spot[1]);
            },
            fits: () => {
              const ends = widthEnds(shot, rig.current.turn).every(([x, y, z]) => onScreen(camera, size, x, y, z) !== null);
              const offScreen = things.filter((thing) => {
                const spot = thingSpot(stage, thing);
                return spot === null || onScreen(camera, size, spot[0], 0, spot[1]) === null;
              });
              return { width: ends, offScreen: offScreen.map((thing) => thing.id) };
            },
          }
        : {}),
    };
    window.__city = probe;
    return () => {
      if (window.__city === probe) delete window.__city;
    };
  }, [world, place, camera, size, stage, things, raised, shot, rig]);

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
    // The act follows once the character has reached its thing.
    const waiting = pending.current;
    if (waiting !== null && next.target === null) {
      pending.current = null;
      pick.current({ kind: "act", thing: waiting.thing, act: waiting.act });
    }
    const aspect = state.size.width / Math.max(1, state.size.height);
    const view = rig.current;
    if (raised) {
      if (!view.pinching) {
        view.zoom += (view.zoomTo - view.zoom) * Math.min(1, delta * EASE);
        if (Math.abs(view.zoomTo - view.zoom) < 0.002) view.zoom = view.zoomTo;
      }
      const { position, target } = aimShot(shot, view, next, aspect);
      state.camera.position.set(...position);
      state.camera.lookAt(...target);
      lens(state.camera, SHOT_FOV, SHOT_NEAR_PLANE);
    } else {
      planShare.current += (plan - planShare.current) * Math.min(1, delta * 4);
      aimStreet(state.camera, next, stage.start[2], planShare.current, aspect);
      lens(state.camera, FOV, 0.1);
    }
    if (state.scene.fog instanceof Fog) {
      if (raised) {
        // The raised view stands far back, so the fog starts beyond the place and only softens the edge of the city.
        const distance = state.camera.position.distanceTo(new Vector3(...shot.centre));
        state.scene.fog.near = distance + 30;
        state.scene.fog.far = distance * 2 + 90;
      } else {
        state.scene.fog.near = settings.fog.near + planShare.current * PLAN_FOG;
        state.scene.fog.far = settings.fog.far + planShare.current * PLAN_FOG;
      }
    }
    const light = sun.current;
    if (light !== null) {
      // In the world the sun stands over the place's centre, so its shadow covers the place and only the place (R-WORLD-012).
      const [cx, , cz] = raised ? shot.centre : [next.x, 0, next.z];
      light.position.set(cx + stage.light.sun[0], stage.light.sun[1], cz + stage.light.sun[2]);
      light.target.position.set(cx, 0, cz);
      light.target.updateMatrixWorld();
    }
    for (const { thing, node } of labels.current) {
      const spot = thingSpot(stage, thing);
      const at = spot === null || chip.current?.thing.id === thing.id ? null : onScreen(state.camera, state.size, spot[0], LABEL_Y, spot[1], 1.05);
      node.style.display = at === null ? "none" : "";
      if (at !== null) {
        node.style.left = `${String(at.x)}px`;
        node.style.top = `${String(at.y)}px`;
      }
    }
    const shown = chip.current;
    if (shown !== null) {
      const spot = thingSpot(stage, shown.thing);
      const at = spot === null ? null : onScreen(state.camera, state.size, spot[0], LABEL_Y, spot[1], 1.2);
      shown.node.style.display = at === null ? "none" : "";
      if (at !== null) {
        shown.node.style.left = `${String(at.x)}px`;
        shown.node.style.top = `${String(at.y)}px`;
      }
    }
    const probe = window.__city;
    if (probe !== undefined) {
      probe.drawCalls = gl.info.render.calls;
      probe.triangles = gl.info.render.triangles;
      probe.frames = frames.current;
      probe.walker = next;
      if (raised) {
        probe.zoom = view.zoom;
        probe.zoomTo = view.zoomTo;
      }
    }
  });

  const tapped = (event: ThreeEvent<MouseEvent>): void => {
    event.stopPropagation();
    if (!looking || takeTap()) return;
    const hit = hitOf(event.object);
    let picked: ScenePick | null = hit;
    if (hit?.kind === "model") {
      // Which copy was tapped: the one standing nearest the point the ray met.
      const copies = stage.models.find((model) => model.file === hit.file)?.at ?? [];
      let copy = -1;
      let best = Infinity;
      copies.forEach(([x, z], index) => {
        const far = Math.hypot(x - event.point.x, z - event.point.z);
        if (far < best) [best, copy] = [far, index];
      });
      const thing = things.find((candidate) => candidate.file === hit.file && candidate.copy === copy);
      if (thing !== undefined) {
        if (window.__city !== undefined) window.__city.lastTap = { picked: { kind: "thing", thing }, action: thing.acts[0]?.stages ?? thing.acts[0]?.kind ?? null };
        choose(thing);
        return;
      }
      // A shopfront with its signs opens a card; any other model is not a place to walk to.
      picked = hit.signs.length > 0 ? hit : null;
      if (picked === null) return;
    }
    if (window.__city !== undefined) window.__city.lastTap = { picked, action: null };
    if (picked !== null) {
      onPick(picked);
      return;
    }
    if (world === null) return;
    pending.current = null;
    props.onClear?.();
    const point = { x: event.point.x, z: event.point.z };
    // The roaming city routes round the things in the way; the world walks straight, and only on its walkable ground.
    if (world.routes !== null) walker.current = walkRoute(walker.current, findRoute(world.routes, walker.current, point));
    else if (onWalkable(walkableOf(stage), point.x, point.z)) walker.current = walkTo(walker.current, point.x, point.z);
  };

  const { sky, background, fog } = skyColours(stage.light.sky, stage.light.ground, settings.haze);
  const reach = raised ? Math.max(shot.width ?? 0, 16) / 2 + SHADOW_MARGIN : 24;
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
        shadow-bias={SHADOW_BIAS}
        shadow-normalBias={SHADOW_NORMAL_BIAS}
        shadow-camera-left={-reach}
        shadow-camera-right={reach}
        shadow-camera-top={reach}
        shadow-camera-bottom={-reach}
        shadow-camera-far={140}
      />
      {world === null ? null : <primitive object={world.root} onClick={tapped} />}
    </>
  );
}

export default function CityScene(props: SceneProps) {
  const [plan, setPlan] = useState(false);
  const pinch = useRef<{ gap: number; zoom: number } | null>(null);
  const drag = useRef<{ x: number; turn: number } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const { settings, looking, file, zoomed = false, onZoomed } = props;
  const raised = props.overview === true && props.roam !== true;
  const shot = useMemo(() => shotOf(stageOf(file)), [file]);
  const rig = useRef<Rig>(wholeRig());
  const [markBox, setMarkBox] = useState<HTMLDivElement | null>(null);
  const holding = useRef<number | null>(null);
  const held = useRef(false);
  // Entering a place, or a room, always shows the whole of it (R-WORLD-009).
  useEffect(() => {
    rig.current = wholeRig();
  }, [file]);
  // The shell's chip "See the whole place" sends the view back; the pinch reports where it rests.
  useEffect(() => {
    rig.current.zoomTo = zoomed ? 0 : 1;
  }, [zoomed]);
  const rest = (to: 0 | 1): void => {
    rig.current.zoomTo = to;
    rig.current.pinching = false;
    onZoomed?.(to === 0);
  };
  const release = (): void => {
    if (holding.current !== null) window.clearTimeout(holding.current);
    holding.current = null;
    setPlan(false);
  };
  return (
    <div
      className="relative size-full touch-none"
      data-shot={raised ? "raised" : "street"}
      onPointerDown={(event) => {
        if (!looking) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (raised) {
          if (pointers.current.size === 1) {
            held.current = false;
            drag.current = { x: event.clientX, turn: rig.current.turn };
          }
          if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()];
            if (a !== undefined && b !== undefined) pinch.current = { gap: Math.hypot(a.x - b.x, a.y - b.y), zoom: rig.current.zoom };
            rig.current.pinching = true;
            drag.current = null;
            held.current = true;
          }
          return;
        }
        held.current = false;
        holding.current = window.setTimeout(() => {
          held.current = true;
          setPlan(true);
        }, HOLD_MS);
      }}
      onPointerMove={(event) => {
        if (!raised || !pointers.current.has(event.pointerId)) return;
        pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const start = pinch.current;
        if (start !== null && pointers.current.size >= 2) {
          const [a, b] = [...pointers.current.values()];
          if (a === undefined || b === undefined) return;
          // Fingers apart bring the view closer; together pull it back.
          const gap = Math.hypot(a.x - b.x, a.y - b.y);
          rig.current.zoom = Math.min(1, Math.max(0, start.zoom - (gap - start.gap) / PINCH_PX));
          return;
        }
        const turning = drag.current;
        if (turning === null) return;
        const moved = event.clientX - turning.x;
        if (Math.abs(moved) < DRAG_PX && !held.current) return;
        held.current = true;
        rig.current.turn = clampTurn(shot, turning.turn - moved * TURN_PER_PX);
      }}
      onPointerUp={(event) => {
        pointers.current.delete(event.pointerId);
        if (pinch.current !== null && pointers.current.size < 2) {
          pinch.current = null;
          rest(snapZoom(rig.current.zoom));
        }
        if (pointers.current.size === 0) drag.current = null;
        release();
      }}
      onPointerCancel={(event) => {
        pointers.current.delete(event.pointerId);
        if (pinch.current !== null) {
          pinch.current = null;
          rest(snapZoom(rig.current.zoom));
        }
        drag.current = null;
        release();
      }}
      onPointerLeave={release}
      onWheel={(event) => {
        if (!raised || !looking || event.deltaY === 0) return;
        rest(event.deltaY < 0 ? 0 : 1);
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
          plan={plan ? 1 : 0}
          rig={rig}
          shot={shot}
          raised={raised}
          takeTap={() => {
            const was = held.current;
            held.current = false;
            return was;
          }}
        />
      </Canvas>
      <div ref={setMarkBox} className="pointer-events-none absolute inset-0" aria-hidden={props.things === undefined} data-marks />
    </div>
  );
}
