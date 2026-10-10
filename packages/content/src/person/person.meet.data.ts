// Where each computer partner is met, and their home: docs/rules/world.md R-WORLD-020. The pair rules
// keep working underneath: the meeting is what `people/court` needs in place of a row in `candidates`.
// The words are `<person id>.met` (the line when you meet) and `<person id>.home` (their home's name)
// in person.text.ts.
// the people kind still lists `candidates` and courts from that list (people.md
// R-PEOPLE-009, R-PEOPLE-013); this table is the content side until someone adds those rules.
import type { Id } from "@japacity/sim";

export interface PartnerMeeting {
  person: Id<"person">;
  /** The place and the thing (a person standing there) where you meet. */
  met: { place: Id<"place">; thing: string };
  /** Abroad partners are home only for December, so they can be met only then. */
  decemberOnly: boolean;
  /** Their home: one stylised room, dressed for each person, and the shipped place it sits near on the map, or null abroad. */
  home: { place: Id<"place">; near: Id<"place"> | null };
}

/**
 * The places the meetings need that content does not have yet, for the maintainer to add as entries.
 * `place.their-room` is one stylised interior with no position, dressed per person as the room
 * abroad is dressed per country: a friend's room where people meet, and a partner's home.
 */
export const placesWanted: Id<"place">[] = [];

const THEIR_ROOM: Id<"place"> = "place.their-room";

/** The things a person stands as, by place: the person's own id in the place file. */
export const meetingThings: Record<string, string[]> = {
  "place.church": ["after-service"],
  "place.yaba-hub": ["meetup-speaker", "meetup-guest"],
  "place.their-room": ["friend-guest"],
};

export const partnerMeetings: PartnerMeeting[] = [
  { person: "person.tobi-bank", met: { place: "place.church", thing: "after-service" }, decemberOnly: false, home: { place: THEIR_ROOM, near: "place.bode-thomas" } },
  { person: "person.amaka-nurse", met: { place: THEIR_ROOM, thing: "friend-guest" }, decemberOnly: false, home: { place: THEIR_ROOM, near: "place.ojuelegba" } },
  { person: "person.kelechi-dev", met: { place: "place.yaba-hub", thing: "meetup-speaker" }, decemberOnly: true, home: { place: THEIR_ROOM, near: null } },
  { person: "person.funmi-uk", met: { place: "place.church", thing: "after-service" }, decemberOnly: true, home: { place: THEIR_ROOM, near: null } },
  { person: "person.ifeoma-ca", met: { place: "place.yaba-hub", thing: "meetup-guest" }, decemberOnly: true, home: { place: THEIR_ROOM, near: null } },
  { person: "person.chidi-dubai", met: { place: THEIR_ROOM, thing: "friend-guest" }, decemberOnly: true, home: { place: THEIR_ROOM, near: null } },
];
