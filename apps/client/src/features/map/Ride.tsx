// The ride (docs/rules/world.md R-WORLD-017): a short scene seen from above, about six seconds, of
// the way chosen going along a road with buildings passing, under a band with "Danfo to <place>",
// its progress, and Skip. When it ends the place opens. The same ride plays from the map and from a
// danfo, keke or okada standing in a place.
import { palette } from "@japacity/assets";
import { useEffect, useRef, useState } from "react";

import { mountCanvas } from "../../shared/three/sharedRenderer";
import {
  BoxGeometry,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Mesh,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from "three";

import { loadModel } from "../../shared/three/load";
import { loadManifest } from "../../shared/three/manifest";
import type { RideChoice } from "../../shared/world/contract";
import { mapWords } from "./map.words";
import { sequence } from "./layout";

/** How long a ride plays: about six seconds (R-WORLD-017). */
export const RIDE_MS = 6000;
/** Metres the vehicle covers in a ride; the street is laid out a little longer. */
const TRAVEL = 150;
const STREET = 240;

export interface RideProps {
  way: RideChoice["id"];
  /** The place's name, as the band says it. */
  place: string;
  drawing: boolean;
  /** The ride is over, played out or skipped. Called once. */
  onDone: () => void;
}

interface Street {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  vehicle: Group;
  dispose: () => void;
}

/** A plain box in the way's colour, until the real model arrives (or where it cannot); on foot, a body-sized one that stays. */
function standIn(way: RideChoice["id"]): Mesh {
  const size = way === "danfo" ? [2.1, 2.2, 5.2] : way === "keke" ? [1.4, 1.7, 2.6] : way === "walk" ? [0.5, 1.7, 0.4] : [0.7, 1.3, 1.9];
  const mesh = new Mesh(new BoxGeometry(size[0], size[1], size[2]), new MeshLambertMaterial({ color: way === "okada" ? palette.red : way === "walk" ? palette.charcoal : palette.danfoYellow }));
  mesh.position.y = (size[1] ?? 1) / 2;
  return mesh;
}

/** The street the ride goes along: a road, its markings, buildings each side and a few trees. */
function buildStreet(renderer: WebGLRenderer, way: RideChoice["id"]): Street {
  const scene = new Scene();
  const air = new Color(palette.sky);
  scene.background = air;
  scene.fog = new Fog(air, 60, 140);
  scene.add(new HemisphereLight(0xffffff, new Color(palette.sand), 1.8));
  const sun = new DirectionalLight(0xfff0d0, 1.5);
  sun.position.set(-20, 40, 10);
  scene.add(sun);
  const camera = new PerspectiveCamera(42, 1, 0.5, 400);
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(thing: T): T => {
    disposables.push(thing);
    return thing;
  };

  const ground = new Mesh(keep(new PlaneGeometry(80, STREET + 60)), keep(new MeshLambertMaterial({ color: palette.laterite })));
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -STREET / 2 + 20;
  scene.add(ground);
  const road = new Mesh(keep(new PlaneGeometry(8, STREET + 60)), keep(new MeshLambertMaterial({ color: palette.asphalt })));
  road.rotation.x = -Math.PI / 2;
  road.position.set(0, 0.03, -STREET / 2 + 20);
  scene.add(road);

  const holder = new Object3D();
  const marks = new InstancedMesh(keep(new BoxGeometry(0.25, 0.04, 2.4)), keep(new MeshLambertMaterial({ color: palette.marking })), Math.ceil(STREET / 6));
  for (let index = 0; index < marks.count; index += 1) {
    holder.position.set(0, 0.06, 20 - index * 6);
    holder.updateMatrix();
    marks.setMatrixAt(index, holder.matrix);
  }
  scene.add(marks);

  // Buildings both sides in two colours of wall, so the street passes in two draw calls.
  const next = sequence(17);
  const box = keep(new BoxGeometry(1, 1, 1));
  box.translate(0, 0.5, 0);
  const walls = [palette.wallCream, palette.wallPeach];
  const lots: { x: number; z: number; w: number; d: number; h: number }[][] = [[], []];
  for (const side of [-1, 1]) {
    for (let z = 20; z > -STREET; z -= 7 + next() * 3) {
      const w = 5 + next() * 4;
      lots[next() < 0.5 ? 0 : 1]?.push({ x: side * (6.5 + w / 2), z, w, d: 5 + next() * 2, h: 3 + next() * 7 });
    }
  }
  lots.forEach((group, colour) => {
    const mesh = new InstancedMesh(box, keep(new MeshLambertMaterial({ color: walls[colour] ?? palette.wallCream })), group.length);
    group.forEach((lot, index) => {
      holder.position.set(lot.x, 0, lot.z);
      holder.scale.set(lot.w, lot.h, lot.d);
      holder.updateMatrix();
      mesh.setMatrixAt(index, holder.matrix);
    });
    scene.add(mesh);
  });
  const trees = new InstancedMesh(keep(new IcosahedronGeometry(1.4, 0)), keep(new MeshLambertMaterial({ color: palette.green, flatShading: true })), 24);
  for (let index = 0; index < trees.count; index += 1) {
    holder.position.set((index % 2 === 0 ? -1 : 1) * 4.9, 2.2, 10 - index * 10 - next() * 4);
    holder.scale.setScalar(0.8 + next() * 0.5);
    holder.updateMatrix();
    trees.setMatrixAt(index, holder.matrix);
  }
  scene.add(trees);

  const vehicle = new Group();
  const stand = standIn(way);
  vehicle.add(stand);
  vehicle.position.x = 1.8;
  scene.add(vehicle);

  return {
    renderer,
    scene,
    camera,
    vehicle,
    dispose: () => {
      for (const thing of disposables) thing.dispose();
      stand.geometry.dispose();
      (stand.material as MeshLambertMaterial).dispose();
      // The renderer is shared across rides and kept (sharedRenderer.ts).
    },
  };
}

export function Ride({ way, place, drawing, onDone }: RideProps) {
  const box = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const [started, setStarted] = useState(false);
  const finish = useRef(onDone);
  finish.current = onDone;
  const end = (): void => {
    if (done.current) return;
    done.current = true;
    finish.current();
  };

  // The ride ends by itself after its time; Skip ends it at once.
  useEffect(() => {
    const timer = window.setTimeout(end, RIDE_MS);
    const start = window.setTimeout(() => setStarted(true), 30);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(start);
    };
  }, []);

  useEffect(() => {
    if (!drawing || box.current === null) return;
    const { canvas: element, renderer, unmount } = mountCanvas("ride", box.current, "size-full");
    const street = buildStreet(renderer, way);
    let alive = true;
    // The real vehicle replaces the stand-in when it has loaded; it is shared and kept loaded.
    if (way !== "walk") void loadManifest()
      .then((manifest) => loadModel(manifest, `shared/veh/veh_${way}.glb`, () => undefined))
      .then((model) => {
        if (!alive) return;
        street.vehicle.clear();
        const copy = model.clone();
        copy.rotation.y = Math.PI;
        street.vehicle.add(copy);
      })
      .catch(() => undefined);
    const resize = (): void => {
      street.renderer.setSize(element.clientWidth, element.clientHeight, false);
      street.camera.aspect = element.clientWidth / Math.max(1, element.clientHeight);
      street.camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);
    const began = performance.now();
    let frame = 0;
    const loop = (now: number): void => {
      frame = requestAnimationFrame(loop);
      const share = Math.min(1, (now - began) / RIDE_MS);
      // Pull away, cruise, and slow into the stop.
      const eased = share < 0.15 ? (share * share) / 0.3 : share > 0.85 ? 1 - ((1 - share) * (1 - share)) / 0.3 : share - 0.075;
      const z = -eased * TRAVEL;
      street.vehicle.position.z = z;
      street.vehicle.position.y = Math.abs(Math.sin(now / 90)) * 0.05;
      street.camera.position.set(8, 34, z + 18);
      street.camera.lookAt(0, 0, z - 10);
      street.renderer.render(street.scene, street.camera);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      street.dispose();
      unmount();
    };
  }, [drawing, way]);

  const title = mapWords("map.ride.to", { way: mapWords(`map.way.${way}`), place });
  return (
    <div className="fade fixed inset-0 z-[46] bg-strong" data-ride={way} aria-live="polite">
      {drawing ? <div ref={box} className="size-full" aria-hidden /> : null}
      <div className="pointer-events-none absolute inset-x-0 top-0 px-3 pt-[max(10px,env(safe-area-inset-top))]">
        <div className="band pointer-events-auto flex items-center gap-3 rounded-[6px] px-3 py-2.5 shadow-[0_10px_24px_rgba(10,14,30,0.35)]">
          <div className="min-w-0 flex-1">
            <div className="title truncate text-[17px] leading-tight" data-ride-title>
              {title}
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-on-strong/20" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full origin-left rounded-full bg-signal" style={{ transform: `scaleX(${started ? 1 : 0})`, transition: `transform ${String(RIDE_MS - 30)}ms linear` }} data-ride-progress />
            </div>
          </div>
          <button type="button" onClick={end} className="chip press h-9 shrink-0 px-3 text-[13px] font-bold" data-ride-skip>
            {mapWords("map.ride.skip")}
          </button>
        </div>
      </div>
    </div>
  );
}
