// The city as the map on screen (docs/rules/world.md R-WORLD-015): the camera lifts out of the place
// into the city seen from above; a drag slides it, a pinch or the wheel zooms, a tap on a stop picks
// it and lights the route there along the roads. One scene, instanced (see scene.ts).
import { content } from "@japacity/content";
import { useEffect, useRef } from "react";
import { PerspectiveCamera, Vector3 } from "three";

import { mountCanvas } from "../../shared/three/sharedRenderer";

import { BOARD_GAP, boardsShown } from "./boards";
import { buildCityMap, type CityMap as Drawn, readColours } from "./scene";
import { BOUNDS, districts, routeBetween, toXZ, type XZ } from "./layout";
import { mapText, mapWords } from "./map.words";
import type { MapPin } from "./pins";
import { headingOf } from "./RideSheet";

export interface CityMapProps {
  pins: readonly MapPin[];
  home: string | null;
  /** The stop picked, whose route is lit, or null. */
  picked: string | null;
  onPick: (id: string | null) => void;
}

/** What the browser test reads: the renderer's own count of the last frame, and where things are. */
export interface MapProbe {
  ready: boolean;
  drawCalls: number;
  triangles: number;
  frames: number;
  route: XZ[] | null;
  stops: { id: string; state: string; at: XZ }[];
  screenOf: (id: string) => { x: number; y: number } | null;
}

declare global {
  interface Window {
    __map?: MapProbe;
  }
}

const PLACES = Object.values(content.place);
/** The camera's pitch above the ground, and how near and far it may be. */
const PITCH = (56 * Math.PI) / 180;
const NEAR = 45;
const FAR = 420;
/** A tap within this many pixels of a board picks its stop. */
const TAP_PX = 46;
/** The map opens on the stops within this many units of the player. */
const OPEN_RADIUS = 32;
/** The camera distance at which a board is drawn at its own size; nearer or further, it is scaled to read the same. */
const BOARD_AT = 120;

function distanceBetween(a: XZ, b: XZ | undefined): number {
  return b === undefined ? 0 : Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** The camera's place: where it looks on the ground and how far back it stands. */
interface View {
  x: number;
  z: number;
  distance: number;
}

function clampView(view: View): View {
  return {
    x: Math.min(BOUNDS.east, Math.max(BOUNDS.west, view.x)),
    z: Math.min(BOUNDS.south, Math.max(BOUNDS.north, view.z)),
    distance: Math.min(FAR, Math.max(NEAR, view.distance)),
  };
}

/** The view that shows every point given, a little above the sheet's edge when one is up. */
function framing(points: readonly XZ[], camera: PerspectiveCamera, sheetUp: boolean): View {
  const xs = points.map(([x]) => x);
  const zs = points.map(([, z]) => z);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  const vertical = (camera.fov * Math.PI) / 180;
  const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * camera.aspect);
  const wide = (maxX - minX + 18) / (2 * Math.tan(horizontal / 2));
  // The ground is seen at a slant, so its depth looks shorter by the sine of the pitch.
  const deep = ((maxZ - minZ + 14) * Math.sin(PITCH)) / (2 * Math.tan(vertical / 2)) / (sheetUp ? 0.55 : 0.85);
  const distance = Math.max(wide, deep, NEAR + 15);
  // With the sheet up, the middle of the points sits in the top half of the screen.
  const shift = sheetUp ? distance * 0.24 : distance * 0.04;
  return clampView({ x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 + shift, distance });
}

function aim(camera: PerspectiveCamera, view: View): void {
  camera.position.set(view.x, Math.sin(PITCH) * view.distance, view.z + Math.cos(PITCH) * view.distance);
  camera.lookAt(view.x, 0, view.z);
}

