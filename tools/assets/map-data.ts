// The map data the place entries use (city.md R-CITY-008), for the credits screen (R-CITY-021).
import { content } from "@japacity/content";

export function placeMapData(): string[] {
  return Object.values(content.place).flatMap((entry) => (entry.data?.source === "osm" ? [`https://www.openstreetmap.org (${entry.id}, checked ${entry.data.checked})`] : []));
}
