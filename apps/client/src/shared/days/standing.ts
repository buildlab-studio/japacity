// Where the character stands, for the month's lines (docs/rules/world.md R-WORLD-030): they are told
// on the phone only at home, the house or the room, never on the street. The city keeps where the
// player stopped on the device (features/city/City.tsx, LAST_KEY, rules 5 and 7 of the world mode):
// the place's id, with "inside" when in its room. The simulation keeps no place of the city.
import type { PlayerView } from "@japacity/sim";
import { CITY_LAST_KEY } from "../kept/storage";

/** The home at home (where the character lives, R-HOME-006) and the room abroad. */
export function homeOf(view: Pick<PlayerView, "place" | "home">): string {
  return view.place.where === "abroad" ? "place.the-room" : (view.home.place ?? "place.family-house");
}

/** The place the city last stood in, or null when it has kept none. */
function standingPlace(): string | null {
  try {
    const kept = localStorage.getItem(CITY_LAST_KEY);
    const parsed: unknown = kept === null ? null : JSON.parse(kept);
    return Array.isArray(parsed) && typeof parsed[0] === "string" ? parsed[0] : null;
  } catch {
    return null;
  }
}

/** True at home, in the yard or inside; a game that knows no place opens at home (R-WORLD-014). */
export function atHome(view: Pick<PlayerView, "place" | "home">): boolean {
  if (view.place.where === "road") return false;
  const place = standingPlace();
  return place === null || place === homeOf(view);
}
