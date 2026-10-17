// The real-name check: docs/rules/city.md R-CITY-022, R-CITY-023 and R-CITY-041.
// It reads the place table and the register of real names on signs (place.real.ts).
import type { Content, Id, PlaceEntry } from "@japacity/sim";

import type { RealNameEntry, RealNameTrade } from "./place.real";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const SIGN = /^(place\.[a-z0-9]+(?:-[a-z0-9]+)*)\.sign\.[0-9]+$/;

/** The trades that lend, charge, employ, sponsor, refuse, or can cheat or fail (R-CITY-041). */
const INVENTED_ONLY: ReadonlySet<RealNameTrade> = new Set<RealNameTrade>(["bank", "lender", "agent", "employer", "sponsor", "school", "airline"]);

type Staged = PlaceEntry["stages"][number];

/** A staged offer that can be a fraud, a mishap or bad news. */
function harmful(content: Content, id: Staged): boolean {
  const offer = content.offer[id as Id<"offer">];
  if (offer === undefined) return false;
  return offer.fraudBp > 0 || (offer.kinds?.fraud ?? 0) > 0 || offer.bad === true || offer.group === "road";
}

/** What a staged id makes the place do that only an invented name may do, or null. */
function institutional(content: Content, id: Staged): string | null {
  const offer = content.offer[id as Id<"offer">];
  if (offer !== undefined) return offer.group === "job" || offer.group === "money" ? `lends, charges or employs through ${id}` : null;
  const activity = content.activity[id as Id<"activity">];
  if (activity !== undefined) {
    if (activity.pay !== null) return `employs through ${id}`;
    if (activity.sponsor === true) return `sponsors through ${id}`;
    if (activity.param === "school") return `is a school through ${id}`;
    if (activity.cost.length > 0) return `charges through ${id}`;
    return null;
  }
  if (content.setpiece[id as Id<"setpiece">] !== undefined) return `stages ${id}, which can refuse`;
  return null;
}

/** R-CITY-022, R-CITY-023, R-CITY-041: the real names the place table carries. */
function placeProblems(content: Content, places: PlaceEntry[]): string[] {
  const problems: string[] = [];
  for (const place of places) {
    if (place.realName === null) continue;
    if (place.where === "road") problems.push(`${place.id}: the road's place carries the real name ${place.realName} (R-CITY-023).`);
    // public places (R-CITY-005) keep their own names whatever they stage; the rest binds the names R-CITY-022 allows.
    if (place.nameKind === "public") continue;
    const frauds = place.stages.filter((id) => harmful(content, id));
    if (frauds.length > 0) problems.push(`${place.id}: carries the real name ${place.realName} and stages ${frauds.join(", ")}, which can be a fraud, a mishap or bad news (R-CITY-022).`);
    for (const id of place.stages) {
      const why = institutional(content, id);
      if (why !== null) problems.push(`${place.id}: carries the real name ${place.realName} and ${why}; only an invented name may (R-CITY-041).`);
    }
  }
  return problems;
}

/** The words of every text key outside the places, where a real name must never stand: offers, schools, news, routes and the rest. */
function wordsElsewhere(words: Readonly<Record<string, string>>): [string, string][] {
  return Object.entries(words).filter(([key]) => !key.startsWith("place."));
}

function mentions(words: string, name: string): boolean {
  return words.replace(/\s+/g, " ").toLowerCase().includes(name.toLowerCase());
}

/** R-CITY-022, R-CITY-041: the real names on signs. */
function signProblems(content: Content, words: Readonly<Record<string, string>>, register: Readonly<Record<string, RealNameEntry>>): string[] {
  const problems: string[] = [];
  const elsewhere = wordsElsewhere(words);
  for (const [key, entry] of Object.entries(register)) {
    if (key !== entry.sign) problems.push(`${key}: the register's entry is for the sign ${entry.sign} (R-CITY-022).`);
    const placeId = SIGN.exec(entry.sign)?.[1] as Id<"place"> | undefined;
    const place = placeId === undefined ? undefined : content.place[placeId];
    if (place === undefined) {
      problems.push(`${entry.sign}: is not the sign of a place (R-CITY-022).`);
      continue;
    }
    if (!entry.source.url.startsWith("https://") || !DAY.test(entry.source.readOn) || entry.source.title.trim() === "") {
      problems.push(`${entry.sign}: has no source with a title, an https link and the day it was read (R-CITY-022).`);
    }
    const shown = entry.realName === null ? entry.plain : entry.words;
    if (words[entry.sign] !== shown) problems.push(`${entry.sign}: shows "${words[entry.sign] ?? ""}", not its register's words "${shown}" (R-CITY-022).`);
    if (entry.realName === null) continue;
    const name = entry.realName;
    if (!mentions(entry.words, name)) problems.push(`${entry.sign}: its words "${entry.words}" do not hold its real name ${name} (R-CITY-022).`);
    if (mentions(entry.plain, name)) problems.push(`${entry.sign}: its plain words still hold the real name ${name} (R-CITY-022).`);
    if (INVENTED_ONLY.has(entry.trade)) problems.push(`${entry.sign}: the real name ${name} on a ${entry.trade}, which only an invented name may be (R-CITY-041).`);
    if (place.where === "road" || place.nameKind === "stylised") problems.push(`${entry.sign}: the real name ${name} at ${place.id}, a stylised place (R-CITY-023).`);
    if (entry.trade === "public" && !Object.values(content.place).some((other) => other.nameKind === "public" && other.realName === name)) {
      problems.push(`${entry.sign}: the real name ${name} is called public but is no public place's name (R-CITY-005).`);
    }
    if (entry.trade !== "public") {
      const frauds = place.stages.filter((id) => harmful(content, id));
      if (frauds.length > 0) problems.push(`${entry.sign}: the real name ${name} at ${place.id}, which stages ${frauds.join(", ")}, which can be a fraud, a mishap or bad news (R-CITY-022).`);
      const leaks = elsewhere.filter(([, other]) => mentions(other, name)).map(([other]) => other);
      if (leaks.length > 0) problems.push(`${entry.sign}: the real name ${name} also stands in ${leaks.join(", ")}, outside the places (R-CITY-041).`);
    }
  }
  return problems;
}

/**
 * The real-name check (R-CITY-041): fails a real name on anything that lends, charges, employs,
 * sponsors, refuses, or can cheat or fail, and on the road's places. Empty when sound.
 */
export function realNameChecks(content: Content, words: Readonly<Record<string, string>>, register: Readonly<Record<string, RealNameEntry>>): string[] {
  return [...placeProblems(content, Object.values(content.place)), ...signProblems(content, words, register)];
}
