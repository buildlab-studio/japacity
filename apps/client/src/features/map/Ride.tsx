// The ride (docs/rules/world.md R-WORLD-017, R-WORLD-032). The angles and their cuts are rideScene.ts's;
// the rider's, driver's or conductor's line shows as a chip.
import { useEffect, useRef, useState } from "react";

import { keptLookFile, keptStyleOf } from "../../authority/person";
import { graphicsMode } from "../../shared/graphics/mode";
import { loadModel } from "../../shared/three/load";
import { loadManifest, type PublishManifest } from "../../shared/three/manifest";
import { mountCanvas, sharedRenderer } from "../../shared/three/sharedRenderer";
import { mapWords } from "./map.words";
import { type Angle, angleAt, anglesOf, buildRide, darkAt, figuresOn, LONG_WALK_MS, peopleOf, type Phase, preMsOf, RIDE_MS, type RideScene, type Role, stepClock, type Way } from "./rideScene";

export { LONG_WALK_MS, PRE_MS, RIDE_MS } from "./rideScene";

/** How long past its own length the ride may run by the wall clock before it ends anyway (R-WORLD-032): a stall of up to three seconds is forgiven, so a slow device never holds the player much longer than the ride. */
export const RIDE_SLACK_MS = 3500;

/** The look the city falls back to when the life's own person is not shipped (City.tsx). */
export const FALLBACK_OWN = "shared/chr/chr_tunde.glb";

/** The life's own person file as the city names it (City.tsx): the look built at the front door (R-PROLOGUE-009), else the life's person, shipped or not; `shownOwn` settles it. */
export function ownLook(scenario: string, kept: string | null = keptLookFile()): string {
  return kept ?? `shared/chr/chr_${scenario.slice("scenario.".length)}.glb`;
}

/** The character the ride shows: the life's own person where it is shipped, else the city's fallback. */
function shownOwn(manifest: PublishManifest, own: string): string {
  return manifest.files[own] === undefined ? FALLBACK_OWN : own;
}

/** Lines each speaker may say in the pre-roll, picked by the ride's seed (map.words.ts). */
export const LINES = 6;

/** What the browser test and the shooter read while a ride plays. */
export interface RideProbe {
  way: Way;
  phase: Phase;
  /** The angle on screen now (R-WORLD-032). */
  angle: Angle;
  /** Every angle shown so far, in order, each once as it came. */
  angles: Angle[];
  /** The ride's own clock, in milliseconds. */
  clock: number;
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
  /** The place the ride left, as the band says it; the card says where you are as the ride goes. */
  from?: string;
  /** Turn back: the character gets down at the next stop and walks back, the fare gone. Called once, instead of `onDone`. */
  onTurnBack?: () => void;
  /** A walk home past the walking limit: it plays for `LONG_WALK_MS` and has no Skip (R-WORLD-017). */
  long?: boolean;
}

/** How many road lines the card may say in the middle of a ride (map.words.ts). */
export const ROAD_LINES = 3;

/** The road lines that name a person, said for each way in its own words: the okada's rider, the keke's and the danfo's driver, your own feet. */
const PERSON_LINES: ReadonlySet<number> = new Set([3]);

/**
 * Where you are as the ride goes (the design): pulling out of the place left for the
 * first third, a road line through the middle, the stop named near the end. `u` is the ride's progress
 * after the pre-roll, 0 to 1. A road line that names a person is the way's own.
 */
export function alongOf(u: number, seed: number, way: Way): { key: string; needs: "from" | "to" | null } {
  if (u < 0.34) return { key: "map.ride.along.start", needs: "from" };
  const road = (Math.abs(Math.trunc(seed)) % ROAD_LINES) + 1;
  if (u < 0.78) return { key: PERSON_LINES.has(road) ? `map.ride.along.road.${String(road)}.${way}` : `map.ride.along.road.${String(road)}`, needs: null };
  return { key: "map.ride.along.near", needs: "to" };
}

/** Where nothing draws, the ride's clock steps on a timer this often instead of on each frame. */
const TICK_MS = 50;

/** The key of the line said in a way's pre-roll: the okada's rider, the keke's driver, the danfo's conductor; none on foot. */
export function lineOf(way: Way, seed: number): string | null {
  if (way === "walk") return null;
  return `map.ride.line.${way}.${String((Math.abs(Math.trunc(seed)) % LINES) + 1)}`;
}