export function CityMap({ pins, home, picked, onPick }: CityMapProps) {
  const box = useRef<HTMLDivElement>(null);
  const drawn = useRef<{ map: Drawn; camera: PerspectiveCamera; want: View; view: View } | null>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const pickedId = useRef(picked);
  pickedId.current = picked;

  useEffect(() => {
    if (box.current === null) return;
    const { canvas: element, renderer, unmount } = mountCanvas("map", box.current, "size-full touch-none", "data-city-map");
    const named = (area: string): boolean => mapText[`map.area.${area}`] !== undefined;
    const map = buildCityMap(pins, {
      colours: readColours(),
      home,
      districts: districts(
        PLACES,
        named,
        pins.map((pin) => toXZ(pin.position)),
      ),
      boardText: (pin, isHome) => (isHome ? mapWords("map.state.home") : headingOf(pin.name)),
      districtText: (area) => mapWords(`map.area.${area}`),
      canvas: document.createElement("canvas"),
    });
    const camera = new PerspectiveCamera(40, 1, 1, 1600);
    const resize = (): void => {
      renderer.setSize(element.clientWidth, element.clientHeight, false);
      camera.aspect = element.clientWidth / Math.max(1, element.clientHeight);
      camera.updateProjectionMatrix();
    };
    resize();
    // The camera lifts out of the place: it starts close over where the player is and rises to the city.
    const here = map.stops.find((stop) => stop.pin.state === "here") ?? map.stops[0];
    const start: View = clampView({ x: here?.at[0] ?? 0, z: here?.at[1] ?? 0, distance: NEAR });
    // It settles on the stops round the player: those near, and never fewer than four. The rest are a drag away.
    const near = [...map.stops].sort((a, b) => distanceBetween(a.at, here?.at) - distanceBetween(b.at, here?.at)).filter((stop, index) => index < 4 || distanceBetween(stop.at, here?.at) < OPEN_RADIUS);
    const want = framing(
      near.map((stop) => stop.at),
      camera,
      false,
    );
    const state = { map, camera, want, view: { ...start } };
    drawn.current = state;
    window.addEventListener("resize", resize);

    const screenOf = (point: Vector3): { x: number; y: number } | null => {
      const projected = point.clone().project(camera);
      if (projected.z > 1) return null;
      return { x: ((projected.x + 1) / 2) * element.clientWidth, y: ((1 - projected.y) / 2) * element.clientHeight };
    };
    const probe: MapProbe = {
      ready: false,
      drawCalls: 0,
      triangles: 0,
      frames: 0,
      route: null,
      stops: map.stops.map((stop) => ({ id: stop.pin.id, state: stop.pin.state, at: stop.at })),
      screenOf: (id) => {
        const stop = map.stops.find((candidate) => candidate.pin.id === id);
        return stop === undefined ? null : screenOf(stop.board);
      },
    };
    window.__map = probe;

    // Drag slides the city under the finger, a pinch or the wheel zooms, and a tap picks a stop.
    const pointers = new Map<number, { x: number; y: number }>();
    let down: { x: number; y: number; moved: boolean } | null = null;
    let pinch: number | null = null;
    const pointerDown = (event: PointerEvent): void => {
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      down = { x: event.clientX, y: event.clientY, moved: false };
      element.setPointerCapture(event.pointerId);
    };
    const pointerMove = (event: PointerEvent): void => {
      const before = pointers.get(event.pointerId);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (before === undefined || down === null) return;
      if (pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        if (a === undefined || b === undefined) return;
        const gap = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch !== null) state.want = clampView({ ...state.want, distance: state.want.distance * (pinch / Math.max(1, gap)) });
        pinch = gap;
        down.moved = true;
        return;
      }
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) down.moved = true;
      if (!down.moved) return;
      const metresPerPixel = (2 * state.view.distance * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, element.clientHeight);
      const next = clampView({ x: state.view.x - (event.clientX - before.x) * metresPerPixel, z: state.view.z - ((event.clientY - before.y) * metresPerPixel) / Math.sin(PITCH), distance: state.view.distance });
      state.view = next;
      state.want = { ...state.want, x: next.x, z: next.z };
    };
    const pointerUp = (event: PointerEvent): void => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinch = null;
      if (down === null) return;
      const tap = !down.moved;
      down = null;
      if (!tap) return;
      const box = element.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      let best: { id: string; distance: number } | null = null;
      for (const stop of map.stops) {
        const at = screenOf(stop.board);
        if (at === null) continue;
        const distance = Math.hypot(at.x - x, at.y - y);
        if (distance < TAP_PX && (best === null || distance < best.distance)) best = { id: stop.pin.id, distance };
      }
      pick.current(best?.id ?? null);
    };
    const wheel = (event: WheelEvent): void => {
      event.preventDefault();
      state.want = clampView({ ...state.want, distance: state.want.distance * (1 + event.deltaY * 0.0015) });
    };
    element.addEventListener("pointerdown", pointerDown);
    element.addEventListener("pointermove", pointerMove);
    element.addEventListener("pointerup", pointerUp);
    element.addEventListener("pointercancel", pointerUp);
    element.addEventListener("wheel", wheel, { passive: false });

    let frame = 0;
    let last = 0;
    let boardScale = 1;
    let shownBefore: boolean[] = [];
    const began = performance.now();
    const loop = (now: number): void => {
      frame = requestAnimationFrame(loop);
      // Thirty frames a second is plenty for a breathing ring and running dots.
      if (now - last < 30) return;
      const step = Math.min(0.1, (now - (last || now)) / 1000);
      last = now;
      const ease = 1 - Math.exp(-step * 5);
      state.view = {
        x: state.view.x + (state.want.x - state.view.x) * ease,
        z: state.view.z + (state.want.z - state.view.z) * ease,
        distance: state.view.distance + (state.want.distance - state.view.distance) * ease,
      };
      aim(camera, state.view);
      const scale = Math.min(2.6, Math.max(0.7, state.view.distance / BOARD_AT));
      if (Math.abs(scale - boardScale) > 0.01) {
        boardScale = scale;
        map.setBoardScale(scale);
      }
      // No two boards cover each other: the one that matters less folds away until there is room;
      // the last answer is handed back so a board on the edge of covering does not flicker as the camera eases.
      shownBefore = boardsShown(
          map.boardCorners().map((corners, index) => {
            const points = corners.map((corner) => screenOf(corner) ?? { x: Number.NaN, y: Number.NaN });
            const xs = points.map((point) => point.x);
            const ys = points.map((point) => point.y);
            const stop = map.stops[index];
            return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys), state: stop?.pin.state ?? "not", home: stop?.home ?? false, picked: stop?.pin.id === pickedId.current };
          }),
        BOARD_GAP,
        shownBefore,
      );
      map.setBoardsShown(shownBefore);
      map.tick((now - began) / 1000);
      renderer.render(map.scene, camera);
      probe.drawCalls = renderer.info.render.calls;
      probe.triangles = renderer.info.render.triangles;
      probe.frames += 1;
      probe.ready = true;
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      element.removeEventListener("pointerdown", pointerDown);
      element.removeEventListener("pointermove", pointerMove);
      element.removeEventListener("pointerup", pointerUp);
      element.removeEventListener("pointercancel", pointerUp);
      element.removeEventListener("wheel", wheel);
      map.dispose();
      // The renderer is shared and kept (sharedRenderer.ts); only the canvas leaves the box.
      unmount();
      drawn.current = null;
      if (window.__map === probe) delete window.__map;
    };
    // The city is built once for the pins given; the stop picked only moves the route and the camera.
  }, [pins, home]);

  // Picking a stop lights the route from where the player is, and frames both above the sheet.
  useEffect(() => {
    const state = drawn.current;
    if (state === null) return;
    const here = state.map.stops.find((stop) => stop.pin.state === "here");
    const target = state.map.stops.find((stop) => stop.pin.id === picked);
    if (target === undefined || here === undefined || target === here) {
      state.map.setRoute(null);
      if (window.__map !== undefined) window.__map.route = null;
      if (target !== undefined) state.want = framing([target.at], state.camera, true);
      return;
    }
    const route = routeBetween(state.map.grid, here.at, target.at);
    state.map.setRoute(route);
    if (window.__map !== undefined) window.__map.route = route;
    state.want = framing(route, state.camera, true);
  }, [picked, pins, home]);

  return <div ref={box} className="size-full touch-none" aria-hidden />;
}
