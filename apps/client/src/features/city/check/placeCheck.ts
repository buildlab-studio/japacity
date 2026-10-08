// What the place check's page draws for a place in a mode (city.md R-CITY-027, R-CITY-038): the
// stage, the crowd the city samples on the check's day without the player's own figure, and the
// mode's settings on the check's device. Pure, so the page and its test read the same run.
import type { PlaceEntry } from "@japacity/sim";

import type { PlaceInput } from "../../../../../../tools/assets/place-check.types";
import { poolOf, type Shown, sampleCrowd } from "../crowd";
import { type CityTuning, type ModeSettings, modeSettings } from "../mode";
import type { PlaceFile, Stage } from "../placeFile";

export type CheckInput = PlaceInput<PlaceFile, PlaceEntry, CityTuning>;

export interface PlaceRun {
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
  return { stage, people, own: input.own, settings: modeSettings(input.mode, input.device, input.city), text: input.text, moving: input.moving };
}
