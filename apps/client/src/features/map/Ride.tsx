// The ride (docs/rules/world.md R-WORLD-017): about six seconds under a band with "Danfo to
// <place>", its progress, and Skip. By danfo, keke or okada it opens on a short pre-roll close to
// the vehicle with the rider's, driver's or conductor's line as a chip, then the street from above
// (rideScene.ts). Skip ends it all at once. When it ends the place opens. The same ride plays from
// the map and from a danfo, keke or okada standing in a place.
import { useEffect, useRef, useState } from "react";

import { graphicsMode } from "../../shared/graphics/mode";
import { loadModel } from "../../shared/three/load";
import { loadManifest } from "../../shared/three/manifest";
import { mountCanvas } from "../../shared/three/sharedRenderer";
import { mapWords } from "./map.words";
import { buildRide, figuresOn, peopleOf, type Phase, preMsOf, RIDE_MS, type RideScene, type Role, type Way } from "./rideScene";

export { PRE_MS, RIDE_MS } from "./rideScene";

/** The look the city falls back to when the life's own person is not shipped (City.tsx). */
export const FALLBACK_OWN = "shared/chr/chr_tunde.glb";

/** Lines each speaker may say in the pre-roll, picked by the ride's seed (map.words.ts). */
export const LINES = 6;

/** What the browser test and the shooter read while a ride plays. */
export interface RideProbe {
  way: Way;
  phase: Phase;
  /** The key of the line in the chip, or null when none shows. */
  line: string | null;
  /** The figure groups on the vehicle now, by role (each counted from the start, before its model arrives). */
  figures: Role[];
  /** How many of those have their person's model in. */
  loaded: number;
  preMs: number;
  /** The renderer's own count of the last frame. */
  drawCalls: number;
  triangles: number;
  /** Milliseconds between frames, the last ones drawn, by phase. */
  frameMs: Record<Phase, number[]>;
}

declare global {
  interface Window {
    __ride?: RideProbe;
  }
}

export interface RideProps {
  way: Way;
  /** The place's name, as the band says it. */
  place: string;
  drawing: boolean;
  /** The character's own person file, as the city shows them. */
  own?: string;
  /** Picks the line in the pre-roll, so the same ride says the same thing. */
  seed?: number;
  /** The ride is over, played out or skipped. Called once. */
  onDone: () => void;
}

/** The key of the line said in a way's pre-roll: the okada's rider, the keke's driver, the danfo's conductor; none on foot. */
export function lineOf(way: Way, seed: number): string | null {
  if (way === "walk") return null;
  return `map.ride.line.${way}.${String((Math.abs(Math.trunc(seed)) % LINES) + 1)}`;
}

/** Fetches the people and vehicle a ride may show, so its pre-roll does not open on an empty seat. */
export function preloadRide(own: string): void {
  void loadManifest()
    .then((manifest) => {
      const files = new Set<string>();
      for (const way of ["danfo", "keke", "okada"] as const) {
        files.add(`shared/veh/veh_${way}.glb`);
        for (const file of Object.values(peopleOf(way, own))) files.add(file);
      }
      for (const file of files) void loadModel(manifest, file, () => undefined).catch(() => undefined);
    })
    .catch(() => undefined);
}

const FRAMES_KEPT = 240;

export function Ride({ way, place, drawing, own = FALLBACK_OWN, seed = 0, onDone }: RideProps) {
  const box = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const [started, setStarted] = useState(false);
  const pre = preMsOf(way);
  const [phase, setPhase] = useState<Phase>(pre > 0 ? "pre" : "ride");
  const finish = useRef(onDone);
  finish.current = onDone;
  const end = (): void => {
    if (done.current) return;
    done.current = true;
    finish.current();
  };
  const line = phase === "pre" ? lineOf(way, seed) : null;

  // The ride ends by itself after its time; Skip ends it at once. The pre-roll gives way to the street.
  useEffect(() => {
    const timer = window.setTimeout(end, RIDE_MS);
    const start = window.setTimeout(() => setStarted(true), 30);
    const cut = pre > 0 ? window.setTimeout(() => setPhase("ride"), pre) : 0;
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(start);
      window.clearTimeout(cut);
    };
  }, []);

  // The scene is built whether or not it draws, so the probe can say who is on the vehicle.
  const [ride, setRide] = useState<RideScene | null>(null);
  const probe = useRef<RideProbe>({ way, phase, line, figures: [], loaded: 0, preMs: pre, drawCalls: 0, triangles: 0, frameMs: { pre: [], ride: [] } });
  useEffect(() => {
    const built = buildRide(way);
    setRide(built);
    const held = probe.current;
    window.__ride = held;
    return () => {
      if (window.__ride === held) delete window.__ride;
      built.dispose();
    };
  }, [way]);
  useEffect(() => {
    if (ride === null) return;
    ride.setPhase(phase);
    Object.assign(probe.current, { phase, line, figures: figuresOn(ride) });
  }, [phase, line, ride]);

  useEffect(() => {
    if (!drawing || box.current === null || ride === null) return;
    const { canvas: element, renderer, unmount } = mountCanvas("ride", box.current, "size-full");
    // Phones first: the low mode draws at one pixel to the pixel and casts no shadows.
    renderer.setPixelRatio(graphicsMode() === "low" ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = false;
    let alive = true;
    // The real vehicle and people replace their stand-ins as they load; all are shared and kept loaded.
    void loadManifest()
      .then((manifest) => {
        if (way !== "walk") {
          void loadModel(manifest, `shared/veh/veh_${way}.glb`, () => undefined)
            .then((model) => {
              if (!alive) return;
              ride.setVehicle(model.clone());
            })
            .catch(() => undefined);
        }
        for (const [role, file] of Object.entries(peopleOf(way, own)) as [Role, string][]) {
          void loadModel(manifest, file, () => undefined)
            .then((model) => {
              if (!alive) return;
              ride.setPerson(role, model);
              probe.current.loaded = ride.seats.filter((seat) => seat.figure !== null).length;
            })
            .catch(() => undefined);
        }
      })
      .catch(() => undefined);
    const resize = (): void => {
      renderer.setSize(element.clientWidth, element.clientHeight, false);
    };
    resize();
    window.addEventListener("resize", resize);
    const began = performance.now();
    let last: number | null = null;
    let frame = 0;
    const loop = (now: number): void => {
      frame = requestAnimationFrame(loop);
      const elapsed = Math.max(0, now - began);
      ride.frame(elapsed, element.clientWidth / Math.max(1, element.clientHeight));
      renderer.render(ride.scene, ride.camera);
      const held = probe.current;
      held.drawCalls = renderer.info.render.calls;
      held.triangles = renderer.info.render.triangles;
      const kept = held.frameMs[elapsed < pre ? "pre" : "ride"];
      if (last !== null) kept.push(now - last);
      if (kept.length > FRAMES_KEPT) kept.shift();
      last = now;
    };
    frame = requestAnimationFrame(loop);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      unmount();
    };
  }, [drawing, way, own, ride, pre]);

  const title = mapWords("map.ride.to", { way: mapWords(`map.way.${way}`), place });
  return (
    <div className="fade fixed inset-0 z-[46] bg-strong" data-ride={way} data-ride-phase={phase} aria-live="polite">
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
      {line === null ? null : (
        <p className="chip fade pointer-events-none absolute inset-x-6 bottom-[max(28px,env(safe-area-inset-bottom))] mx-auto w-fit max-w-[calc(100%-48px)] px-3.5 py-2.5 text-center text-[15px] leading-snug font-semibold" data-ride-line={line}>
          {mapWords(line)}
        </p>
      )}
    </div>
  );
}
