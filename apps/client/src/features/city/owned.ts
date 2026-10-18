// The market's things in the room: a thing owned stands in the home lived in at its set spot from the
// place file (your corner at the family house; the room, the kitchenette and the yard in a home of your own), or where
// the player set it down in buy mode, which is the room's own arrangement kept beside the save (shared/world/arranged).
// What is owned is the simulation's; where it stands is the room's. Pure: the city reads it as it reads the plan's shows.
import type { Thing } from "../../shared/world/contract";
import { type OwnedSpot, type PlaceFile, type Spot, stageOf } from "../../shared/scene/placeFile";

/** The homes where the player arranges what is theirs: a home of their own, never the family house, a street or an office. */
const ARRANGED_HOMES: ReadonlySet<string> = new Set(["place.compound-room", "place.hostel-room", "place.makoko", "place.the-room"]);

/** Buy mode stands in the home lived in when it is a home of the player's own, with something owned standing in it. */
export function buyModeAt(place: string, home: string | null, standing: readonly string[]): boolean {
  return home !== null && place === home && ARRANGED_HOMES.has(place) && standing.length > 0;
}

/** A thing of the market's id as a thing of the place: `thing.tv` is the place thing `owned-tv`. */
export function ownedThingId(thing: string): string {
  return `owned-${thing.slice(thing.indexOf(".") + 1)}`;
}

/** Where an owned thing stands now: where the player set it down, else its set spot. */
function spotOf(spot: OwnedSpot, arranged: Readonly<Record<string, Spot>>): Spot {
  return arranged[spot.thing] ?? spot.at;
}

/**
 * The place as what is owned leaves it: each thing standing here (owned, and a thing this home may hold) joins the stage
 * at its spot as a model of its own, taking the place of the model it replaces; one with acts is a thing to tap. The same
 * file when nothing owned stands here, so the scene is rebuilt only when what stands changes.
 */
export function showOwned(file: PlaceFile, standing: readonly string[], arranged: Readonly<Record<string, Spot>> = {}): PlaceFile {
  const stage = stageOf(file);
  const shown = (stage.owned ?? []).filter((spot) => standing.includes(spot.thing));
  if (shown.length === 0) return file;
  const hidden = new Set(shown.flatMap((spot) => (spot.hides === undefined ? [] : [spot.hides])));
  const things: Thing[] = shown.flatMap((spot) => (spot.acts === undefined || spot.acts.length === 0 ? [] : [{ id: ownedThingId(spot.thing), file: spot.file, copy: 0, label: `${spot.thing}.name`, acts: spot.acts }]));
  return {
    ...file,
    stage: {
      ...stage,
      models: [...stage.models.filter((model) => !hidden.has(model.file)), ...shown.map((spot) => ({ file: spot.file, at: [spotOf(spot, arranged)], owned: spot.thing }))],
      ...(things.length === 0 ? {} : { things: [...(stage.things ?? []), ...things] }),
    },
  };
}

/** The owned things standing in a staged place, each with its model and where it stands: what buy mode may lift. */
export function liftable(file: PlaceFile): { thing: string; file: string; at: Spot }[] {
  return stageOf(file).models.flatMap((model) => (model.owned === undefined || model.at[0] === undefined ? [] : [{ thing: model.owned, file: model.file, at: model.at[0] }]));
}
