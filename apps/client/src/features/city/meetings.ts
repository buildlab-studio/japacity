// The computer partners met in a place (docs/rules/world.md R-WORLD-020; people.md R-PEOPLE-009, R-PEOPLE-013): nobody
// is picked from a list. Each row of content's meetings (`person.meet.data.ts`) is a person standing at a thing of the
// place it names, while the view's `candidates` lists them and, for one met only in December, while
// `var.season-december` is 1. The thing's one act talks to them; its sheet sends `people/court` (R-CITY-001: the sheet
// sends it, never the scene). Pure: it reads the view's list, the season and the place files, and nothing else.
import { meetingThings, partnerMeetings, text, type PartnerMeeting } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";

import type { Ask, Thing } from "../../shared/world/contract";
import type { PlaceFile, Stage } from "./placeFile";

export const COURT = "people/court";
export const DECEMBER: Id<"var"> = "var.season-december";
/** The place the city opens on map once a bond is courting: one room dressed per person (R-WORLD-020, R-PEOPLE-014). */
export const THEIR_ROOM = "place.their-room";

/** The ids of the things a person stands as at a place. */
export function meetingThingsAt(place: string): Set<string> {
  return new Set(meetingThings[place] ?? []);
}

/** Someone standing at a thing now. */
export interface Standing {
  thing: string;
  person: Id<"person">;
}

/**
 * Who stands in this place now (R-PEOPLE-009, R-PEOPLE-013): each meeting staged here whose person the view lists as a
 * candidate, one met only in December only while it is December. Two meetings share a thing (after the service, a
 * friend of the family): one person stands at a thing at a time, and the one met only in December comes first, since a
 * December passes and the other stays.
 */
export function standingAt(place: string, candidates: PlayerView["people"]["candidates"], december: boolean, meetings: readonly PartnerMeeting[] = partnerMeetings): Standing[] {
  const listed = new Set(candidates.filter((candidate) => candidate.role === "partner").map((candidate) => candidate.person));
  const here = meetings.filter((meeting) => meeting.met.place === place && listed.has(meeting.person) && (!meeting.decemberOnly || december));
  const ordered = [...here.filter((meeting) => meeting.decemberOnly), ...here.filter((meeting) => !meeting.decemberOnly)];
  const taken = new Set<string>();
  return ordered.flatMap((meeting) => {
    if (taken.has(meeting.met.thing)) return [];
    taken.add(meeting.met.thing);
    return [{ thing: meeting.met.thing, person: meeting.person }];
  });
}

/**
 * The place's things with its meetings filled in: a thing a person stands as carries their name, the `computer` mark,
 * and its talk act names them; one nobody stands at now is not there. Every other thing is as the file has it.
 */
export function withMeetings(things: readonly Thing[], place: string, standing: readonly Standing[]): Thing[] {
  const meets = meetingThingsAt(place);
  return things.flatMap((thing) => {
    if (!meets.has(thing.id)) return [thing];
    const who = standing.find((one) => one.thing === thing.id);
    if (who === undefined) return [];
    return [{ ...thing, label: `${who.person}.name`, mark: "computer" as const, acts: thing.acts.map((act) => (act.kind === "command" && act.command === COURT ? { ...act, with: who.person } : act)) }];
  });
}

/** The place's file with only the people standing now, each in their own model where the file names one for them. */
export function withStanding(file: PlaceFile, standing: readonly Standing[]): PlaceFile {
  const stage = file.stage;
  if (stage?.standing === undefined) return file;
  const kept = stage.standing.filter((stander) => standing.some((one) => one.thing === stander.thing && (stander.person === undefined || stander.person === one.person)));
  if (kept.length === stage.standing.length) return file;
  const next: Stage = { ...stage, standing: kept };
  return { ...file, stage: next };
}

/** How many residents give up their places so the crowd and those standing at a thing stay within `cap` (R-WORLD-011). */
export function roomFor(crowd: number, standing: number, cap: number): number {
  return Math.max(0, Math.min(crowd, crowd + standing - cap));
}

/** The crowd with `count` residents fewer, the last first, so those standing at a thing take their places (R-WORLD-011). */
export function makeRoom<T extends { kind: "resident" | "player" }>(people: readonly T[], count: number): T[] {
  let left = count;
  const kept = [...people].reverse().filter((shown) => {
    if (left <= 0 || shown.kind !== "resident") return true;
    left -= 1;
    return false;
  });
  return kept.reverse();
}

/** The bonds courting now, as `people/court` counts them against `tuning.people.maxCourting` (R-PEOPLE-013). */
export function courtingNow(view: Pick<PlayerView, "people">): number {
  return view.people.bonds.filter((bond) => bond.stage === "courting").length;
}

/** True while a bond with a partner is courting or later: their room is on the map (R-WORLD-020). */
export function roomOpen(view: Pick<PlayerView, "people">): boolean {
  return view.people.bonds.some((bond) => bond.role === "partner" && (bond.stage === "courting" || bond.stage === "partner" || bond.stage === "married"));
}

/** The place their room sits near on the map: the home of the first courted computer partner who has one in Lagos, else none. */
export function roomNear(view: Pick<PlayerView, "people">, meetings: readonly PartnerMeeting[] = partnerMeetings): string | null {
  for (const bond of view.people.bonds) {
    if (bond.role !== "partner" || bond.person === null || bond.stage === "ended" || bond.stage === "connected") continue;
    const near = meetings.find((meeting) => meeting.person === bond.person)?.home.near ?? null;
    if (near !== null) return near;
  }
  return null;
}

/** The words the talk sheet needs, handed in so this stays free of the words tables' state. */
export interface TalkWords {
  name: (person: string) => string;
  court: (name: string) => string;
  full: (count: number) => string;
  notYet: string;
  computer: string;
}

/**
 * The talk sheet (R-WORLD-006): a card marked `computer`, with the person's meeting line in their own voice and one button, court them,
 * which sends `people/court` with the person. While `maxCourting` bonds already court, the button is shut, says
 * "Not yet", and the reason stands once on the card (R-PEOPLE-013).
 */
export function talkAsk(person: string, view: Pick<PlayerView, "people">, maxCourting: number, said: TalkWords, act: { send: (person: string) => void; dismiss: () => void }): Ask {
  const name = said.name(person);
  const courting = courtingNow(view);
  const blocked = courting >= maxCourting ? said.full(courting) : null;
  return {
    form: "card",
    icon: "message-circle",
    // The quiet mark the card carries (R-PEOPLE-054): who it is, over their name.
    who: said.computer,
    title: name,
    line: text[`${person}.met`] ?? "",
    cost: null,
    when: "now",
    button: blocked === null ? said.court(name) : said.notYet,
    ...(blocked === null ? {} : { blocked }),
    act: () => act.send(person),
    dismiss: act.dismiss,
  };
}
