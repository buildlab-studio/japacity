// The map data the place entries use (city:positions-rough-on-purpose), for the credits screen (city:credits-screen-attributions).
import { content } from "@japacity/content";

export function placeMapData(): string[] {
  return Object.values(content.place).flatMap((entry) => (entry.data?.source === "osm" ? [`https://www.openstreetmap.org (${entry.id}, checked ${entry.data.checked})`] : []));
}