/** The ways whose shaders the ride's renderer has compiled this session, by the character shown. */
const warmed = new Set<string>();

/**
 * Fetches the people and vehicle each way may show and compiles their shaders on the ride's renderer
 * while the map is open, so the pre-roll's first frame does not stall on them (a phone compiles
 * slowly, and the pre-roll is short).
 */
export function preloadRide(own: string): void {
  void loadManifest()
    .then(async (manifest) => {
      const shown = shownOwn(manifest, own);
      for (const way of ["okada", "keke", "danfo"] as const) {
        const key = `${way}:${shown}`;
        if (warmed.has(key)) continue;
        warmed.add(key);
        try {
          const people = Object.entries(peopleOf(way, shown)) as [Role, string][];
          const [vehicle, ...persons] = await Promise.all([loadModel(manifest, `shared/veh/veh_${way}.glb`, () => undefined), ...people.map(([, file]) => loadModel(manifest, file, () => undefined))]);
          const ride = buildRide(way);
          ride.setVehicle(vehicle.clone());
          people.forEach(([role], index) => {
            const model = persons[index];
            if (model !== undefined) ride.setPerson(role, model);
          });
          const { renderer } = sharedRenderer("ride");
          for (const part of anglesOf(way)) {
            ride.frame(part.from, 0.46);
            await renderer.compileAsync(ride.scene, ride.camera);
          }
          ride.dispose();
        } catch {
          warmed.delete(key);
        }
      }
    })
    .catch(() => undefined);
}

const FRAMES_KEPT = 240;

