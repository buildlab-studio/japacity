// The vehicles a ride abroad plays in, beyond London's (world:ride-abroad-and-workplace; docs/design/11-calgary-dubai-and-castel-volturno.md section 6): Calgary's bus,
// the CTrain car and the taxi; Dubai's metro car, its city bus, the labour bus to the site and the taxi; Castel
// Volturno's coast road bus and the gangmaster's van to the fields. Each with its model, the seat its model's build
// gives in the turned model's own frame (facing +z, the kerb and the window on -x: these countries drive on the right, so
// the ride keeps the right-hand lane), its size until the model arrives, and the land its street runs through.
import type { RideChoice } from "../../shared/world/contract";

export type AbroadVehicle = "calgary-bus" | "ctrain" | "canada-taxi" | "dubai-bus" | "dubai-metro" | "labour-bus" | "dubai-taxi" | "italy-bus" | "van";

/** A seat for the ride: the eye, where the window beside it looks, and where the seat looks ahead. */
export interface RideSeat {
  eye: readonly [number, number, number];
  window: readonly [number, number, number];
  ahead: readonly [number, number, number];
}

/** The street a country's ride runs through: Calgary's cold, Dubai's heat, the coast road's light. */
export type RideLand = "cold" | "heat" | "coast";

export interface VehicleSpec {
  /** The model's shipped file. */
  file: string;
  /** The model's name, for its tile on the ride sheet. */
  model: string;
  seat: RideSeat;
  /** On rails: no road marks, the ballast under it, the street set back. */
  rail: boolean;
  /** Width, height and length in metres, for the stand-in and the camera at the stop. */
  size: readonly [number, number, number];
  land: RideLand;
}

// The seats as the models' builds export them (models/vehicles/<vehicle>/build.ts): CALGARY_BUS_SEAT, CTRAIN_SEAT,
// METRO_SEAT, LABOUR_BUS_SEAT, TAXI_SEAT, ITALY_BUS_SEAT and VAN_SEAT. A test holds them equal.
const CALGARY_BUS_SEAT: RideSeat = { eye: [-0.86, 1.6, -2.61], window: [-6, 1.2, 0.49], ahead: [-0.4, 1.4, 11.99] };
const CTRAIN_SEAT: RideSeat = { eye: [-1.04, 2.2, -7.72], window: [-8, 1.9, -4.5], ahead: [-0.6, 2, 6] };
const METRO_SEAT: RideSeat = { eye: [-1.05, 2.3, 6.4], window: [-8, 1.9, 7.85], ahead: [-0.5, 2, 19.85] };
const LABOUR_BUS_SEAT: RideSeat = { eye: [-0.8, 2.1, -0.08], window: [-6, 1.8, 0.6], ahead: [-0.3, 1.9, 8] };
const TAXI_SEAT: RideSeat = { eye: [-0.42, 1.16, -0.78], window: [-6, 0.95, 0.4], ahead: [0, 1, 8] };
const ITALY_BUS_SEAT: RideSeat = { eye: [-0.62, 1.62, 2.84], window: [-4.5, 1.0, 9.5], ahead: [-0.3, 1.5, 12] };
// The van's camera sits low on the road-side bench, looking across at the small window in the kerb-side wall.
const VAN_SEAT: RideSeat = { eye: [0.72, 1.5, -0.98], window: [-6, 1.75, -0.4], ahead: [-2.16, 1.45, 7.0] };

export const SEATS = { CALGARY_BUS_SEAT, CTRAIN_SEAT, METRO_SEAT, LABOUR_BUS_SEAT, TAXI_SEAT, ITALY_BUS_SEAT, VAN_SEAT } as const;

const CALGARY_BUS = "shared/vehicle/vehicle_calgary-bus.glb";
const DUBAI_TAXI = "places/deira/vehicle_taxi-dubai.glb";

export const VEHICLES: Readonly<Record<AbroadVehicle, VehicleSpec>> = {
  "calgary-bus": { file: CALGARY_BUS, model: "vehicle_calgary-bus", seat: CALGARY_BUS_SEAT, rail: false, size: [3.2, 3.3, 12.4], land: "cold" },
  ctrain: { file: "shared/vehicle/vehicle_ctrain-car.glb", model: "vehicle_ctrain-car", seat: CTRAIN_SEAT, rail: true, size: [2.7, 4.9, 24.7], land: "cold" },
  // Calgary's taxi rides in the one taxi with a seat drawn inside, the Dubai taxi's body: the ride is seen from its back bench.
  "canada-taxi": { file: DUBAI_TAXI, model: "vehicle_taxi-dubai", seat: TAXI_SEAT, rail: false, size: [2.0, 1.6, 4.7], land: "cold" },
  // Dubai's city bus is a white and red single-decker, as Calgary's is: the same model.
  "dubai-bus": { file: CALGARY_BUS, model: "vehicle_calgary-bus", seat: CALGARY_BUS_SEAT, rail: false, size: [3.2, 3.3, 12.4], land: "heat" },
  // The metro car on the viaduct is decor: the ride plays inside this one.
  "dubai-metro": { file: "shared/vehicle/vehicle_dubai-metro.glb", model: "vehicle_dubai-metro", seat: METRO_SEAT, rail: true, size: [2.9, 3.6, 17.3], land: "heat" },
  "labour-bus": { file: "places/deira/vehicle_labour-bus.glb", model: "vehicle_labour-bus", seat: LABOUR_BUS_SEAT, rail: false, size: [2.8, 3.0, 7.5], land: "heat" },
  "dubai-taxi": { file: DUBAI_TAXI, model: "vehicle_taxi-dubai", seat: TAXI_SEAT, rail: false, size: [2.0, 1.6, 4.7], land: "heat" },
  "italy-bus": { file: "shared/vehicle/vehicle_italy-bus.glb", model: "vehicle_italy-bus", seat: ITALY_BUS_SEAT, rail: false, size: [3.3, 3.3, 12.2], land: "coast" },
  van: { file: "shared/vehicle/vehicle_van.glb", model: "vehicle_van", seat: VAN_SEAT, rail: false, size: [2.6, 2.45, 5.7], land: "coast" },
};

/**
 * The vehicle a way rides in, in the country the life is in (world:ride-abroad-and-workplace): the bus to or from a stop the
 * employer's shuttle serves is the labour bus in the UAE and the van in Italy (place:employer-shuttle-rides-free); null for Lagos's
 * ways and London's, which keep their own.
 */
export function vehicleFor(country: string | null, way: RideChoice["id"], shuttle: boolean): AbroadVehicle | null {
  const ways = country === null ? undefined : BY_COUNTRY[country];
  if (ways === undefined) return null;
  return (shuttle && way === "bus" ? ways.shuttle : undefined) ?? ways[way] ?? null;
}

/** Each country's vehicles by way, and the shuttle's bus where the country has one. */
const BY_COUNTRY: Readonly<Record<string, Partial<Record<RideChoice["id"] | "shuttle", AbroadVehicle>>>> = {
  "country.canada": { bus: "calgary-bus", train: "ctrain", taxi: "canada-taxi" },
  "country.uae": { bus: "dubai-bus", train: "dubai-metro", taxi: "dubai-taxi", shuttle: "labour-bus" },
  "country.italy": { bus: "italy-bus", shuttle: "van" },
};

/** A way's tile on the ride sheet in the country the life is in: its vehicle's model, or null where Lagos's or London's own stands. */
export function wayModelFor(country: string | null, way: RideChoice["id"], shuttle: boolean): string | null {
  const vehicle = vehicleFor(country, way, shuttle);
  return vehicle === null ? null : VEHICLES[vehicle].model;
}

