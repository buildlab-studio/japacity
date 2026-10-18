// The family compound behind the door (prologue:front-door-builds-a-person, prologue:nothing-behind-the-door): where its file is, where the figure stands
// at its gate and the one camera that sees it, shared by the page's scene and the still compound behind "Your life so
// far". The file is fetched once a session, so the cut from the first screen to the second finds it waiting.
import type { PlaceFile } from "../scene/placeFile";
import { loadJson, loadManifest } from "../three/manifest";

/** The compound's file under places/: the family house's own (place.family-house). */
const COMPOUND = "family-house-compound";
export const PLACE = "place.family-house";
/**
 * Where the character stands: on the street just outside the gate, which the house's model puts at
 * x 3.4 of a plot centred on the house at (-1, 1.5), the gate on its +Z side 15.5 m out.
 */
export const GATE: readonly [number, number] = [2.4, 18.1];
/** The camera: this far back along the street and this high, looking down at this pitch, so the figure on its plinth stands large in the top part of a tall screen. */
export const BACK = 6.2;
export const HIGH = 2.9;
const LOOK_DOWN = (24 * Math.PI) / 180;
export const FOV = 50;

/** Where the compound's camera stands and the point it looks at. */
export function compoundCamera(): { position: [number, number, number]; target: [number, number, number]; fov: number } {
  return { position: [GATE[0], HIGH, GATE[1] + BACK], target: [GATE[0], HIGH - Math.tan(LOOK_DOWN) * BACK, GATE[1]], fov: FOV };
}

let fileOnce: Promise<PlaceFile | null> | null = null;

/** The compound's place file, fetched once a session. */
export function loadCompound(): Promise<PlaceFile | null> {
  fileOnce ??= loadManifest().then((manifest) => loadJson<PlaceFile>(manifest, `places/${COMPOUND}/place.json`));
  fileOnce.catch(() => {
    fileOnce = null;
  });
  return fileOnce;
}