export function Ride({ way, place, drawing, own = FALLBACK_OWN, seed = 0, onDone, from, onTurnBack, long = false }: RideProps) {
  const box = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const dark = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const pre = preMsOf(way);
  // The long walk home runs longer than any ride and cannot be skipped; every other ride is about six seconds.
  const length = long ? LONG_WALK_MS : RIDE_MS;
  // A slow device (frames under ten a second) runs the ride's clock behind the wall clock; the ride still ends within its slack.
  const startedAt = useRef(Date.now());
  // The ride's own clock: the scene, the angle, the card's line, the bar and the end all read it.
  const clock = useRef(0);
  const [angle, setAngle] = useState<Angle>(() => angleAt(way, 0));
  const phase: Phase = angle === "outside" ? "pre" : "ride";
  const finish = useRef(onDone);
  finish.current = onDone;
  const end = (): void => {
    if (done.current) return;
    done.current = true;
    finish.current();
  };
  const back = useRef(onTurnBack);
  back.current = onTurnBack;
  const turnBack = (): void => {
    if (done.current) return;
    done.current = true;
    back.current?.();
  };
  // The card's line follows the ride's own clock, so it matches what is outside.
  const alongAt = (ms: number): ReturnType<typeof alongOf> | null => (ms >= pre && from !== undefined ? alongOf(Math.min(1, Math.max(0, (ms - pre) / (length - pre))), seed, way) : null);
  const [along, setAlong] = useState(() => alongAt(0));
  const line = phase === "pre" ? lineOf(way, seed) : along === null ? null : along.key;
  const lineParams: Record<string, string> = along === null ? {} : along.needs === "from" && from !== undefined ? { from } : along.needs === "to" ? { to: place } : {};

  // What the browser test reads; the scene is built whether or not it draws, so it can say who is on the vehicle.
  const probe = useRef<RideProbe>({ way, phase, angle, angles: [angle], clock: 0, line, figures: [], loaded: 0, preMs: pre, drawCalls: 0, triangles: 0, frameMs: { pre: [], ride: [] } });

  // One step of the ride's clock, clamped so a slow frame never jumps the ride ahead (R-WORLD-032).
  // The angle and the line change only when the clock crosses into another; the bar and the dark follow every step.
  const shownAngle = useRef(angle);
  const shownAlong = useRef(along?.key ?? null);
  const step = useRef<(dt: number) => void>(() => undefined);
  step.current = (dt: number): void => {
    if (done.current) return;
    const ms = stepClock(clock.current, dt, length);
    clock.current = ms;
    const held = probe.current;
    held.clock = ms;
    const next = angleAt(way, ms);
    if (next !== shownAngle.current) {
      shownAngle.current = next;
      held.angles.push(next);
      setAngle(next);
    }
    const nextAlong = alongAt(ms);
    if ((nextAlong?.key ?? null) !== shownAlong.current) {
      shownAlong.current = nextAlong?.key ?? null;
      setAlong(nextAlong);
    }
    if (bar.current !== null) bar.current.style.transform = `scaleX(${String(ms / length)})`;
    if (dark.current !== null) dark.current.style.opacity = String(darkAt(way, ms));
    // The ride ends by itself when its own clock runs out, or when the wall clock has run past it and its slack; Skip ends it at once.
    if (ms >= length || Date.now() - startedAt.current >= length + RIDE_SLACK_MS) end();
  };

  // Where nothing draws, a timer steps the clock; where the scene draws, each frame does.
  useEffect(() => {
    if (drawing) return;
    let last = Date.now();
    const tick = window.setInterval(() => {
      const now = Date.now();
      step.current(now - last);
      last = now;
    }, TICK_MS);
    return () => {
      window.clearInterval(tick);
    };
  }, [drawing]);

  const [ride, setRide] = useState<RideScene | null>(null);
  useEffect(() => {
    const built = buildRide(way, length);
    setRide(built);
    const held = probe.current;
    window.__ride = held;
    return () => {
      if (window.__ride === held) delete window.__ride;
      built.dispose();
    };
  }, [way, length]);
  useEffect(() => {
    if (ride === null) return;
    ride.setAngle(angle);
    Object.assign(probe.current, { phase, angle, line, figures: figuresOn(ride) });
  }, [phase, angle, line, ride]);

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
        for (const [role, file] of Object.entries(peopleOf(way, shownOwn(manifest, own))) as [Role, string][]) {
          void loadModel(manifest, file, () => undefined)
            .then((model) => {
              if (!alive) return;
              ride.setPerson(role, model, role === "own" ? keptStyleOf(file) : undefined);
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
    let last: number | null = null;
    let frame = 0;
    const loop = (now: number): void => {
      frame = requestAnimationFrame(loop);
      step.current(last === null ? 0 : now - last);
      const elapsed = clock.current;
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
    <div className="fade fixed inset-0 z-[46] bg-strong" data-ride={way} data-ride-phase={phase} data-ride-angle={angle} aria-live="polite">
      {drawing ? <div ref={box} className="size-full" aria-hidden /> : null}
      {/* The cut between angles: a short dark over the scene, never a slide (R-WORLD-013, R-WORLD-032). */}
      {drawing ? <div ref={dark} className="pointer-events-none absolute inset-0 bg-device opacity-0" aria-hidden data-ride-dark /> : null}
      <div className="pointer-events-none absolute inset-x-0 top-0 px-3 pt-[max(10px,env(safe-area-inset-top))]">
        <div className="band pointer-events-auto flex items-center gap-3 rounded-[6px] px-3 py-2.5 shadow-[0_10px_24px_rgba(10,14,30,0.35)]">
          <div className="min-w-0 flex-1">
            {/* The title wraps to a second line rather than cut the place's name. */}
            <div className="title line-clamp-2 text-[16px] leading-tight [overflow-wrap:anywhere]" data-ride-title>
              {title}
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-[2px] bg-on-strong/20" role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100}>
              <div ref={bar} className="h-full origin-left rounded-[2px] bg-signal" style={{ transform: "scaleX(0)" }} data-ride-progress />
            </div>
          </div>
          {onTurnBack === undefined ? null : (
            <button type="button" onClick={turnBack} className="chip press h-9 shrink-0 px-3 text-[13px] font-bold" data-ride-turn-back>
              {mapWords("map.ride.turn-back")}
            </button>
          )}
          {long ? null : (
            <button type="button" onClick={end} className="chip press h-9 shrink-0 px-3 text-[13px] font-bold" data-ride-skip>
              {mapWords("map.ride.skip")}
            </button>
          )}
        </div>
      </div>
      {line === null ? null : (
        <p className="chip fade pointer-events-none absolute inset-x-6 bottom-[max(28px,env(safe-area-inset-bottom))] mx-auto w-fit max-w-[calc(100%-48px)] px-3.5 py-2.5 text-center text-[15px] leading-snug font-semibold" data-ride-line={line}>
          {mapWords(line, lineParams)}
        </p>
      )}
    </div>
  );
}
