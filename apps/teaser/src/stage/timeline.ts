// A scene's script as a timeline: each tap lands at a set moment of the scene, so the sound laid under it in the
// composition falls on the same frame on every render (the page's clock is the kit's virtual clock there).
import { type Act, clock } from "./kit";
import type { Shape } from "./host";

/** A sound under a scene, at a moment of it in milliseconds, from public/sound. */
export interface Cue {
  readonly at: number;
  readonly sound: string;
  readonly volume: number;
}

/** A scene as the composition lays it: how long it runs and the sounds under it. */
export interface Timing {
  readonly length: number;
  readonly cues: readonly Cue[];
}

/** The finger shows just before it presses on a phone; a laptop's arrow presses as it arrives. */
const LEAD = { tall: 400 + 140, wide: 400 } as const;

/** The stage's clock now, in milliseconds: a script takes it as its start. */
export function now(): number {
  return clock.now();
}

/** The scene's own clock: milliseconds since its script began. */
export function since(start: number): number {
  return clock.now() - start;
}

/** Waits until a moment of the scene. */
export async function until<S>(a: Act<S>, start: number, at: number): Promise<void> {
  const left = at - since(start);
  if (left > 0) await a.wait(left);
}

/** Goes to a target and presses it so the press lands at `at`, the moment its sound is laid on. */
export async function tapAt<S>(a: Act<S>, shape: Shape, start: number, target: string, at: number): Promise<void> {
  await until(a, start, at - LEAD[shape]);
  await a.move(target, { duration: 400 });
  await a.click();
  // A laptop's arrow leaves what it pressed for the open world beside the column, so it never sits on the words.
  if (shape === "wide" && a.layout === "wide") void a.move(ASIDE, { duration: 500 });
}

/** Where the laptop's arrow rests between presses: the world to the right of the game's column. */
const ASIDE = { x: 1030, y: 420 } as const;
