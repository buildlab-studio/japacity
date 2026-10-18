// Where each computer partner is met, and their home: world:nobody-picked-from-list. The pair rules
// keep working underneath: the meeting is what `people/court` needs in place of a row in `candidates`.
// The words are `<person id>.met` (the line when you meet) and `<person id>.home` (their home's name)
// in person.text.ts.
// The view's `candidates` is only what the world reads to know who stands where (person:computer-candidates-labelled and
// person:courting-opens-a-bond): the city stands each row's person at its thing while the list holds them, a `decemberOnly` one only while `var.season-december` is 1, and the thing's
// sheet sends `people/court` (apps/client/src/features/city/meetings.ts).
// The church is not a built place, so the people met after the service are met at
// the family house (after the service the family comes home with a guest), and a friend's guest is a friend of the
// family visiting there, since a friend's room before courting would contradict their room opening only once courting
// (world:nobody-picked-from-list). The meetup's two stand at the meetup itself, in the hub (`place.yaba`).
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
 * The places the meetings need that content does not hold as entries; empty while every meeting's place is in content.
 * `place.their-room` is one stylised interior with no position, dressed per person as the room
 * abroad is dressed per country: a partner's home, where nobody is met. Its place file has one dressing for each person here whose home it is, a prop or two and the partner standing
 * in it alone, in the model they are met in (apps/client/public/assets/places/their-room/place.json).
 */
export const placesWanted: Id<"place">[] = [];

const THEIR_ROOM: Id<"place"> = "place.their-room";
const FAMILY_HOUSE: Id<"place"> = "place.family-house";

/** The things a person stands as, by place: the person's own id in the place file. */
export const meetingThings: Record<string, string[]> = {
  "place.family-house": ["after-service", "friend-guest"],
  "place.yaba": ["meetup-speaker", "meetup-guest"],
};

export const partnerMeetings: PartnerMeeting[] = [
  { person: "person.tobi-bank", met: { place: FAMILY_HOUSE, thing: "after-service" }, decemberOnly: false, home: { place: THEIR_ROOM, near: "place.bode-thomas" } },
  { person: "person.amaka-nurse", met: { place: FAMILY_HOUSE, thing: "friend-guest" }, decemberOnly: false, home: { place: THEIR_ROOM, near: "place.ojuelegba" } },
  { person: "person.kelechi-dev", met: { place: "place.yaba", thing: "meetup-speaker" }, decemberOnly: true, home: { place: THEIR_ROOM, near: null } },
  { person: "person.funmi-uk", met: { place: FAMILY_HOUSE, thing: "after-service" }, decemberOnly: true, home: { place: THEIR_ROOM, near: null } },
  { person: "person.ifeoma-ca", met: { place: "place.yaba", thing: "meetup-guest" }, decemberOnly: true, home: { place: THEIR_ROOM, near: null } },
  { person: "person.chidi-dubai", met: { place: FAMILY_HOUSE, thing: "friend-guest" }, decemberOnly: true, home: { place: THEIR_ROOM, near: null } },
];
