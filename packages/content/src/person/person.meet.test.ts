import { describe, expect, test } from "vitest";

import { content, text } from "../index";
import { meetingThings, partnerMeetings, placesWanted } from "./person.meet.data";
import { institutionProblems } from "./person.names.check";

/** The partners a player can meet: every computer partner but the one that comes only through an offer (person:papers-marriage-offer). */
const meetable = Object.values(content.person).filter((person) => person.role === "partner" && !person.behaviour.papers);

const placeKnown = (place: string) => place in content.place || (placesWanted as string[]).includes(place);

describe("the partner met in a place", () => {
  test("[world:nobody-picked-from-list] given every computer partner who can be met, when the meetings are read, then each has exactly one, and the partner who comes only through an offer has none", () => {
    expect(partnerMeetings.map((meeting) => meeting.person).sort()).toEqual(meetable.map((person) => person.id).sort());
    expect(partnerMeetings.some((meeting) => content.person[meeting.person]?.behaviour.papers === true)).toBe(false);
  });

  test("[world:nobody-picked-from-list] given every meeting, when its places are looked up, then the place met in and the home exist or are asked for, and the one met in has the person as a thing", () => {
    const problems = partnerMeetings.flatMap((meeting) => [
      ...(placeKnown(meeting.met.place) ? [] : [`${meeting.person} is met at ${meeting.met.place}`]),
      ...((meetingThings[meeting.met.place] ?? []).includes(meeting.met.thing) ? [] : [`${meeting.person} stands as ${meeting.met.thing}`]),
      ...(placeKnown(meeting.home.place) ? [] : [`${meeting.person} lives at ${meeting.home.place}`]),
      ...(meeting.home.near === null || meeting.home.near in content.place ? [] : [`${meeting.person} lives near ${meeting.home.near}`]),
    ]);
    expect(problems).toEqual([]);
  });

  test("[world:nobody-picked-from-list] given the places asked for, when content is read, then none of them is in content, so the list holds only what is missing", () => {
    expect(placesWanted.filter((place) => place in content.place)).toEqual([]);
  });

  // The meetup's two at the hub's meetup; after the service and a friend of the family at the family house, as the church is not a built place.
  test("[world:nobody-picked-from-list] given the meetings, when where they happen is read, then partners are met at the hub's meetup and at the family house, never in their room", () => {
    const where = new Set(partnerMeetings.map((meeting) => meeting.met.place));
    expect([...where].sort()).toEqual(["place.family-house", "place.yaba"]);
  });

  test("[world:nobody-picked-from-list] given a partner who lives abroad, when the meeting is read, then they can be met only in December, when they are home, and their home sits near no place in Lagos", () => {
    const abroad = (person: string) => content.person[person as keyof typeof content.person]?.profile.country !== null;
    expect(partnerMeetings.filter((meeting) => meeting.decemberOnly !== abroad(meeting.person)).map((meeting) => meeting.person)).toEqual([]);
    expect(partnerMeetings.filter((meeting) => abroad(meeting.person) !== (meeting.home.near === null)).map((meeting) => meeting.person)).toEqual([]);
    expect(partnerMeetings.filter((meeting) => !abroad(meeting.person))).not.toHaveLength(0);
  });

  test("[world:nobody-picked-from-list] given every meeting, when its words are looked up, then there is a meeting line and a home's name, on one line, with no institution beside a crime", () => {
    const keys = partnerMeetings.flatMap((meeting) => [`${meeting.person}.met`, `${meeting.person}.home`]);
    expect(keys.filter((key) => (text[key] ?? "").trim() === "" || (text[key] ?? "").includes("\n"))).toEqual([]);
    const words = Object.fromEntries(keys.map((key) => [key, text[key] ?? ""]));
    expect(institutionProblems(words)).toEqual([]);
  });

  // Once courted, the person answers in their own voice; if the bond
  // ends without the player ending it, the reason is theirs too.
  test("[person:courting-opens-a-bond] [person:computer-partner-drifts] [person:gossip-when-two-timing] given every partner who can be met, when their words are looked up, then there is an answer once courted, a reason for stopping waiting and a reason for leaving, each one line in quotes, with no institution beside a crime", () => {
    const keys = partnerMeetings.flatMap((meeting) => [`${meeting.person}.courted`, `${meeting.person}.drifted`, `${meeting.person}.left`]);
    expect(keys.filter((key) => (text[key] ?? "").trim() === "" || (text[key] ?? "").includes("\n"))).toEqual([]);
    expect(keys.filter((key) => !/^".+"$/.test(text[key] ?? ""))).toEqual([]);
    const words = Object.fromEntries(keys.map((key) => [key, text[key] ?? ""]));
    expect(institutionProblems(words)).toEqual([]);
  });
});
