// The guides' content checks (docs/rules/guides.md, Contract) and the staleness rule
// (R-GUIDE-004). Today's date is always passed in: nothing here reads a clock.
import type { Content, KindName } from "@japacity/sim";
import type { Proof, Same } from "@japacity/sim/schemas";

import { GUIDE_SECTIONS } from "./guide.data";

const KIND_NAMES = [
  "advert",
  "guide",
  "turn",
  "quality",
  "activity",
  "wallet",
  "document",
  "school",
  "route",
  "setpiece",
  "obligation",
  "offer",
  "chapter",
  "news",
  "var",
  "scenario",
  "place",
  "status",
  "credit",
  "goal",
  "prologue",
  "lottery",
  "people",
  "person",
  "interview",
  "phrase",
  "era",
  "country",
  "points",
] as const;

/** Fails to compile if the contract gains or loses a kind without this list following. */
export type KindNamesListed = Proof<Same<(typeof KIND_NAMES)[number], KindName>>;

const KINDS: ReadonlySet<string> = new Set(KIND_NAMES);

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

interface Day {
  year: number;
  month: number;
  day: number;
}

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysIn(year: number, month: number): number {
  if (month === 2) return isLeap(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** A `YYYY-MM-DD` date that exists on the calendar, or null. */
export function parseDay(text: string): Day | null {
  const match = DAY.exec(text);
  if (match === null) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysIn(year, month)) return null;
  return { year, month, day };
}

function ordinal(day: Day): number {
  return (day.year * 12 + day.month) * 32 + day.day;
}

/** The same day `months` later, held to the month's last day (31 Aug plus six months is 28 or 29 Feb). */
export function addMonths(day: Day, months: number): Day {
  const index = day.year * 12 + (day.month - 1) + months;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  return { year, month, day: Math.min(day.day, daysIn(year, month)) };
}

/**
 * R-GUIDE-004: the guides not checked for `tuning.guide.staleMonths` months on `today`, by id.
 * a guide checked exactly that many months ago is still fresh; one day more and it is listed.
 */
export function staleGuides(content: Content, today: string): string[] {
  const now = parseDay(today);
  if (now === null) throw new Error(`Not a date: ${today}. Give it as YYYY-MM-DD.`);
  return Object.values(content.guide)
    .filter((guide) => {
      const checked = parseDay(guide.checkedOn);
      return checked === null || ordinal(now) > ordinal(addMonths(checked, content.tuning.guide.staleMonths));
    })
    .map((guide) => guide.id)
    .sort();
}

/** The text keys a guide's page reads: its title and each section. */
export function guideKeys(id: string, sections: readonly string[]): string[] {
  return [`${id}.title`, ...sections.map((section) => `${id}.section.${section}`)];
}

/** Sentences describing what is wrong with the guides. Empty when they are sound. */
export function guideChecks(content: Content, text: Record<string, string>): string[] {
  const problems: string[] = [];
  const guides = Object.values(content.guide);
  for (const route of Object.keys(content.route)) {
    const covering = guides.filter((guide) => (guide.routes as string[]).includes(route));
    if (covering.length !== 1) problems.push(`${route}: has ${String(covering.length)} guides, not one (R-GUIDE-002).`);
  }
  for (const guide of guides) {
    if (guide.sources.length === 0) problems.push(`${guide.id}: has no source (R-GUIDE-001).`);
    const checked = parseDay(guide.checkedOn);
    if (checked === null) problems.push(`${guide.id}: checkedOn ${guide.checkedOn} is not a date (R-GUIDE-001).`);
    for (const source of guide.sources) {
      const read = parseDay(source.readOn);
      if (read === null) problems.push(`${guide.id}: ${source.url} has no date read (R-GUIDE-001).`);
      else if (checked !== null && ordinal(read) > ordinal(checked)) problems.push(`${guide.id}: ${source.url} was read after the guide was checked (R-GUIDE-001).`);
      if (!source.url.startsWith("https://")) problems.push(`${guide.id}: ${source.url} is not an https link (R-GUIDE-001).`);
    }
    for (const route of guide.routes) {
      if (content.route[route] === undefined) problems.push(`${guide.id}: names ${route}, which does not exist.`);
    }
    if (guide.routes.length > 0 && GUIDE_SECTIONS.some((section) => !guide.sections.includes(section))) {
      problems.push(`${guide.id}: a route's guide needs the parts ${GUIDE_SECTIONS.join(", ")} (R-GUIDE-002).`);
    }
    for (const kind of guide.kinds) {
      if (!KINDS.has(kind)) problems.push(`${guide.id}: ${kind} is not a kind.`);
    }
    for (const key of guideKeys(guide.id, guide.sections)) {
      if ((text[key] ?? "").trim() === "") problems.push(`${guide.id}: ${key} has no words.`);
    }
  }
  return problems;
}
