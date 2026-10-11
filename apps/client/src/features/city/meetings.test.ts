// The computer partners met in a place (docs/rules/world.md R-WORLD-020; people.md R-PEOPLE-009, R-PEOPLE-013,
// R-PEOPLE-014, built in the world 11 Oct 2026): each stands as a thing only in the place content meets them in,
// only while the view lists them, one met only in December only in December; the thing's one act opens a card whose
// button sends `people/court`. Real content, a real life played through the engine.
import { content, partnerMeetings, text } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import inverterRoom from "../../../public/assets/places/inverter-room/place.json";
import theirRoom from "../../../public/assets/places/their-room/place.json";
import { courted, peopleGame, TOBI } from "../../shared/testing/people";
import { nameOf, say } from "../../shared/words/text";
import { actsOffered } from "./acts";
import { COURT, makeRoom, meetingThingsAt, metAt, roomNear, roomOpen, standingAt, STAND_IN, talkAsk, THEIR_ROOM, withMeetings, withStanding, type TalkWords } from "./meetings";
import { type PlaceFile, stageOf } from "./placeFile";
import { stagedNow, thingsNow, thingsOf } from "./things";

const HUB = "place.yaba-hub";
const HAUWA: Id<"person"> = "person.amaka-nurse";
const KELECHI: Id<"person"> = "person.kelechi-dev";
const EJIRO: Id<"person"> = "person.funmi-uk";
const UDUAK: Id<"person"> = "person.ifeoma-ca";
const TONYE: Id<"person"> = "person.chidi-dubai";
const hub = inverterRoom as unknown as PlaceFile;
const room = theirRoom as unknown as PlaceFile;
const maxCourting = content.tuning.people.maxCourting;

const WORDS: TalkWords = {
  name: nameOf,
  court: (name) => say("ui.people.court", { name }),
  full: (count) => say("ui.people.court.full", { count }),
  notYet: say("ui.needs.not-yet"),
  computer: say("ui.people.mark.computer"),
};

/** Tunde's life one month in: the computer partners the view lists for a grown man at home. */
function tunde(): ReturnType<typeof peopleGame> {
  const game = peopleGame();
  game.grant(1);
  game.endTurn([]);
  return game;
}

/** The things a player can act on at a place now, as the city reads them: meetings filled in, the talk act offered. */
function actsHere(file: PlaceFile, place: string, view: PlayerView, december: boolean): Record<string, string[]> {
  const stage = stageOf(withStanding(file, standingAt(place, view.people.candidates, december)));
  const standing = standingAt(place, view.people.candidates, december);
  const offered = new Set([...actsOffered(view), `command:${COURT}`]);
  const staged = new Set<string>(content.place[place as Id<"place">]?.stages ?? []);
  const things = thingsNow(withMeetings(thingsOf(stage), place, standing), stagedNow(offered, staged, new Set(), null, view.chapter.current));
  return Object.fromEntries(things.map((thing) => [thing.id, thing.acts.map((act) => act.with ?? act.stages ?? act.kind)]));
}

