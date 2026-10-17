// Strolling (city.md R-CITY-036). Spots kept for a role or an act (the trader at
// her stall, the conductor at his door, the crossers) keep their people. The times and the spots come
// from a hash of the place, the slot and the stroll, never from Math.random.
import { hash } from "../crowd";
import type { Spot } from "../placeFile";
import { stepWalk, standAt, type Walker, walkRoute, WALK_SPEED } from "../walk";
import { cellOf, FREE, groundAt, HARD, type Point, type RouteMap } from "./map";
import { findRoute, nearestFree } from "./route";

/** Seconds a person idles at a spot before strolling on, at the least and at the most. */
export const IDLE_MIN = 20;
const IDLE_MAX = 55;
/** Seconds before anyone's first stroll, so a place opens with everyone at their spots and they leave one by one. */
const FIRST_MIN = 5;
export const FIRST_MAX = 40;
/** Radians a second a person turns, on arriving, to look the way their spot looks. */
const TURN_SPEED = 3;

interface Stroller {
  slot: number;
  /** The spot held: stood at, or walked to. */
  spot: number;
  walker: Walker;
  /** The clock's time the person sets off again. */
  leaveAt: number;
  /** Strolls taken, so each draw differs. */
  strolls: number;
}

export interface Strolls {
  seed: string;
  spots: readonly Spot[];
  /** Spots anyone may stroll to. */
  open: readonly number[];
  /** The part of the ground each spot stands on, so no one is sent where they cannot walk. */
  spotPart: Int32Array;
  /** Who holds each spot by its index, standing there or walking to it: a slot, or -1. */
  holder: Int32Array;
  strollers: Stroller[];
  /** The clock's time strolling began, the first frame after the place was built; the first leavings count from it. */
  begun: number | null;
}

/** A share from 0 to 1 drawn for one decision about one person. */
function draw(seed: string, slot: number, strolls: number, what: string): number {
  return (hash(`${seed}|${String(slot)}|${String(strolls)}|${what}`) % 10000) / 10000;
}

function between(low: number, high: number, share: number): number {
  return low + (high - low) * share;
}

/** The part of the ground a point belongs to, through the nearest free cell when it stands beside a thing. */
function partAt(map: RouteMap, point: Point): number {
  const cell = cellOf(map, point.x, point.z);
  if (cell >= 0 && map.cells[cell] === FREE) return map.part[cell] ?? -1;
  const near = nearestFree(map, point);
  return near < 0 ? -1 : (map.part[near] ?? -1);
}

/**
 * Who strolls in a place and where: everyone placed at a spot that is not kept, standing there now.
 * `placed` gives each shown person's slot and the index of their spot; `kept` the spots kept for a
 * role or an act; `seed` the place's id, so the same place walks its people the same way.
 */
export function strollsOf(seed: string, spots: readonly Spot[], placed: readonly { slot: number; index: number }[], kept: ReadonlySet<number>, map: RouteMap): Strolls {
  const spotPart = new Int32Array(spots.length).fill(-1);
  spots.forEach(([x, z], index) => {
    if (groundAt(map, x, z) !== HARD) spotPart[index] = partAt(map, { x, z });
  });
  const open = spots.map((_, index) => index).filter((index) => !kept.has(index) && (spotPart[index] ?? -1) >= 0);
  const openSet = new Set(open);
  const holder = new Int32Array(spots.length).fill(-1);
  for (const { slot, index } of placed) if (index < spots.length) holder[index] = slot;
  const strollers = placed
    .filter(({ index }) => openSet.has(index))
    .map(({ slot, index }): Stroller => {
      const [x, z, facing] = spots[index] ?? [0, 0, 0];
      return { slot, spot: index, walker: standAt(x, z, facing), leaveAt: between(FIRST_MIN, FIRST_MAX, draw(seed, slot, 0, "first")), strolls: 0 };
    });
  return { seed, spots, open, spotPart, holder, strollers, begun: null };
}

/** The turn from one facing toward another, by at most `step` radians the short way round. */
export function turnToward(from: number, to: number, step: number): number {
  const gap = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return Math.abs(gap) <= step ? to : from + Math.sign(gap) * step;
}

/** One person set off toward a free spot of their part of the ground, or left idling a while when there is none. */
function setOff(strolls: Strolls, map: RouteMap, stroller: Stroller, time: number): Stroller {
  const { seed, spots, holder, spotPart } = strolls;
  const count = stroller.strolls + 1;
  const part = partAt(map, stroller.walker);
  const free = strolls.open.filter((index) => index !== stroller.spot && holder[index] === -1 && spotPart[index] === part);
  const idle = (): Stroller => ({ ...stroller, leaveAt: time + between(IDLE_MIN, IDLE_MAX, draw(seed, stroller.slot, count, "idle")), strolls: count });
  if (free.length === 0) return idle();
  const next = free[hash(`${seed}|${String(stroller.slot)}|${String(count)}|spot`) % free.length] ?? -1;
  const [x, z] = spots[next] ?? [stroller.walker.x, stroller.walker.z];
  const route = findRoute(map, stroller.walker, { x, z }, true);
  if (route.length === 0) return idle();
  holder[stroller.spot] = -1;
  holder[next] = stroller.slot;
  return { ...stroller, spot: next, walker: walkRoute(stroller.walker, route), leaveAt: Infinity, strolls: count };
}

/** Everyone's stroll `seconds` further on, at the clock's `time`: setting off, walking, arriving, turning. */
export function advanceStrolls(strolls: Strolls, map: RouteMap, time: number, seconds: number): void {
  if (strolls.begun === null) {
    strolls.begun = time;
    strolls.strollers = strolls.strollers.map((stroller) => ({ ...stroller, leaveAt: stroller.leaveAt + time }));
  }
  strolls.strollers = strolls.strollers.map((stroller) => {
    if (stroller.walker.target !== null) {
      const walker = stepWalk(stroller.walker, seconds, WALK_SPEED);
      if (walker.target !== null) return { ...stroller, walker };
      return { ...stroller, walker, leaveAt: time + between(IDLE_MIN, IDLE_MAX, draw(strolls.seed, stroller.slot, stroller.strolls, "idle")) };
    }
    if (time >= stroller.leaveAt) return setOff(strolls, map, stroller, time);
    const facing = strolls.spots[stroller.spot]?.[2] ?? stroller.walker.facing;
    if (stroller.walker.facing === facing) return stroller;
    return { ...stroller, walker: { ...stroller.walker, facing: turnToward(stroller.walker.facing, facing, TURN_SPEED * seconds) } };
  });
}
