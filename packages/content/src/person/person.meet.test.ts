import { describe, expect, test } from "vitest";

import { content, text } from "../index";
import { meetingThings, partnerMeetings, placesWanted } from "./person.meet.data";
import { institutionProblems } from "./person.names.check";

/** The partners a player can meet: every computer partner but the one that comes only through an offer (R-PEOPLE-050). */
const meetable = Object.values(content.person).filter((person) => person.role === "partner" && !person.behaviour.papers);

const placeKnown = (place: string) => place in content.place || (placesWanted as string[]).includes(place);

describe("the partner met in a place", () => {
  test("[R-WORLD-020] given every computer partner who can be met, when the meetings are read, then each has exactly one, and the partner who comes only through an offer has none", () => {
    expect(partnerMeetings.map((meeting) => meeting.person).sort()).toEqual(meetable.map((person) => person.id).sort());
    expect(partnerMeetings.some((meeting) => content.person[meeting.person]?.behaviour.papers === true)).toBe(false);
  });

  test("[R-WORLD-020] given every meeting, when its places are looked up, then the place met in and the home exist or are asked for, and the one met in has the person as a thing", () => {
    for (const meeting of partnerMeetings) {
      expect(placeKnown(meeting.met.place), meeting.person).toBe(true);
      expect(meetingThings[meeting.met.place] ?? [], meeting.person).toContain(meeting.met.thing);
      expect(placeKnown(meeting.home.place), meeting.person).toBe(true);
      if (meeting.home.near !== null) expect(meeting.home.near in content.place, meeting.person).toBe(true);
    }
  });

  test("[R-WORLD-020] given the places asked for, when content is read, then none is there yet, so the list empties as it is added", () => {
    expect(placesWanted.filter((place) => place in content.place)).toEqual([]);
  });

  test("[R-WORLD-020] given the meetings, when where they happen is read, then partners are met at the meetup, the church and a friend's room", () => {
    const where = new Set(partnerMeetings.map((meeting) => meeting.met.place));
    expect([...where].sort()).toEqual(["place.church", "place.their-room", "place.yaba-hub"]);
  });

  test("[R-WORLD-020] given a partner who lives abroad, when the meeting is read, then they can be met only in December, when they are home, and their home sits near no place in Lagos", () => {
    for (const meeting of partnerMeetings) {
      const abroad = content.person[meeting.person]?.profile.country !== null;
      expect(meeting.decemberOnly, meeting.person).toBe(abroad);
      if (abroad) expect(meeting.home.near, meeting.person).toBeNull();
      else expect(meeting.home.near, meeting.person).not.toBeNull();
    }
  });

  test("[R-WORLD-020] given every meeting, when its words are looked up, then there is a meeting line and a home's name, on one line, with no institution beside a crime", () => {
    const words: Record<string, string> = {};
    for (const meeting of partnerMeetings) {
      for (const key of [`${meeting.person}.met`, `${meeting.person}.home`]) {
        expect((text[key] ?? "").trim(), key).not.toBe("");
        expect(text[key], key).not.toContain("\n");
        words[key] = text[key] ?? "";
      }
    }
    expect(institutionProblems(words)).toEqual([]);
  });
});
