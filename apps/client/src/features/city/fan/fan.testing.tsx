// The tests' stand-in for the scene (R-WORLD-034): a tap on a thing says where the thing stands, as the scene's frame loop
// does, before the city hears the tap, so the fan opens and lays out; the walk is instant, so a fan button's act lands at
// once, as it would on arrival (R-WORLD-010). A test mocks the scene with `StandInScene`, or builds its own from
// `standInTap` and `useStandInWalk`, and presses a fan's button with `pressFanAct`. Only the tests import it.
import { fireEvent, waitFor } from "@testing-library/react";
import { useEffect } from "react";

import type { Act, Thing } from "../../../shared/world/contract";
import { anchorFan } from "./anchor";
import { found } from "../../../shared/testing/render";

/** Where a stand-in's thing stands on the screen: on the left, with room for the fan on its right on a phone and a laptop. */
export const STAND_IN_SPOT = { x: 90, y: 420 } as const;

type StandInPick = { kind: "thing"; thing: Thing } | { kind: "act"; thing: Thing; act: Act } | { kind: "own" } | { kind: "person"; slot: number } | { kind: "model"; file: string; signs: string[] };

/** The stand-in's tap on a thing: the fan hears where it stands, then the city hears the tap. */
export function standInTap(thing: Thing, onPick: (pick: StandInPick) => void): void {
  anchorFan(thing.id, STAND_IN_SPOT);
  onPick({ kind: "thing", thing });
}

/** The stand-in's walk: the act a fan button chose lands at once, as the scene hands it on arrival. */
export function useStandInWalk(actOn: { thing: Thing; act: Act; at: number } | null | undefined, onPick: (pick: StandInPick) => void): void {
  useEffect(() => {
    if (actOn !== null && actOn !== undefined) onPick({ kind: "act", thing: actOn.thing, act: actOn.act });
    // A new tap is a new `at`; the city's handler is read as it stands then.
  }, [actOn]);
}

export interface StandInProps {
  things?: readonly Thing[] | undefined;
  actOn?: { thing: Thing; act: Act; at: number } | null | undefined;
  onPick: (pick: StandInPick) => void;
  /** The thing the timed sleep lies on (R-WORLD-025), shown as `data-stand-in-asleep`. */
  asleep?: string | null | undefined;
  /** The act done at once that landed last (R-WORLD-005), shown as `data-stand-in-acted`. */
  acted?: { activity: string; at: number } | null | undefined;
  /** The scene's frame drawn: the stand-in's `data-stand-in-draw` button draws one. */
  onFrame?: ((ms: number) => void) | undefined;
  /** The pinch come to rest close on the character: the stand-in's `data-stand-in-zoom` button brings it. */
  onZoomed?: ((zoomed: boolean) => void) | undefined;
}

/**
 * The scene's stand-in: a button that draws a frame, one for the player's own figure, for a person, for a shopfront with
 * its sign, and one for each thing, which opens its fan beside it.
 */
export function StandInScene({ things, actOn, onPick, asleep, acted, onFrame, onZoomed }: StandInProps) {
  useStandInWalk(actOn, onPick);
  return (
    <div data-stand-in-scene data-stand-in-asleep={asleep ?? ""} data-stand-in-acted={acted?.activity ?? ""}>
      <button type="button" data-stand-in-draw onClick={() => onFrame?.(16)} />
      <button type="button" data-stand-in-zoom onClick={() => onZoomed?.(true)} />
      <button type="button" data-stand-in-own onClick={() => onPick({ kind: "own" })} />
      <button type="button" data-stand-in-person onClick={() => onPick({ kind: "person", slot: 0 })} />
      <button type="button" data-stand-in-shopfront onClick={() => onPick({ kind: "model", file: "shopfront.glb", signs: ["place.bode-thomas.sign.1"] })} />
      {(things ?? []).map((thing) => (
        <button key={thing.id} type="button" data-stand-in-thing={thing.id} onClick={() => standInTap(thing, onPick)} />
      ))}
    </div>
  );
}

/**
 * A thing tapped in the stand-in scene and its fan's button for `act` (an act's id, or the entry it stages) pressed, at
 * once: for a test on fake clocks, where nothing may wait.
 */
export function pressFanActNow(thing: string, act: string): void {
  fireEvent.click(found(`[data-stand-in-thing="${thing}"]`));
  fireEvent.click(found(`[data-fan="${thing}"] [data-fan-act="${act}"] button`));
}

/** A thing tapped in the stand-in scene, and its fan's button for `act` (an act's id, or the entry it stages) pressed. */
export async function pressFanAct(thing: string, act: string, timeout = 3000): Promise<void> {
  fireEvent.click(await waitFor(() => found(`[data-stand-in-thing="${thing}"]`), { timeout }));
  fireEvent.click(await waitFor(() => found(`[data-fan="${thing}"] [data-fan-act="${act}"] button`), { timeout }));
}
