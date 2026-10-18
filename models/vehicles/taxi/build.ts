// An airport taxi at the departures kerb (city.md place.airport-lagos): a plain saloon in the
// city's taxi yellow with a band of black and white checks down each side and a white roof light,
// no company's name or livery (assets:no-real-brands-on-assets). Built along +x like every vehicle, then turned to
// face +z. The wheels are round, so they are their own part, shaded smooth (assets:flat-and-smooth-shading).
// Dubai's taxi is the same saloon in cream with a red roof and no checks: the look of the city's
// cabs, with no operator's name or mark on it. It is built to be sat in for the ride abroad (world.md
// world:ride-abroad-and-workplace): its cabin hollow between the bonnet and the boot, thin walls,
// the glass panes facing out, two seats in front and the bench behind, where the ride sits on the
// right of the facing by the rear window, the kerb side.
import { lowBox, type PaletteName, setFootprint } from "@japacity/model-kit";
import { beam, part, solid } from "@japacity/model-kit/kit";
import { Group } from "three";

import { cbox, facePlusZ, profile, wheel } from "../centred";
import type { RideSeat } from "../ride";

export const TAXI = { length: 4.5, width: 1.74, height: 1.46 } as const;

/** How a city paints its taxis: the body, a roof of its own colour or none, and the band of checks or none. */
export interface TaxiLivery {
  name: string;
  body: PaletteName;
  roof: PaletteName | null;
  checks: boolean;
  /** The taxi's white roof light; a private car has none. */
  roofLight?: boolean;
  /** The cabin built hollow with its seats, to be sat in on a ride; else the body is one solid profile. */
  cabin?: boolean;
}

export const LAGOS_TAXI: TaxiLivery = { name: "veh_taxi", body: "danfoYellow", roof: null, checks: true };
export const DUBAI_TAXI: TaxiLivery = { name: "veh_taxi-dubai", body: "wallCream", roof: "red", checks: false, cabin: true };

/** The ride's seat in the built frame (length along x, the kerb side at +z): the back bench on the kerb side. */
export const TAXI_SEAT_BUILT: RideSeat = { eye: [-0.78, 1.16, 0.42], window: [0.4, 0.95, 6], ahead: [8, 1.0, 0.0] };

/** The same seat in the turned model's own frame (facing +z, the kerb side at -x), as the ride reads it. */
export const TAXI_SEAT: RideSeat = { eye: [-0.42, 1.16, -0.78], window: [-6, 0.95, 0.4], ahead: [0, 1, 8] };
/** The same saloon as a family's own car, parked in the yard by the gate: plain blue, no checks, no roof light. */
export const OWN_CAR: TaxiLivery = { name: "veh_car", body: "blue", roof: null, checks: false, roofLight: false };

export function buildTaxi(livery: TaxiLivery = LAGOS_TAXI): Group {
  const g = new Group();
  const { width: w } = TAXI;
  const hw = w / 2;
  // The body as one side profile: bonnet, windscreen, roof, rear window, boot; or, to be sat in, the cabin hollow.
  if (livery.cabin === true) cabin(g, livery.body);
  else profile(g, [[-2.25, 0.32], [2.25, 0.32], [2.27, 0.78], [1.25, 0.9], [0.55, 1.4], [-0.95, 1.4], [-1.65, 0.92], [-2.27, 0.86]], w, livery.body);
  // A roof of its own colour sits a few centimetres proud of the body's, so the two tops never fight.
  const roof = livery.roof === null ? 0 : 0.04;
  if (livery.roof !== null) cbox(g, 1.5, roof, w + 0.01, -0.2, 1.4 + roof / 2, 0, livery.roof);
  // The glass: windscreen and rear window on their slopes, the side windows split by the pillar. A cabin's glass is
  // laid by cabin() as panes facing out, so it is seen through from a seat.
  if (livery.cabin !== true) {
    cbox(g, 0.03, 0.62, w - 0.2, 0.9, 1.15, 0, "glass", 0.62);
    cbox(g, 0.03, 0.58, w - 0.2, -1.3, 1.16, 0, "glass", -0.6);
  }
  for (const s of [1, -1]) {
    if (livery.cabin !== true) {
      cbox(g, 0.62, 0.36, 0.02, 0.15, 1.13, s * (hw + 0.005), "glass");
      cbox(g, 0.66, 0.36, 0.02, -0.65, 1.13, s * (hw + 0.005), "glass");
    }
    // The band of checks below the windows, in two rows.
    if (livery.checks) {
      for (let i = 0; i < 14; i++) {
        for (let row = 0; row < 2; row++) cbox(g, 0.28, 0.07, 0.02, -1.82 + i * 0.28, 0.82 - row * 0.07, s * (hw + 0.006), (i + row) % 2 === 0 ? "black" : "white");
      }
    }
    // Door seams and handles.
    for (const x of [0.55, -0.3, -1.05]) cbox(g, 0.02, 0.5, 0.02, x, 0.62, s * (hw + 0.008), "black");
    cbox(g, 0.12, 0.03, 0.02, 0.35, 0.92, s * (hw + 0.01), "black");
    cbox(g, 0.12, 0.03, 0.02, -0.45, 0.92, s * (hw + 0.01), "black");
    cbox(g, 0.08, 0.06, 0.12, 0.62, 1.0, s * (hw + 0.06), "black");
  }
  // Bumpers, lamps, plates, and the roof light.
  cbox(g, 0.12, 0.16, w + 0.02, 2.28, 0.4, 0, "black");
  cbox(g, 0.12, 0.16, w + 0.02, -2.28, 0.4, 0, "black");
  for (const s of [1, -1]) {
    cbox(g, 0.04, 0.12, 0.3, 2.265, 0.7, s * 0.6, "cream");
    cbox(g, 0.04, 0.14, 0.24, -2.275, 0.72, s * 0.62, "red");
  }
  cbox(g, 0.02, 0.11, 0.4, 2.35, 0.4, 0, "white");
  cbox(g, 0.02, 0.11, 0.4, -2.35, 0.4, 0, "white");
  if (livery.roofLight !== false) cbox(g, 0.5, 0.16, 0.24, -0.2, 1.48 + roof, 0, "white");
  // The wheels.
  const wheels = part(g, "wheels");
  wheels.userData.smooth = true;
  for (const x of [1.4, -1.4]) for (const s of [1, -1]) wheel(wheels, 0.32, 0.2, x, 0.32, s * (hw - 0.08));
  const root = facePlusZ(g, livery.name);
  return setFootprint(root, [lowBox(root)]);
}

