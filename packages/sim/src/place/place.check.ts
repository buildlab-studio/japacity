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

/** city:place-entry-fields, city:four-kinds-of-name and city:positions-rough-on-purpose: the fields a place's kind of name allows. */
function fieldProblems(key: string, place: PlaceEntry): string[] {
  const problems: string[] = [];
  const id = place.id;
  if (!PLACE_ID.test(key)) problems.push(`place: the key ${key} is not a well-formed place id (city:place-entry-fields).`);
  if (id !== key) problems.push(`place: the entry under ${key} has the id ${id} (city:place-entry-fields).`);
  if (place.where !== "abroad" && place.country !== null) problems.push(`${id}: has the country ${place.country} at home or on the road (city:place-entry-fields).`);
  if (place.country !== null && place.city === null) problems.push(`${id}: has a country and no city (city:place-entry-fields).`);
  switch (place.nameKind) {
    case "public":
      if (place.realName === null) problems.push(`${id}: a public place has no real name (city:four-kinds-of-name).`);
      if (place.area === null) problems.push(`${id}: a public place has no area (city:four-kinds-of-name).`);
      if (place.position === null) problems.push(`${id}: a public place has no position (city:positions-rough-on-purpose).`);
      break;
    case "institution":
      if (place.realName !== null) problems.push(`${id}: an institution carries the real name ${place.realName}; it is shown by plain description (city:four-kinds-of-name).`);
      if (place.area === null) problems.push(`${id}: an institution has no area (city:four-kinds-of-name).`);
      // A made-up spot of its own is allowed (city:positions-rough-on-purpose); a position from the map would pin a real office.
      if (place.position !== null && place.data?.source !== "own") problems.push(`${id}: an institution has a position from the map, which would pin a real office (city:four-kinds-of-name).`);
      break;
    case "business":
      if (place.realName !== null && place.sponsor === null) problems.push(`${id}: a business carries the real name ${place.realName} with no sponsor (city:four-kinds-of-name).`);
      break;
    case "stylised":
      if (place.realName !== null) problems.push(`${id}: a stylised place has the real name ${place.realName} (city:four-kinds-of-name).`);
      if (place.area !== null) problems.push(`${id}: a stylised place has the area ${place.area} (city:four-kinds-of-name).`);
      if (place.position !== null && place.data?.source !== "own") problems.push(`${id}: a stylised place has a position from the map (city:four-kinds-of-name).`);
      break;
    default: {
      const never: never = place.nameKind;
      problems.push(`${id}: the kind of name ${String(never)} is not known (city:four-kinds-of-name).`);
    }
  }
  if (place.position !== null && place.data === null) problems.push(`${id}: has a position with no source, licence or date (city:positions-rough-on-purpose).`);
  if (place.data !== null) {
    const wanted = place.data.source === "osm" ? "ODbL-1.0" : place.data.source === "overture" ? "CDLA-Permissive-2.0" : place.data.licence;
    if (place.data.licence !== wanted) problems.push(`${id}: data from ${place.data.source} carries the licence ${String(place.data.licence)}, not ${String(wanted)} (city:positions-rough-on-purpose).`);
    if (!DAY.test(place.data.checked)) problems.push(`${id}: the date checked, ${place.data.checked}, is not a day (city:positions-rough-on-purpose).`);
  }
  return problems;
}

/** city:places-stage-their-acts: the rota board's act at every workplace of a country, the one id that may stand at several places. */
const MANY_PLACES: ReadonlySet<Staged> = new Set<Staged>(["activity.overtime"]);

/** city:places-stage-their-acts: every staged id exists, and is staged once for each `where` and country, overtime alone excepted. */
function stagingProblems(content: Content, places: PlaceEntry[]): string[] {
  const problems: string[] = [];
  const stagedAt = new Map<string, Id<"place">>();
  for (const place of places) {
    for (const id of place.stages) {
      if (!exists(content, id)) problems.push(`${place.id}: stages ${id}, which does not exist (city:places-stage-their-acts).`);
      if (MANY_PLACES.has(id)) continue;
      const scope = `${place.where} ${place.country ?? "any"} ${id}`;
      const earlier = stagedAt.get(scope);
      if (earlier !== undefined) problems.push(`${place.id}: stages ${id}, already staged at ${earlier} for the same where and country (city:places-stage-their-acts).`);
      else stagedAt.set(scope, place.id);
    }
  }
  return problems;
}

