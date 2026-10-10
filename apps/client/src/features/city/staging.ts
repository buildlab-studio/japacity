// What the city may show and where (city.md R-CITY-010 to 013). Pure: everything here reads the
// view and the place entries, and nothing else, so the city never shows a field the view lacks.
import type { Id, PlaceEntry, PlayerView, ReportLine } from "@japacity/sim";

export type ViewPlace = Pick<PlayerView["place"], "where" | "country">;

const DEFAULT_PLACE: Record<ViewPlace["where"], Id<"place">> = {
  home: "place.family-house",
  abroad: "place.the-room",
  road: "place.road-night",
};

/** The places a player can enter now (R-CITY-012): never one of a country the character is not in. */
export function enterable(where: ViewPlace, places: readonly PlaceEntry[]): PlaceEntry[] {
  switch (where.where) {
    case "home":
      return places.filter((place) => place.where === "home");
    case "abroad":
      return places.filter((place) => place.where === "abroad" && (place.country === null || place.country === where.country));
    case "road":
      return places.filter((place) => place.where === "road" && place.nameKind === "stylised");
    default: {
      const never: never = where.where;
      throw new Error(`Unknown where: ${String(never)}`);
    }
  }
}

/** The place a life opens in (R-CITY-013): the hub at home, the country's hub abroad, the yard on the road. */
export function openingPlace(where: ViewPlace, places: readonly PlaceEntry[]): Id<"place"> {
  const hub = enterable(where, places).find((place) => place.hub && (where.where !== "abroad" || place.country === where.country));
  return hub?.id ?? DEFAULT_PLACE[where.where];
}

/**
 * The place that stages an id for where the character is (R-CITY-010): a place of the character's
 * own country first, then one serving every country, then the default place.
 */
export function stagedAt(id: string, where: ViewPlace, places: readonly PlaceEntry[]): Id<"place"> {
  const open = enterable(where, places).filter((place) => (place.stages as readonly string[]).includes(id));
  const own = open.find((place) => place.country !== null && place.country === where.country);
  return (own ?? open[0])?.id ?? DEFAULT_PLACE[where.where];
}

/**
 * The home's own acts where the character lives (home.md R-HOME-006, R-HOME-010): a room of their own (Makoko's, the
 * room in a compound) stages nothing itself, since an id is staged at one place (R-CITY-010); while it is the home it
 * stages what the family house stages, so its bed, stove, drum and papers box act as the parlour's do.
 */
export function homeStagesAt(place: string, home: string | null, where: ViewPlace, places: readonly PlaceEntry[]): readonly string[] {
  const family = DEFAULT_PLACE.home;
  if (where.where !== "home" || home === null || place !== home || home === family) return [];
  return places.find((entry) => entry.id === family)?.stages ?? [];
}

/** An open set piece and the place that stages it, with its question (R-CITY-011). */
export interface Scene {
  place: Id<"place">;
  setpiece: Id<"setpiece">;
  /** The question's words key, or null between questions. */
  question: string | null;
}

export function openScene(view: Pick<PlayerView, "setpiece" | "place">, places: readonly PlaceEntry[]): Scene | null {
  const open = view.setpiece;
  if (open === null) return null;
  return { place: stagedAt(open.entry, view.place, places), setpiece: open.entry, question: open.question === null ? null : `${open.entry}.q.${open.question.id}` };
}

/** The activity a report line is about, when it names one. */
export function activityOf(line: ReportLine): string | null {
  const named = Object.values(line.params).find((value): value is string => typeof value === "string" && value.startsWith("activity."));
  return named ?? null;
}

/** The month's report lines about an activity staged at this place (R-CITY-011). */
export function reportHere(view: Pick<PlayerView, "report" | "place">, place: Id<"place">, places: readonly PlaceEntry[]): ReportLine[] {
  return (view.report?.lines ?? []).filter((line) => {
    const activity = activityOf(line);
    return activity !== null && stagedAt(activity, view.place, places) === place;
  });
}

/** The open offers staged at this place, by entry only: never a field the offer did not show (R-CITY-002). */
export function offersHere(view: Pick<PlayerView, "offers" | "place">, place: Id<"place">, places: readonly PlaceEntry[]): Id<"offer">[] {
  return view.offers.filter((offer) => stagedAt(offer.entry, view.place, places) === place).map((offer) => offer.entry);
}
