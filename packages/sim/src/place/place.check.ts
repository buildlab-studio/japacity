import type { Content, Id, PlaceEntry } from "../engine/types";

/** A day written year, month, day. */
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const PLACE_ID = /^place\.[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SIGN_OR_TALK = /^(place\.[a-z0-9-]+)\.(sign|overheard)\.([0-9]+)$/;

type Staged = PlaceEntry["stages"][number];

function exists(content: Content, id: Staged): boolean {
  const tables: Readonly<Record<string, Readonly<Record<string, unknown>>>> = {
    activity: content.activity,
    offer: content.offer,
    setpiece: content.setpiece,
    chapter: content.chapter,
  };
  return tables[id.split(".")[0] ?? ""]?.[id] !== undefined;
}

/** R-CITY-004, R-CITY-005 and R-CITY-008: the fields a place's kind of name allows. */
function fieldProblems(key: string, place: PlaceEntry): string[] {
  const problems: string[] = [];
  const id = place.id;
  if (!PLACE_ID.test(key)) problems.push(`place: the key ${key} is not a well-formed place id (R-CITY-004).`);
  if (id !== key) problems.push(`place: the entry under ${key} has the id ${id} (R-CITY-004).`);
  if (place.where !== "abroad" && place.country !== null) problems.push(`${id}: has the country ${place.country} at home or on the road (R-CITY-004).`);
  if (place.country !== null && place.city === null) problems.push(`${id}: has a country and no city (R-CITY-004).`);
  switch (place.nameKind) {
    case "public":
      if (place.realName === null) problems.push(`${id}: a public place has no real name (R-CITY-005).`);
      if (place.area === null) problems.push(`${id}: a public place has no area (R-CITY-005).`);
      if (place.position === null) problems.push(`${id}: a public place has no position (R-CITY-008).`);
      break;
    case "institution":
      if (place.realName !== null) problems.push(`${id}: an institution carries the real name ${place.realName}; it is shown by plain description (R-CITY-005).`);
      if (place.area === null) problems.push(`${id}: an institution has no area (R-CITY-005).`);
      if (place.position !== null) problems.push(`${id}: an institution has a position, which would pin a real office (R-CITY-005).`);
      break;
    case "business":
      if (place.realName !== null && place.sponsor === null) problems.push(`${id}: a business carries the real name ${place.realName} with no sponsor (R-CITY-005).`);
      break;
    case "stylised":
      if (place.realName !== null) problems.push(`${id}: a stylised place has the real name ${place.realName} (R-CITY-005).`);
      if (place.area !== null) problems.push(`${id}: a stylised place has the area ${place.area} (R-CITY-005).`);
      if (place.position !== null) problems.push(`${id}: a stylised place has a position (R-CITY-005).`);
      break;
    default: {
      const never: never = place.nameKind;
      problems.push(`${id}: the kind of name ${String(never)} is not known (R-CITY-005).`);
    }
  }
  if (place.position !== null && place.data === null) problems.push(`${id}: has a position with no source, licence or date (R-CITY-008).`);
  if (place.data !== null) {
    const wanted = place.data.source === "osm" ? "ODbL-1.0" : place.data.source === "overture" ? "CDLA-Permissive-2.0" : place.data.licence;
    if (place.data.licence !== wanted) problems.push(`${id}: data from ${place.data.source} carries the licence ${String(place.data.licence)}, not ${String(wanted)} (R-CITY-008).`);
    if (!DAY.test(place.data.checked)) problems.push(`${id}: the date checked, ${place.data.checked}, is not a day (R-CITY-008).`);
  }
  return problems;
}

/** R-CITY-010: every staged id exists, and is staged once for each `where` and country. */
function stagingProblems(content: Content, places: PlaceEntry[]): string[] {
  const problems: string[] = [];
  const stagedAt = new Map<string, Id<"place">>();
  for (const place of places) {
    for (const id of place.stages) {
      if (!exists(content, id)) problems.push(`${place.id}: stages ${id}, which does not exist (R-CITY-010).`);
      const scope = `${place.where} ${place.country ?? "any"} ${id}`;
      const earlier = stagedAt.get(scope);
      if (earlier !== undefined) problems.push(`${place.id}: stages ${id}, already staged at ${earlier} for the same where and country (R-CITY-010).`);
      else stagedAt.set(scope, place.id);
    }
  }
  return problems;
}

/** R-CITY-013: one hub at home, one in each country, none anywhere else. */
function hubProblems(content: Content, places: PlaceEntry[]): string[] {
  const problems: string[] = [];
  // A content with no places yet (the small test content) has no city to open in.
  if (places.length === 0) return problems;
  const hubs = places.filter((place) => place.hub);
  const home = hubs.filter((place) => place.where === "home");
  if (home.length !== 1) problems.push(`place: ${String(home.length)} hubs at home, not 1 (R-CITY-013).`);
  for (const country of Object.keys(content.country)) {
    const there = hubs.filter((place) => place.where === "abroad" && place.country === country);
    if (there.length !== 1) problems.push(`place: ${String(there.length)} hubs in ${country}, not 1 (R-CITY-013).`);
  }
  for (const place of hubs) {
    if (place.where === "road" || (place.where === "abroad" && place.country === null)) problems.push(`${place.id}: a hub on the road or in no country (R-CITY-013).`);
  }
  return problems;
}

/** R-CITY-022: no sponsor on an institution, a stylised place or a place staging an offer that can be a fraud. */
function sponsorProblems(content: Content, places: PlaceEntry[]): string[] {
  const problems: string[] = [];
  for (const place of places) {
    if (place.sponsor === null) continue;
    if (place.nameKind === "institution" || place.nameKind === "stylised") problems.push(`${place.id}: a sponsor on a place whose name is ${place.nameKind} (R-CITY-022).`);
    const frauds = place.stages.filter((id) => (content.offer[id as Id<"offer">]?.fraudBp ?? 0) > 0);
    if (frauds.length > 0) problems.push(`${place.id}: a sponsor on a place staging ${frauds.join(", ")}, which can be a fraud (R-CITY-022).`);
  }
  return problems;
}

/**
 * R-CITY-023: the road's offers and set pieces are staged only at a stylised place.
 * a set piece carries no group, so a road set piece is one whose slug starts `road-`.
 */
function roadProblems(content: Content, places: PlaceEntry[]): string[] {
  const problems: string[] = [];
  for (const place of places) {
    if (place.nameKind === "stylised") continue;
    for (const id of place.stages) {
      const roadOffer = content.offer[id as Id<"offer">]?.group === "road";
      if (roadOffer || id.startsWith("setpiece.road-")) problems.push(`${place.id}: stages ${id}, a road id, at a place that is not stylised (R-CITY-023).`);
    }
  }
  return problems;
}

/** R-CITY-024: every place has its words, and a public name's words are its real name. */
function wordProblems(places: PlaceEntry[], words: Readonly<Record<string, string>>): string[] {
  const problems: string[] = [];
  const known = new Set(places.map((place) => place.id as string));
  for (const place of places) {
    const name = words[`${place.id}.name`] ?? "";
    if (name.trim() === "") problems.push(`${place.id}: has no name (R-CITY-024).`);
    if ((words[`${place.id}.blurb`] ?? "").trim() === "") problems.push(`${place.id}: has no blurb (R-CITY-024).`);
    if (place.nameKind === "public" && place.realName !== null && name !== place.realName) {
      problems.push(`${place.id}: its name reads "${name}", not its real name "${place.realName}" (R-CITY-024).`);
    }
  }
  for (const key of Object.keys(words)) {
    const match = SIGN_OR_TALK.exec(key);
    if (match !== null && !known.has(match[1] ?? "")) problems.push(`${key}: words for a place that does not exist (R-CITY-024).`);
  }
  return problems;
}

/**
 * The city's content checks: docs/rules/city.md contract item 4. Pass the words
 * to check R-CITY-024 as well.
 * `checkContent` has no words to pass, so R-CITY-024 runs from the tests.
 */
export function placeChecks(content: Content, words?: Readonly<Record<string, string>>): string[] {
  const places = Object.values(content.place);
  return [
    ...Object.entries(content.place).flatMap(([key, place]) => fieldProblems(key, place)),
    ...stagingProblems(content, places),
    ...hubProblems(content, places),
    ...sponsorProblems(content, places),
    ...roadProblems(content, places),
    ...(words === undefined ? [] : wordProblems(places, words)),
  ];
}
