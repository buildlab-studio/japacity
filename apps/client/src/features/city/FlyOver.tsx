// The fly-over map (docs/design/11-the-world-first.md, rules 5, 6, 7 and 10): the city as a small
// diorama seen from above, one country at a time, with a pin for every place the player has been,
// can go to, or cannot enter yet, and a house for home. A tap on a pin or its name opens the place's
// card; "Go there" dives the camera down to it and the place opens. The diorama is drawn only where
// WebGL exists; without it the pins are a plain list, so the map still works and so can be tested.
import { ChevronDown, Lock, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BoxGeometry, Color, ConeGeometry, DirectionalLight, Fog, Group, HemisphereLight, InstancedMesh, Matrix4, Mesh, MeshLambertMaterial, Object3D, PerspectiveCamera, PlaneGeometry, Raycaster, Scene, Vector2, Vector3, WebGLRenderer } from "three";

import { content } from "@japacity/content";

import { Button } from "../../shared/ui/Button";
import { cityWords } from "./city.words";

/**
 * The fly-over stays, switched off, behind `tuning.city.flyover`: the map feature's city as the map
 * (R-WORLD-015) takes its place.
 */
// tuning.city has no `flyover` reading yet; it reads as off until someone adds it to the tuning.
export function flyoverOn(): boolean {
  return (content.tuning.city as { flyover?: boolean }).flyover === true;
}

export type PinState = "here" | "home" | "been" | "can" | "not";

export interface Pin {
  id: string;
  name: string;
  state: PinState;
  /** Thousandths of a degree, as content keeps them. */
  position: { latE3: number; lonE3: number };
  /** How many things there are to do there. */
  things: number;
}

export interface CountryChoice {
  id: string;
  name: string;
  /** Why the player cannot switch to it, in words, or null when they can. */
  locked: string | null;
}

export interface FlyOverProps {
  pins: readonly Pin[];
  /** The country shown, and the others the player may or may not switch to. */
  country: CountryChoice;
  countries: readonly CountryChoice[];
  drawing: boolean;
  /** A ride already chosen: the map opens and dives to this place by itself (rule 13). */
  diveTo?: string | null;
  onGo: (id: string) => void;
  onClose: () => void;
}

/** One unit is twenty metres, so a city of ten kilometres is five hundred units across. */
const UNIT_M = 20;
const METRES_PER_LAT_E3 = 111.32;
const PIN_COLOURS: Record<PinState, number> = { here: 0xffd166, home: 0xff7b54, been: 0xffd166, can: 0x5ad18a, not: 0x8a8f99 };
const BUILDINGS = 1400;
const SPREAD = 420;
const DIVE_MS = 1600;

function toXZ(position: { latE3: number; lonE3: number }, centre: { latE3: number; lonE3: number }): [number, number] {
  const cos = Math.cos((centre.latE3 / 1000) * (Math.PI / 180));
  return [((position.lonE3 - centre.lonE3) * METRES_PER_LAT_E3 * cos) / UNIT_M, (-(position.latE3 - centre.latE3) * METRES_PER_LAT_E3) / UNIT_M];
}