describe("a person standing where content meets them", () => {
  test("[R-PEOPLE-009] [R-WORLD-020] given Tunde's first month, when the hub is read, then each candidate content meets there stands as a thing named by them with the computer mark, its one act courts them, and nobody stands in a place content does not meet them in", () => {
    const view = tunde().view();
    const listed = view.people.candidates.map((candidate) => candidate.person);
    expect(listed).toEqual(expect.arrayContaining([TOBI, HAUWA]));
    const standing = standingAt(HUB, view.people.candidates, false);
    // The church has no stage file: its meeting stands at the hub (the brief of m68), the person met there Tobi.
    expect(STAND_IN["place.church"]).toBe(HUB);
    expect(standing).toEqual([{ thing: "after-service", person: TOBI }]);
    const things = withMeetings(thingsOf(stageOf(hub)), HUB, standing);
    const tobi = things.find((thing) => thing.id === "after-service");
    expect(tobi).toMatchObject({ label: `${TOBI}.name`, mark: "computer" });
    expect(tobi?.acts).toEqual([expect.objectContaining({ kind: "command", command: COURT, with: TOBI })]);
    // The meetup's two stand only in December: their things are not in the room.
    expect(things.map((thing) => thing.id)).not.toContain("meetup-speaker");
    expect(things.map((thing) => thing.id)).not.toContain("meetup-guest");
    // A place content meets nobody in has nobody standing.
    for (const place of ["place.ojuelegba", "place.yaba", "place.family-house", "place.bode-thomas"]) expect(standingAt(place, view.people.candidates, true)).toEqual([]);
    // Every person standing anywhere is one the view lists, at the place their meeting names.
    const anywhere = partnerMeetings.flatMap((meeting) => standingAt(metAt(meeting), view.people.candidates, true)).map((one) => one.person);
    expect(anywhere.filter((person) => !listed.includes(person))).toEqual([]);
  });

  test("[R-PEOPLE-009] [R-WORLD-020] given Tobi courted, when the view no longer lists him, then he stands nowhere: the hub's thing and the person standing at it are gone", () => {
    const game = tunde();
    courted(game, TOBI);
    const view = game.view();
    expect(view.people.candidates.map((candidate) => candidate.person)).not.toContain(TOBI);
    const standing = standingAt(HUB, view.people.candidates, false);
    expect(standing).toEqual([]);
    expect(withMeetings(thingsOf(stageOf(hub)), HUB, standing).map((thing) => thing.id)).not.toContain("after-service");
    expect(stageOf(withStanding(hub, standing)).standing).toEqual([]);
    expect(Object.keys(actsHere(hub, HUB, view, false))).not.toContain("after-service");
  });

  test("[R-PEOPLE-013] [R-WORLD-020] given a person met only in December, when it is not December they stand nowhere, and in December they stand at the meetup, the one met only in December taking a thing two share", () => {
    const view = tunde().view();
    const listed = view.people.candidates.map((candidate) => candidate.person);
    expect(listed).toEqual(expect.arrayContaining([KELECHI, EJIRO, UDUAK]));
    expect(standingAt(HUB, view.people.candidates, false).map((one) => one.person)).toEqual([TOBI]);
    const december = standingAt(HUB, view.people.candidates, true);
    expect(december).toEqual(expect.arrayContaining([{ thing: "meetup-speaker", person: KELECHI }, { thing: "meetup-guest", person: UDUAK }, { thing: "after-service", person: EJIRO }]));
    expect(december).toHaveLength(3);
    // After the service, Ejiro stands in her own model, Tobi's goes.
    const standers = stageOf(withStanding(hub, december)).standing ?? [];
    expect(standers.filter((one) => one.thing === "after-service").map((one) => one.person)).toEqual([EJIRO]);
    expect(Object.entries(actsHere(hub, HUB, view, true)).filter(([, acts]) => acts.some((one) => one.startsWith("person."))).map(([id, acts]) => [id, acts])).toEqual(
      expect.arrayContaining([
        ["meetup-speaker", [KELECHI]],
        ["meetup-guest", [UDUAK]],
        ["after-service", [EJIRO]],
      ]),
    );
    // Once Ejiro is courted, Tobi has the place after the service again.
    const game = tunde();
    courted(game, EJIRO);
    expect(standingAt(HUB, game.view().people.candidates, true).find((one) => one.thing === "after-service")?.person).toBe(TOBI);
  });

  test("[R-WORLD-020] given each meeting, when the city reads where it stands, then the place it stands at declares its thing with one talk act and someone to stand there for each person it meets", () => {
    const files: Record<string, PlaceFile> = { [HUB]: hub, [THEIR_ROOM]: room };
    for (const meeting of partnerMeetings) {
      const at = metAt(meeting);
      const file = files[at];
      expect(file, `${meeting.person} stands at ${at}`).toBeDefined();
      const stage = stageOf(file!);
      expect(meetingThingsAt(at).has(meeting.met.thing)).toBe(true);
      const thing = stage.things?.find((one) => one.id === meeting.met.thing);
      expect(thing?.acts).toEqual([expect.objectContaining({ kind: "command", command: COURT })]);
      const standers = (stage.standing ?? []).filter((one) => one.thing === meeting.met.thing && (one.person === undefined || one.person === meeting.person));
      expect(standers, `someone stands for ${meeting.person}`).toHaveLength(1);
      expect(file!.people.sample).toContain(standers[0]?.file);
    }
  });

  test("[R-WORLD-011] given two people standing at their things, when the crowd is drawn, then two residents give up their places and a player keeps theirs", () => {
    const crowd = [
      { slot: 0, kind: "resident" as const },
      { slot: 1, kind: "resident" as const },
      { slot: 2, kind: "resident" as const },
      { slot: 3, kind: "player" as const },
    ];
    expect(makeRoom(crowd, 2).map((one) => one.slot)).toEqual([0, 3]);
    expect(makeRoom(crowd, 0)).toEqual(crowd);
  });
});

