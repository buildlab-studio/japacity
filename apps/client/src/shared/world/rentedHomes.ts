// Which homes stand on the map (city.md's rows under home.md R-HOME-010 and R-HOME-002): the family house always, a
// rented room or the hostel only as the home lived in. Read by the city's stops and the map's pins alike.

/** A rented home is on the map only while it is lived in; the family house keeps its place. */
export const RENTED_HOMES: ReadonlySet<string> = new Set(["place.compound-room", "place.hostel-room"]);

/** Whether a place may stand on the map at all: a rented room or the hostel only as the home lived in. */
export function onMap(id: string, home: string | null): boolean {
  return !RENTED_HOMES.has(id) || id === home;
}
