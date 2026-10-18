// What the ride abroad needs of a vehicle built to be sat in (world:ride-abroad-and-workplace):
// a seat's eye and where it looks, carried from the frame the vehicle is built in (its length along +x, as every
// vehicle is) into the turned model's own frame (facing +z, assets:metre-units-and-origin), through facePlusZ's quarter turn and centring.
import { type Group, Vector3 } from "three";

export type Point = readonly [number, number, number];

/** A seat for the ride's camera: the eye over the cushion, a point out of the window beside it, and a point ahead. */
export interface RideSeat {
  eye: Point;
  window: Point;
  ahead: Point;
}

/** A point of the built frame in the turned model's own frame, rounded to the centimetre. */
export function turned(root: Group, point: Point): Point {
  root.updateMatrixWorld(true);
  const turn = root.children[0];
  if (turn === undefined) throw new Error("turned: the model has no turned frame");
  const at = new Vector3(...point).applyMatrix4(turn.matrix);
  const round = (value: number): number => Math.round(value * 100) / 100 + 0;
  return [round(at.x), round(at.y), round(at.z)];
}

/** A seat given in the built frame, read in the turned frame. */
export function turnedSeat(root: Group, seat: RideSeat): RideSeat {
  return { eye: turned(root, seat.eye), window: turned(root, seat.window), ahead: turned(root, seat.ahead) };
}
