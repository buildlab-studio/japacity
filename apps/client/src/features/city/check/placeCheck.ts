// What the place check's page draws for a place in a mode (city.md R-CITY-027, R-CITY-038): the
// stage, the crowd the city samples on the check's day without the player's own figure, and the
// mode's settings on the check's device. Pure, so the page and its test read the same run.
import type { PlaceEntry } from "@japacity/sim";

import type { PlaceInput } from "../../../../../../tools/assets/place-check.types";
import { hash, poolOf, type Shown, sampleCrowd } from "../crowd";
import { type CityTuning, type ModeSettings, modeSettings } from "../mode";
import type { PlaceFile, Stage } from "../placeFile";
import { type Point, walkableOf } from "../walk/map";

export type CheckInput = PlaceInput<PlaceFile, PlaceEntry, CityTuning>;

export interface PlaceRun {
  /** The place's id, from which its crowd's strolls are drawn. */
  place: string;
  stage: Stage;
  people: Shown[];
  own: string;
  settings: ModeSettings;
  text: Record<string, string>;
  moving: boolean;
}

export function runOf(input: CheckInput): PlaceRun {
  const stage = input.file.stage;
  if (stage === undefined) throw new Error(`${input.file.place} has no stage`);
  const pool = poolOf(input.file.people.sample).filter((person) => person.file !== input.own);
  const people = sampleCrowd(input.entry, pool, input.date, input.mode, input.city).people;
  return { place: input.file.place, stage, people, own: input.own, settings: modeSettings(input.mode, input.device, input.city), text: input.text, moving: input.moving };
}

/** How far past its walkable ground a tap of the check may land, as a player's thumb does. */
const TAP_MARGIN = 2;

/**
 * The check's taps on a place (city.md R-CITY-030): `count` points anywhere over its walkable ground
 * and a little past it, drawn from a hash of the place and the tap, so every run taps the same places.
 */
export function tapsOf(stage: Pick<Stage, "ground" | "walkable">, place: string, count: number): Point[] {
  const corners = walkableOf(stage).flat();
  const minX = Math.min(...corners.map(([x]) => x)) - TAP_MARGIN;
  const maxX = Math.max(...corners.map(([x]) => x)) + TAP_MARGIN;
  const minZ = Math.min(...corners.map(([, z]) => z)) - TAP_MARGIN;
  const maxZ = Math.max(...corners.map(([, z]) => z)) + TAP_MARGIN;
  const share = (tap: number, axis: string): number => (hash(`${place}|tap|${String(tap)}|${axis}`) % 10000) / 10000;
  return Array.from({ length: count }, (_, tap) => ({ x: minX + (maxX - minX) * share(tap, "x"), z: minZ + (maxZ - minZ) * share(tap, "z") }));
}
