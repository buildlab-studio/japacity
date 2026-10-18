// What the city may show and where (city:places-stage-their-acts, city:set-piece-shown-where-staged, city:enterable-places-follow-view and city:ojuelegba-is-the-hub). Pure: everything here reads the
// view and the place entries, and nothing else, so the city never shows a field the view lacks.
import type { ActivityEntry, Id, PlaceEntry, PlayerView, ReportLine } from "@japacity/sim";

export type ViewPlace = Pick<PlayerView["place"], "where" | "country">;

const DEFAULT_PLACE: Record<ViewPlace["where"], Id<"place">> = {
  home: "place.family-house",
  abroad: "place.the-room",
  road: "place.road-night",
};

/** The places a player can enter now (city:enterable-places-follow-view): never one of a country the character is not in. */
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

/** The place a life opens in (city:ojuelegba-is-the-hub): the hub at home, the country's hub abroad, the yard on the road. */
export function openingPlace(where: ViewPlace, places: readonly PlaceEntry[]): Id<"place"> {
  const hub = enterable(where, places).find((place) => place.hub && (where.where !== "abroad" || place.country === where.country));
  return hub?.id ?? DEFAULT_PLACE[where.where];
}

/**
 * The place that stages an id for where the character is (city:places-stage-their-acts): a place of the character's
 * own country first, then one serving every country, then the default place. One id may stand at
 * several places of a country (city:places-stage-their-acts: overtime on every workplace's rota
 * board), so given the place in hand, an id staged there is shown there.
 */
export function stagedAt(id: string, where: ViewPlace, places: readonly PlaceEntry[], here: string | null = null): Id<"place"> {
  const open = enterable(where, places).filter((place) => (place.stages as readonly string[]).includes(id));
  const inHand = here === null ? undefined : open.find((place) => place.id === here);
  if (inHand !== undefined) return inHand.id;
  const own = open.find((place) => place.country !== null && place.country === where.country);
  return (own ?? open[0])?.id ?? DEFAULT_PLACE[where.where];
}

/**
 * Whether a place serving every country stands on the map of the country the character is in (city:places-stage-their-acts, world.md
 * world:painted-maps-abroad): it does unless every entry it stages is shown instead at a place of that country, or is another
 * country's own (the workplace's Canadian jobs in London). So in London the country-less test centre and workplace give
 * way to the test centre at Elephant and Castle and the workplaces with a door; in Calgary they still stand.
 */
export function servesHere(place: PlaceEntry, where: ViewPlace, places: readonly PlaceEntry[], activities: Readonly<Record<string, Pick<ActivityEntry, "country">>>): boolean {
  if (where.where !== "abroad" || place.where !== "abroad" || place.country !== null || where.country === null) return true;
  const own = places.filter((other) => other.where === "abroad" && other.country === where.country);
  return (place.stages as readonly string[]).some((id) => {
    const country = activities[id]?.country ?? null;
    if (country !== null && country !== where.country) return false;
    return !own.some((other) => (other.stages as readonly string[]).includes(id));
  });
}

/**
 * The room abroad's spot on the map (world:painted-maps-abroad): a made-up spot a little off the country's hub, as its street
 * is made up; in London 51471, -73, off Choumert Road (design page 10 section 4). Null where the country has no hub.
 */
export function roomSpot(country: string | null, places: readonly PlaceEntry[], countries: Readonly<Record<string, { homeSpot: { latE3: number; lonE3: number } | null } | undefined>> = {}): { latE3: number; lonE3: number } | null {
  // The country's home spot as content's country table keeps it (design page 11 section 3: north-east Calgary, the camp
  // east of Dubai, the Domitiana), else a little off its hub.
  const spot = country === null ? null : (countries[country]?.homeSpot ?? null);
  if (spot !== null) return spot;
  const hub = places.find((place) => place.where === "abroad" && place.country === country && place.hub)?.position ?? null;
  return hub === null ? null : { latE3: hub.latE3 - 2, lonE3: hub.lonE3 - 3 };
}

/**
 * The home's own acts where the character lives (home:home-is-the-home-point, home:compound-room-is-a-home): a room of their own (Makoko's, the
 * room in a compound) stages nothing itself, since an id is staged at one place (city:places-stage-their-acts); while it is the home it
 * stages what the family house stages, so its bed, stove, drum and papers box act as the parlour's do.
 */
export function homeStagesAt(place: string, home: string | null, where: ViewPlace, places: readonly PlaceEntry[]): readonly string[] {
  const family = DEFAULT_PLACE.home;
  if (where.where !== "home" || home === null || place !== home || home === family) return [];
  return places.find((entry) => entry.id === family)?.stages ?? [];
}

/**
 * The acts lived by hand at home (activity:acts-may-repeat-in-month, decision 0012): every act that repeats is staged at the
 * family house and in the character's own home while they are at home, so the parlour's table can offer the study a hub
 * or a centre also stages, and the bed its nap. Content stages an id at one place only (city:places-stage-their-acts), so the home's
 * share is read here; a thing still shows only the acts its file declares.
 */
export function byHandAt(place: string, home: string | null, where: ViewPlace, activities: Readonly<Record<string, ActivityEntry>>): readonly string[] {
  if (where.where !== "home" || (place !== DEFAULT_PLACE.home && place !== home)) return [];
  return Object.values(activities).filter((entry) => entry.repeat === true).map((entry) => entry.id as string);
}

/** An open set piece and the place that stages it, with its question (city:set-piece-shown-where-staged). */
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
function activityOf(line: ReportLine): string | null {
  const named = Object.values(line.params).find((value): value is string => typeof value === "string" && value.startsWith("activity."));
  return named ?? null;
}

/** The month's report lines about an activity staged at this place (city:set-piece-shown-where-staged). */
export function reportHere(view: Pick<PlayerView, "report" | "place">, place: Id<"place">, places: readonly PlaceEntry[]): ReportLine[] {
  return (view.report?.lines ?? []).filter((line) => {
    const activity = activityOf(line);
    return activity !== null && stagedAt(activity, view.place, places, place) === place;
  });
}

/** The open offers staged at this place, by entry only: never a field the offer did not show (city:place-shows-only-the-view). */
export function offersHere(view: Pick<PlayerView, "offers" | "place">, place: Id<"place">, places: readonly PlaceEntry[]): Id<"offer">[] {
  return view.offers.filter((offer) => stagedAt(offer.entry, view.place, places, place) === place).map((offer) => offer.entry);
}