/** A plain deterministic sequence, so the skyline is the same every time the map opens. */
function sequence(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

interface Diorama {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  pins: { object: Object3D; pin: Pin; at: [number, number] }[];
  centre: [number, number];
  stop: () => void;
  /** Where the camera looks and stands, moved by dragging and pinching. */
  target: Vector3;
  orbit: { yaw: number; pitch: number; distance: number };
}

function buildDiorama(canvas: HTMLCanvasElement, pins: readonly Pin[], centreOn: Pin | undefined): Diorama {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new Scene();
  scene.background = new Color(0xdbe9f4);
  scene.fog = new Fog(0xdbe9f4, 500, 1100);
  const camera = new PerspectiveCamera(42, 1, 1, 2000);
  scene.add(new HemisphereLight(0xf4f8ff, 0xb9a98a, 1.1));
  const sun = new DirectionalLight(0xfff0d0, 1.6);
  sun.position.set(-200, 300, 150);
  scene.add(sun);

  const centre = centreOn?.position ?? pins[0]?.position ?? { latE3: 0, lonE3: 0 };
  const ground = new Mesh(new PlaneGeometry(SPREAD * 2.6, SPREAD * 2.6), new MeshLambertMaterial({ color: 0xc9bb9c }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // The skyline: low boxes scattered round the centre, denser near it, so the pins stand in a city.
  const next = sequence(7);
  const boxes = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshLambertMaterial({ color: 0x9d9683 }), BUILDINGS);
  const place = new Matrix4();
  const holder = new Object3D();
  for (let index = 0; index < BUILDINGS; index += 1) {
    const angle = next() * Math.PI * 2;
    const radius = Math.pow(next(), 0.7) * SPREAD;
    const height = 2 + next() * 6;
    holder.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
    holder.scale.set(4 + next() * 6, height, 4 + next() * 6);
    holder.rotation.y = next() * Math.PI;
    holder.updateMatrix();
    place.copy(holder.matrix);
    boxes.setMatrixAt(index, place);
  }
  scene.add(boxes);

  const pinGeometry = new ConeGeometry(3, 8, 10);
  const placed = pins.map((pin) => {
    const at = toXZ(pin.position, centre);
    const object = new Group();
    if (pin.state === "home") {
      const walls = new Mesh(new BoxGeometry(7, 5, 7), new MeshLambertMaterial({ color: PIN_COLOURS.home }));
      walls.position.y = 2.5;
      const roof = new Mesh(new ConeGeometry(6, 4, 4), new MeshLambertMaterial({ color: 0xb3412a }));
      roof.position.y = 7;
      roof.rotation.y = Math.PI / 4;
      object.add(walls, roof);
    } else {
      const cone = new Mesh(pinGeometry, new MeshLambertMaterial({ color: PIN_COLOURS[pin.state] }));
      cone.rotation.x = Math.PI;
      cone.position.y = 8;
      object.add(cone);
    }
    object.position.set(at[0], 0, at[1]);
    object.userData = { pin: pin.id };
    scene.add(object);
    return { object, pin, at };
  });

  const here = placed.find((entry) => entry.pin.state === "here") ?? placed[0];
  const target = new Vector3(here?.at[0] ?? 0, 0, here?.at[1] ?? 0);
  const orbit = { yaw: -0.4, pitch: 0.95, distance: 330 };
  let alive = true;
  const stop = (): void => {
    alive = false;
    renderer.dispose();
  };
  void alive;
  return { renderer, scene, camera, pins: placed, centre: [target.x, target.z], stop, target, orbit };
}

function aim(diorama: Diorama): void {
  const { camera, target, orbit } = diorama;
  camera.position.set(
    target.x + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.distance,
    Math.sin(orbit.pitch) * orbit.distance + 2,
    target.z + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.distance,
  );
  camera.lookAt(target.x, 2, target.z);
}

function tagWords(state: PinState): string {
  switch (state) {
    case "here":
      return cityWords("city.here");
    case "home":
      return cityWords("city.map.home");
    case "been":
      return cityWords("city.map.been");
    case "can":
      return cityWords("city.map.can");
    case "not":
      return cityWords("city.map.not");
    default: {
      const never: never = state;
      throw new Error(`Unknown pin state: ${String(never)}`);
    }
  }
}

function lineWords(pin: Pin): string {
  if (pin.state === "here") return cityWords("city.map.line.here", { things: pin.things });
  if (pin.state === "not") return cityWords("city.map.line.not");
  return cityWords("city.map.line.things", { things: pin.things });
}

export function FlyOver({ pins, country, countries, drawing, diveTo = null, onGo, onClose }: FlyOverProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const diorama = useRef<Diorama | null>(null);
  const [card, setCard] = useState<Pin | null>(null);
  const [menu, setMenu] = useState(false);
  const [diving, setDiving] = useState(false);
  const dive = useRef<{ from: Vector3; fromTarget: Vector3; to: Vector3; toTarget: Vector3; started: number; id: string } | null>(null);

  useEffect(() => {
    if (!drawing || canvas.current === null || labels.current === null) return;
    const here = pins.find((pin) => pin.state === "here");
    const built = buildDiorama(canvas.current, pins, here);
    diorama.current = built;
    const labelBox = labels.current;
    const marks = built.pins.map((entry) => {
      const mark = document.createElement("button");
      mark.type = "button";
      mark.textContent = entry.pin.name;
      mark.dataset.pin = entry.pin.id;
      mark.className = `pointer-events-auto absolute -translate-x-1/2 -translate-y-full rounded-md px-2 py-1 text-xs font-bold whitespace-nowrap shadow ${pinClass(entry.pin.state)}`;
      mark.onclick = () => setCard(entry.pin);
      labelBox.append(mark);
      return { mark, entry };
    });

    const resize = (): void => {
      const { clientWidth, clientHeight } = canvas.current ?? { clientWidth: 1, clientHeight: 1 };
      built.renderer.setSize(clientWidth, clientHeight, false);
      built.camera.aspect = clientWidth / Math.max(1, clientHeight);
      built.camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    // Dragging turns and slides the view; a pinch or the wheel zooms. Taps pick a pin.
    let down: { x: number; y: number; moved: boolean } | null = null;
    let pinchStart: number | null = null;
    const pointers = new Map<number, { x: number; y: number }>();
    const element = canvas.current;
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
        if (pinchStart !== null) built.orbit.distance = Math.min(700, Math.max(60, built.orbit.distance * (pinchStart / Math.max(1, gap))));
        pinchStart = gap;
        down.moved = true;
        return;
      }
      const dx = event.clientX - before.x;
      const dy = event.clientY - before.y;
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 6) down.moved = true;
      // A drag slides the city under the finger; the view keeps its angle, as a map does.
      const scale = built.orbit.distance / 500;
      const yaw = built.orbit.yaw;
      built.target.x -= (dx * Math.cos(yaw) - dy * Math.sin(yaw)) * scale;
      built.target.z -= (-dx * Math.sin(yaw) - dy * Math.cos(yaw)) * scale;
    };
    const pointerUp = (event: PointerEvent): void => {
      pointers.delete(event.pointerId);
      if (pointers.size < 2) pinchStart = null;
      if (down === null) return;
      const tap = !down.moved;
      down = null;
      if (!tap) return;
      const pointer = new Vector2((event.clientX / element.clientWidth) * 2 - 1, -(event.clientY / element.clientHeight) * 2 + 1);
      const ray = new Raycaster();
      ray.setFromCamera(pointer, built.camera);
      const hit = ray.intersectObjects(
        built.pins.map((entry) => entry.object),
        true,
      )[0];
      if (hit === undefined) {
        setCard(null);
        return;
      }
      let at: Object3D | null = hit.object;
      while (at !== null && typeof (at.userData as { pin?: unknown }).pin !== "string") at = at.parent;
      const id = at === null ? null : (at.userData as { pin: string }).pin;
      const picked = built.pins.find((entry) => entry.pin.id === id);
      if (picked !== undefined) setCard(picked.pin);
    };
    const wheel = (event: WheelEvent): void => {
      event.preventDefault();
      built.orbit.distance = Math.min(700, Math.max(60, built.orbit.distance * (1 + event.deltaY * 0.0015)));
    };
    element.addEventListener("pointerdown", pointerDown);
    element.addEventListener("pointermove", pointerMove);
    element.addEventListener("pointerup", pointerUp);
    element.addEventListener("pointercancel", pointerUp);
    element.addEventListener("wheel", wheel, { passive: false });

    const project = new Vector3();
    let frame = 0;
    let settled = 0;
    const loop = (now: number): void => {
      frame = requestAnimationFrame(loop);
      const started = settled === 0 ? (settled = now) : settled;
      const flyIn = Math.min(1, (now - started) / 2200);
      const eased = 1 - Math.pow(1 - flyIn, 3);
      const current = dive.current;
      if (current !== null) {
        const share = Math.min(1, (now - current.started) / DIVE_MS);
        const ease = 1 - Math.pow(1 - share, 3);
        built.camera.position.lerpVectors(current.from, current.to, ease);
        const look = new Vector3().lerpVectors(current.fromTarget, current.toTarget, ease);
        built.camera.lookAt(look);
        if (share >= 1) {
          dive.current = null;
          onGo(current.id);
        }
      } else {
        const orbit = built.orbit;
        const stand = { ...orbit, distance: orbit.distance * (1.35 - 0.35 * eased), pitch: orbit.pitch * (0.8 + 0.2 * eased) };
        aim({ ...built, orbit: stand });
      }
      for (const { mark, entry } of marks) {
        project.set(entry.at[0], 10, entry.at[1]).project(built.camera);
        const visible = project.z < 1 && Math.abs(project.x) < 1.05 && Math.abs(project.y) < 1.05 && dive.current === null;
        mark.style.display = visible ? "" : "none";
        if (visible) {
          mark.style.left = `${String(((project.x + 1) / 2) * element.clientWidth)}px`;
          mark.style.top = `${String(((1 - project.y) / 2) * element.clientHeight - 6)}px`;
        }
      }
      built.renderer.render(built.scene, built.camera);
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
      for (const { mark } of marks) mark.remove();
      built.stop();
      diorama.current = null;
    };
    // The diorama is built once for the pins given; the callbacks are the screen's and may change freely.
  }, [drawing, pins]);

  const go = (pin: Pin): void => {
    setCard(null);
    const built = diorama.current;
    const entry = built?.pins.find((placed) => placed.pin.id === pin.id);
    if (built === null || entry === undefined) {
      onGo(pin.id);
      return;
    }
    setDiving(true);
    dive.current = {
      from: built.camera.position.clone(),
      fromTarget: built.target.clone().setY(2),
      to: new Vector3(entry.at[0] + 14, 9, entry.at[1] + 18),
      toTarget: new Vector3(entry.at[0], 2, entry.at[1]),
      started: performance.now(),
      id: pin.id,
    };
  };
  // A ride chosen in the place: the map shows the way, then dives (rule 13).
  useEffect(() => {
    if (diveTo === null) return;
    const pin = pins.find((candidate) => candidate.id === diveTo);
    if (pin === undefined) return;
    const timer = window.setTimeout(() => go(pin), drawing ? 1100 : 0);
    return () => window.clearTimeout(timer);
    // The ride starts once for the place chosen; `go` reads the diorama at that moment.
  }, [diveTo, pins, drawing]);

  const canGo = card !== null && card.state !== "not" && card.state !== "here";

  return (
    <div className="fixed inset-0 z-[40] bg-[#dbe9f4] text-ink" data-flyover data-diving={diving}>
      {drawing ? <canvas ref={canvas} className="size-full touch-none" aria-hidden /> : null}
      <div ref={labels} className="pointer-events-none absolute inset-0" />

      {drawing ? null : (
        <ul className="absolute inset-x-3 top-28 flex flex-col gap-1" aria-label={cityWords("city.places")}>
          {pins.map((pin) => (
            <li key={pin.id}>
              <button type="button" data-pin={pin.id} onClick={() => setCard(pin)} className={`w-full rounded-md px-3 py-2 text-left text-sm font-semibold ${pinClass(pin.state)}`}>
                {pin.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto relative" data-country-menu>
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={menu}
            onClick={() => setMenu((open) => !open)}
            className="inline-flex min-h-9 items-center gap-1 rounded-md bg-ink px-3 text-sm font-bold text-accent shadow"
          >
            {country.name}
            <ChevronDown size={14} />
          </button>
          {menu ? (
            <ul role="listbox" aria-label={cityWords("city.map.country")} className="absolute top-full left-0 mt-1 flex min-w-64 flex-col gap-1 rounded-md bg-sheet-2 p-1.5 shadow-lg">
              {countries.map((choice) => (
                <li
                  key={choice.id}
                  role="option"
                  aria-selected={choice.id === country.id}
                  aria-disabled={choice.locked !== null}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold ${choice.id === country.id ? "bg-accent/30" : ""} ${choice.locked === null ? "" : "text-text-2"}`}
                >
                  {choice.locked === null ? null : <Lock size={12} />}
                  <span className="whitespace-nowrap">{choice.name}</span>
                  <span className="ml-auto text-xs font-medium whitespace-nowrap text-text-2">{choice.id === country.id ? cityWords("city.here") : (choice.locked ?? "")}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <button type="button" onClick={onClose} aria-label={cityWords("city.close")} className="pointer-events-auto inline-flex size-10 items-center justify-center rounded-md bg-sheet/90 shadow">
          <X size={18} />
        </button>
      </div>

      {card === null ? (
        <p className="pointer-events-none absolute inset-x-0 bottom-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-xs text-text-2">{cityWords("city.map.hint")}</p>
      ) : (
        <div role="dialog" aria-label={card.name} data-map-card className="absolute inset-x-0 bottom-0 flex flex-col gap-3 rounded-t-md bg-strong p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-on-strong shadow-2xl">
          <div className="flex items-center gap-2">
            <span className={`rounded-[4px] px-2.5 py-0.5 text-xs font-bold ${pinClass(card.state)}`}>{tagWords(card.state)}</span>
            <h2 className="font-display text-xl leading-tight">{card.name}</h2>
          </div>
          <p className="text-sm opacity-90">{lineWords(card)}</p>
          <div className="flex gap-2">
            <Button onClick={() => setCard(null)} className="flex-1 border-on-strong/30 text-on-strong">
              {cityWords("city.map.not-now")}
            </Button>
            <Button variant="primary" disabled={!canGo} onClick={() => go(card)} className="flex-1">
              {card.state === "here" ? cityWords("city.here") : card.state === "home" ? cityWords("city.map.go-home") : card.state === "not" ? cityWords("city.map.locked") : cityWords("city.map.go")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function pinClass(state: PinState): string {
  switch (state) {
    case "here":
    case "been":
      return "bg-[#ffd166] text-[#1b1500]";
    case "home":
      return "bg-[#ff7b54] text-white";
    case "can":
      return "bg-[#bff0d0] text-[#0f2a1a]";
    case "not":
      return "bg-[#dcdee4] text-[#555]";
    default: {
      const never: never = state;
      throw new Error(`Unknown pin state: ${String(never)}`);
    }
  }
}