describe("the talk sheet", () => {
  test("[R-PEOPLE-013] [R-WORLD-020] [R-WORLD-006] given Tobi standing at the hub, when he is talked to, then the card carries the computer mark, his meeting line and one button that courts him, and its button sends people/court with him", () => {
    const game = tunde();
    const sent: string[] = [];
    const ask = talkAsk(TOBI, game.view(), maxCourting, WORDS, { send: (person) => sent.push(person), dismiss: () => undefined });
    expect(ask.who).toBe(say("ui.people.mark.computer"));
    expect(ask.title).toBe(nameOf(TOBI));
    expect(ask.line).toBe(text[`${TOBI}.met`]);
    expect(ask.button).toBe(say("ui.people.court", { name: nameOf(TOBI) }));
    expect(ask.blocked).toBeUndefined();
    expect(ask.cost).toBeNull();
    ask.act();
    expect(sent).toEqual([TOBI]);
    // What the button sends, the engine takes: the bond opens at courting.
    game.accept({ type: COURT, with: sent[0] as Id<"person"> });
    expect(game.view().people.bonds.find((bond) => bond.person === TOBI)?.stage).toBe("courting");
  });

  test("[R-PEOPLE-013] given the most bonds a life may court already courting, when another is talked to, then the card's button is shut, says Not yet, and the reason stands on it", () => {
    const game = tunde();
    const others = game.view().people.candidates.map((candidate) => candidate.person).filter((person) => person !== TOBI);
    expect(others.length).toBeGreaterThanOrEqual(maxCourting);
    for (const person of others.slice(0, maxCourting)) game.accept({ type: COURT, with: person });
    const ask = talkAsk(TOBI, game.view(), maxCourting, WORDS, { send: () => undefined, dismiss: () => undefined });
    expect(ask.button).toBe(say("ui.needs.not-yet"));
    expect(ask.blocked).toBe(say("ui.people.court.full", { count: maxCourting }));
    // The engine says the same: a fourth is not legal.
    game.expectRejected({ type: COURT, with: TOBI }, "not-legal");
  });
});

describe("their room", () => {
  test("[R-WORLD-020] given no bond courting, their room is not open; once Tobi is courted it is, near his home in content", () => {
    const game = tunde();
    expect(roomOpen(game.view())).toBe(false);
    courted(game, TOBI);
    expect(roomOpen(game.view())).toBe(true);
    expect(roomNear(game.view())).toBe(partnerMeetings.find((meeting) => meeting.person === TOBI)?.home.near);
  });

  test("[R-PEOPLE-014] [R-WORLD-020] given Tobi courted, when their room is entered, then the visit is staged there on its chair, and the friend's guest stands there while listed", () => {
    const game = tunde();
    courted(game, TOBI);
    const view = game.view();
    expect(content.place[THEIR_ROOM]?.stages).toContain("activity.see-someone");
    const acts = actsHere(room, THEIR_ROOM, view, false);
    expect(acts["time-together"]).toEqual(["activity.see-someone"]);
    expect(acts["friend-guest"]).toEqual([HAUWA]);
    expect(acts.door).toEqual(["out"]);
    // In December the friend met only then stands there in Hauwa's place.
    expect(actsHere(room, THEIR_ROOM, view, true)["friend-guest"]).toEqual([TONYE]);
  });
});
