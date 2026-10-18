// The sticker that rides the route on the painted map: the danfo, or the way picked on the ride sheet, the car of your
// own among them. Its own small module, so the map's shell reads it without loading the painted map.
import { createContext } from "react";

export const RouteVehicle = createContext("vehicle_danfo");
