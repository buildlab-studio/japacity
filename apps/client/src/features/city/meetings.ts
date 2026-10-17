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

/**
 * The place's file with only the people standing now at its meetings, each in their own model where the file names one
 * for them. Someone a dressing stands as themselves, at no meeting (their room's partner), stays.
 */
export function withStanding(file: PlaceFile, standing: readonly Standing[]): PlaceFile {
  const stage = file.stage;
  if (stage?.standing === undefined) return file;
  const meets = meetingThingsAt(file.place);
  const kept = stage.standing.filter((stander) => !meets.has(stander.thing) || standing.some((one) => one.thing === stander.thing && (stander.person === undefined || stander.person === one.person)));
  if (kept.length === stage.standing.length) return file;
  const next: Stage = { ...stage, standing: kept };
  return { ...file, stage: next };
}

/** How many residents give up their places so the crowd and those standing at a thing stay within `cap` (R-WORLD-011). */
export function roomFor(crowd: number, standing: number, cap: number): number {
  return Math.max(0, Math.min(crowd, crowd + standing - cap));
}

/**
 * The crowd with `count` people fewer, so those standing at a thing take their places (R-WORLD-011): residents
 * with no part first, then players, the last first each time. A resident at a part is never taken (R-CITY-032).
 */
export function makeRoom<T extends { kind: "resident" | "player"; part?: number }>(people: readonly T[], count: number): T[] {
  const filler = people.filter((shown) => shown.kind === "resident" && shown.part === undefined);
  const players = people.filter((shown) => shown.kind === "player");
  const gone = new Set([...filler.reverse(), ...players.reverse()].slice(0, Math.max(0, count)));
  return people.filter((shown) => !gone.has(shown));
}

/** The bonds courting now, as `people/court` counts them against `tuning.people.maxCourting` (R-PEOPLE-013). */
export function courtingNow(view: Pick<PlayerView, "people">): number {
  return view.people.bonds.filter((bond) => bond.stage === "courting").length;
}

/** The stages of a bond from courting on: their room is open (R-WORLD-020). */
const COURTED: ReadonlySet<string> = new Set(["courting", "partner", "married"]);

/** True while a bond with a partner is courting or later: their room is on the map (R-WORLD-020). */
export function roomOpen(view: Pick<PlayerView, "people">): boolean {
  return view.people.bonds.some((bond) => bond.role === "partner" && COURTED.has(bond.stage));
}

/**
 * Whose room their room is now (R-WORLD-020): the computer partner of a bond courting or later, the one whose home the
 * room sits near on the map when there is one (`roomNear`), else the first; null for none, or a bond with a player,
 * and the room is plain.
 */
export function roomPartner(view: Pick<PlayerView, "people">, meetings: readonly PartnerMeeting[] = partnerMeetings): Id<"person"> | null {
  const courted = view.people.bonds.flatMap((bond) => (bond.role === "partner" && bond.person !== null && COURTED.has(bond.stage) ? [bond.person] : []));
  const homes = courted.flatMap((person) => meetings.filter((meeting) => meeting.person === person));
  return (homes.find((meeting) => meeting.home.near !== null) ?? homes[0])?.person ?? null;
}

/**
 * The people a dressing stands in a place as themselves, at no thing of its file: their room's partner (R-WORLD-020). Each
 * is a thing with their name and the `computer` mark (R-PEOPLE-054) and no act of its own, since the bond's choices
 * live in Chats and the visit on the room's chair (R-PEOPLE-014).
 */
export function standingAsThemselves(stage: Pick<Stage, "standing" | "things">): Thing[] {
  const declared = new Set((stage.things ?? []).map((thing) => thing.id));
  return (stage.standing ?? []).flatMap((one) => (one.person === undefined || declared.has(one.thing) ? [] : [{ id: one.thing, file: one.file, copy: 0, label: `${one.person}.name`, mark: "computer" as const, acts: [] }]));
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
  /** The cost of seeing someone new beside a partner (R-PEOPLE-041), given the partner's person id (null for a friend) and the new name. */
  partnered: (partner: string | null, name: string) => string;
}

/** The bonds together now: partner or married, where gossip about anyone else courted follows (R-PEOPLE-018, R-PEOPLE-041). */
const TOGETHER: ReadonlySet<string> = new Set(["partner", "married"]);

/** The bond at partner or married, which hears of anyone else courted (R-PEOPLE-041), or null. */
export function togetherBond(view: Pick<PlayerView, "people">): PlayerView["people"]["bonds"][number] | null {
  return view.people.bonds.find((bond) => bond.role === "partner" && TOGETHER.has(bond.stage)) ?? null;
}

/**
 * The talk sheet (R-WORLD-006): a card marked `computer`, with the person's meeting line in their own voice and one button, court them,
 * which sends `people/court` with the person. While `maxCourting` bonds already court, the button is shut, says
 * "Not yet", and the reason stands once on the card (R-PEOPLE-013). Beside a partner, the button's second line says
 * what it costs if word gets out (R-PEOPLE-041).
 */
export function talkAsk(person: string, view: Pick<PlayerView, "people">, maxCourting: number, said: TalkWords, act: { send: (person: string) => void; dismiss: () => void }): Ask {
  const name = said.name(person);
  const courting = courtingNow(view);
  const blocked = courting >= maxCourting ? said.full(courting) : null;
  // R-PEOPLE-041: beside a partner, seeing someone new is talked about; the button's second line says so before the tap.
  // Courting beside courting costs nothing in the rules, so then the card says nothing more.
  const together = togetherBond(view);
  const note = blocked === null && together !== null ? said.partnered(together.person, name) : null;
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
    ...(note === null ? {} : { note }),
    act: () => act.send(person),
    dismiss: act.dismiss,
  };
}

/**
 * What the corner tells once a computer partner is courted (R-PEOPLE-013): their
 * answer in their own words, `<person>.courted`, said as theirs ("Tobi: ..."), then the one plain line that they live
 * in the game (R-PEOPLE-054). Their answer is left out where content has none.
 */
export function courtedTold(person: string, said: { name: (person: string) => string; answer: (person: string) => string | null; said: (name: string, line: string) => string; chosen: (name: string) => string }): string[] {
  const name = said.name(person);
  const answer = said.answer(person);
  return [...(answer === null ? [] : [said.said(name, answer)]), said.chosen(name)];
}