/** city:ojuelegba-is-the-hub: one hub at home, one in each country, none anywhere else. */
function hubProblems(content: Content, places: PlaceEntry[]): string[] {
  const problems: string[] = [];
  // A content with no places yet (the small test content) has no city to open in.
  if (places.length === 0) return problems;
  const hubs = places.filter((place) => place.hub);
  const home = hubs.filter((place) => place.where === "home");
  if (home.length !== 1) problems.push(`place: ${String(home.length)} hubs at home, not 1 (city:ojuelegba-is-the-hub).`);
  for (const country of Object.keys(content.country)) {
    const there = hubs.filter((place) => place.where === "abroad" && place.country === country);
    if (there.length !== 1) problems.push(`place: ${String(there.length)} hubs in ${country}, not 1 (city:ojuelegba-is-the-hub).`);
  }
  for (const place of hubs) {
    if (place.where === "road" || (place.where === "abroad" && place.country === null)) problems.push(`${place.id}: a hub on the road or in no country (city:ojuelegba-is-the-hub).`);
  }
  return problems;
}

/** city:sponsor-shows-name-only: no sponsor on an institution, a stylised place or a place staging an offer that can be a fraud. */
function sponsorProblems(content: Content, places: PlaceEntry[]): string[] {
  const problems: string[] = [];
  for (const place of places) {
    if (place.sponsor === null) continue;
    if (place.nameKind === "institution" || place.nameKind === "stylised") problems.push(`${place.id}: a sponsor on a place whose name is ${place.nameKind} (city:sponsor-shows-name-only).`);
    const frauds = place.stages.filter((id) => (content.offer[id as Id<"offer">]?.fraudBp ?? 0) > 0);
    if (frauds.length > 0) problems.push(`${place.id}: a sponsor on a place staging ${frauds.join(", ")}, which can be a fraud (city:sponsor-shows-name-only).`);
  }
  return problems;
}

/**
 * city:road-places-are-stylised: the road's offers and set pieces are staged only at a stylised place.
 * A set piece carries no group, so a road set piece is one whose slug starts `road-`.
 */
function roadProblems(content: Content, places: PlaceEntry[]): string[] {
  const problems: string[] = [];
  for (const place of places) {
    if (place.nameKind === "stylised") continue;
    for (const id of place.stages) {
      const roadOffer = content.offer[id as Id<"offer">]?.group === "road";
      if (roadOffer || id.startsWith("setpiece.road-")) problems.push(`${place.id}: stages ${id}, a road id, at a place that is not stylised (city:road-places-are-stylised).`);
    }
  }
  return problems;
}

/** city:place-words-are-text-keys: every place has its words, and a public name's words are its real name. */
function wordProblems(places: PlaceEntry[], words: Readonly<Record<string, string>>): string[] {
  const problems: string[] = [];
  const known = new Set(places.map((place) => place.id as string));
  for (const place of places) {
    const name = words[`${place.id}.name`] ?? "";
    if (name.trim() === "") problems.push(`${place.id}: has no name (city:place-words-are-text-keys).`);
    if ((words[`${place.id}.blurb`] ?? "").trim() === "") problems.push(`${place.id}: has no blurb (city:place-words-are-text-keys).`);
    if (place.nameKind === "public" && place.realName !== null && name !== place.realName) {
      problems.push(`${place.id}: its name reads "${name}", not its real name "${place.realName}" (city:place-words-are-text-keys).`);
    }
  }
  for (const key of Object.keys(words)) {
    const match = SIGN_OR_TALK.exec(key);
    if (match !== null && !known.has(match[1] ?? "")) problems.push(`${key}: words for a place that does not exist (city:place-words-are-text-keys).`);
  }
  return problems;
}

/**
 * The city's content checks: docs/rules/city.md. Pass the words
 * to check city:place-words-are-text-keys as well.
 * `checkContent` has no words to pass, so city:place-words-are-text-keys runs from the tests.
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