/**
 * The saloon's body built hollow to be sat in: the bonnet and the boot solid, the cabin between them a floor, thin
 * doors to the beltline, the pillars and the roof, with the windscreen, the rear window and the four side windows as
 * panes facing out; two seats in front, the driver's on the road side (-z), and the bench behind.
 */
function cabin(g: Group, body: PaletteName): void {
  const { width: w } = TAXI;
  const hw = w / 2;
  const belt = 0.9;
  const top = 1.4;
  const front = 1.25;
  const back = -1.65;
  profile(g, [[front, 0.32], [2.25, 0.32], [2.27, 0.78], [front, belt]], w, body);
  profile(g, [[-2.25, 0.32], [back, 0.32], [back, belt + 0.02], [-2.27, 0.86]], w, body);
  cbox(g, front - back, 0.12, w - 0.04, (front + back) / 2, 0.38, 0, body);
  cbox(g, front - back - 0.1, 0.02, w - 0.14, (front + back) / 2, 0.45, 0, "charcoal");
  for (const s of [1, -1]) {
    const z = s * (hw - 0.03);
    cbox(g, front - back, belt - 0.32, 0.06, (front + back) / 2, (belt + 0.32) / 2, z, body);
    // The pillars: the windscreen's, the middle one and the rear one; the rail over the doors.
    beam(g, [front, belt, z], [0.55, top, z], 0.07, body);
    beam(g, [back, belt + 0.02, z], [-0.95, top, z], 0.07, body);
    cbox(g, 0.12, top - belt, 0.06, -0.25, (belt + top) / 2, z, body);
    cbox(g, 1.5, 0.06, 0.06, -0.2, top - 0.03, z, body);
    // The side windows, facing out, front and rear of the middle pillar.
    solid(g, s > 0 ? [[-0.2, belt + 0.02, hw + 0.005], [front - 0.08, belt + 0.02, hw + 0.005], [0.5, top - 0.06, hw + 0.005], [-0.2, top - 0.06, hw + 0.005]] : [[-0.2, belt + 0.02, -hw - 0.005], [-0.2, top - 0.06, -hw - 0.005], [0.5, top - 0.06, -hw - 0.005], [front - 0.08, belt + 0.02, -hw - 0.005]], [[0, 1, 2, 3]], "glass");
    solid(g, s > 0 ? [[back + 0.08, belt + 0.04, hw + 0.005], [-0.3, belt + 0.02, hw + 0.005], [-0.3, top - 0.06, hw + 0.005], [-0.9, top - 0.06, hw + 0.005]] : [[back + 0.08, belt + 0.04, -hw - 0.005], [-0.9, top - 0.06, -hw - 0.005], [-0.3, top - 0.06, -hw - 0.005], [-0.3, belt + 0.02, -hw - 0.005]], [[0, 1, 2, 3]], "glass");
  }
  // The roof, and the windscreen and the rear window on their slopes, facing out.
  cbox(g, 1.5, 0.05, w, -0.2, top - 0.05, 0, body);
  solid(g, [[front, belt, -hw + 0.08], [front, belt, hw - 0.08], [0.55, top, hw - 0.08], [0.55, top, -hw + 0.08]], [[0, 3, 2, 1]], "glass");
  solid(g, [[back, belt + 0.02, -hw + 0.08], [-0.95, top, -hw + 0.08], [-0.95, top, hw - 0.08], [back, belt + 0.02, hw - 0.08]], [[0, 3, 2, 1]], "glass");
  // The dashboard, the two front seats and the bench behind.
  cbox(g, 0.4, 0.3, w - 0.1, front - 0.2, belt - 0.3, 0, "charcoal");
  const seat = (x: number, z: number, width: number): void => {
    cbox(g, 0.5, 0.14, width, x, 0.5, z, "charcoal");
    cbox(g, 0.1, 0.6, width, x - 0.28, 0.6, z, "charcoal");
  };
  seat(0.35, -0.38, 0.5);
  seat(0.35, 0.38, 0.5);
  seat(-0.75, 0, w - 0.2);
}
