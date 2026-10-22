// The computer partners met in a place (world:nobody-picked-from-list; person:computer-candidates-labelled, person:courting-opens-a-bond,
// person:time-together-is-an-act): each stands as a thing only in the place content meets them in,
// only while the view lists them, one met only in December only in December; the thing's one act opens a card whose
// button sends `people/court`. Where each is met: the meetup's two at the hub's meetup, after the service
// and a friend of the family at the family house, nobody met in their room. Real content, a real life through the engine.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { content, meetingThings, partnerMeetings, text } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import parlourRaw from "../../../public/assets/places/home-family-house/place.json";
import theirRoom from "../../../public/assets/places/their-room/place.json";
import yabaHub from "../../../public/assets/places/yaba-hub/place.json";
import { courted, eagerContent, partnered, peopleGame, DELE } from "../../shared/testing/person";
import { nameOf, say } from "../../shared/words/text";
import { WORLD_LIMITS } from "../../../../../tools/assets/world-check";
import { actsOffered } from "./acts/acts";
import { poolOf, sampleCrowd } from "../../shared/scene/crowd";
import { crowdTuning } from "../../shared/scene/limits";
import { COURT, courtedTold, makeRoom, meetingThingsAt, roomFor, roomNear, roomOpen, standingAt, talkAsk, THEIR_ROOM, withMeetings, withStanding, type TalkWords } from "./meetings";
import { type PlaceFile, stageOf } from "../../shared/scene/placeFile";
import { stagedNow, thingSpot, thingsNow, thingsOf } from "./scene/things";

const HUB = "place.yaba";
const HOUSE = "place.family-house";
const HAUWA: Id<"person"> = "person.hauwa-nurse";
const KELECHI: Id<"person"> = "person.kelechi-developer";
const EJIRO: Id<"person"> = "person.ejiro-uk";
const UDUAK: Id<"person"> = "person.uduak-canada";
const TONYE: Id<"person"> = "person.tonye-dubai";
const hub = yabaHub as unknown as PlaceFile;
const parlour = parlourRaw as unknown as PlaceFile;
const room = theirRoom as unknown as PlaceFile;
const maxCourting = content.tuning.people.maxCourting;

const WORDS: TalkWords = {
  name: nameOf,
  court: (name) => say("ui.people.court", { name }),
  full: (count) => say("ui.people.court.full", { count }),
  notYet: say("ui.needs.not-yet"),
  computer: say("ui.people.mark.computer"),
  partnered: (partner, name) => say("ui.people.court.partnered", { partner: partner === null ? say("ui.people.who.player") : nameOf(partner), name }),
};

/** The banker's life one month in: the computer partners the view lists for a grown-up at home. */
function banker(): ReturnType<typeof peopleGame> {
  const game = peopleGame();
  game.grant(1);
  game.endTurn([]);
  return game;
}

/** The things a player can act on at a place now, as the city reads them: meetings filled in, the talk act offered. */
function actsHere(file: PlaceFile, place: string, view: PlayerView, december: boolean): Record<string, string[]> {
  const standing = standingAt(place, view.people.candidates, december);
  const stage = stageOf(withStanding(file, standing));
  const offered = new Set([...actsOffered(view), `command:${COURT}`]);
  const staged = new Set<string>(content.place[place as Id<"place">]?.stages ?? []);
  const things = thingsNow(withMeetings(thingsOf(stage), place, standing), stagedNow(offered, staged, new Set(), null, view.chapter.current));
  return Object.fromEntries(things.map((thing) => [thing.id, thing.acts.map((act) => act.with ?? act.stages ?? act.kind)]));
}

/** Who talks at each meeting thing, as `[thing, person]`. */
function talks(acts: Record<string, string[]>): [string, string][] {
  return Object.entries(acts).flatMap(([id, list]) => list.filter((one) => one.startsWith("person.")).map((person): [string, string] => [id, person]));
}

describe("a person standing where content meets them", () => {
  test("[person:computer-candidates-labelled] [world:nobody-picked-from-list] given the banker's first month, when the family house is read, then Dele after the service and Hauwa, a friend of the family, stand as things named by them with the computer mark, each act courts them, and nobody stands where content meets nobody", () => {
    const view = banker().view();
    const listed = view.people.candidates.map((candidate) => candidate.person);
    expect(listed).toEqual(expect.arrayContaining([DELE, HAUWA]));
    const standing = standingAt(HOUSE, view.people.candidates, false);
    expect(standing).toEqual(expect.arrayContaining([{ thing: "after-service", person: DELE }, { thing: "friend-guest", person: HAUWA }]));
    expect(standing).toHaveLength(2);
    const things = withMeetings(thingsOf(stageOf(parlour)), HOUSE, standing);
    const dele = things.find((thing) => thing.id === "after-service");
    expect(dele).toMatchObject({ label: `${DELE}.name`, mark: "computer" });
    expect(dele?.acts).toEqual([expect.objectContaining({ kind: "command", command: COURT, with: DELE })]);
    // Mama, Papa and the rest of the parlour keep their things.
    expect(things.map((thing) => thing.id)).toEqual(expect.arrayContaining(["mama", "papa", "sofa", "table", "out"]));
    // The meetup's two stand only in December.
    expect(standingAt(HUB, view.people.candidates, false)).toEqual([]);
    for (const place of ["place.ojuelegba", "place.yaba-hub", THEIR_ROOM, "place.bode-thomas"]) expect(standingAt(place, view.people.candidates, true)).toEqual([]);
    const anywhere = [...new Set(partnerMeetings.map((meeting) => meeting.met.place))].flatMap((place) => standingAt(place, view.people.candidates, true)).map((one) => one.person);
    expect(anywhere.filter((person) => !listed.includes(person))).toEqual([]);
  });

  test("[person:computer-candidates-labelled] [world:nobody-picked-from-list] given Dele courted, when the view no longer lists him, then he stands nowhere: his thing and his figure are gone from the parlour, and Hauwa still stands", () => {
    const game = banker();
    courted(game, DELE);
    const view = game.view();
    expect(view.people.candidates.map((candidate) => candidate.person)).not.toContain(DELE);
    const standing = standingAt(HOUSE, view.people.candidates, false);
    expect(standing).toEqual([{ thing: "friend-guest", person: HAUWA }]);
    expect(withMeetings(thingsOf(stageOf(parlour)), HOUSE, standing).map((thing) => thing.id)).not.toContain("after-service");
    expect((stageOf(withStanding(parlour, standing)).standing ?? []).map((one) => one.person)).toEqual([HAUWA]);
    expect(talks(actsHere(parlour, HOUSE, view, false))).toEqual([["friend-guest", HAUWA]]);
  });

  test("[person:courting-opens-a-bond] [world:nobody-picked-from-list] given people met only in December, when it is not December they stand nowhere, and in December the meetup's two stand at the hub's meetup and the one met only then takes a thing two share", () => {
    const view = banker().view();
    expect(view.people.candidates.map((candidate) => candidate.person)).toEqual(expect.arrayContaining([KELECHI, EJIRO, UDUAK, TONYE]));
    expect(talks(actsHere(hub, HUB, view, false))).toEqual([]);
    expect(talks(actsHere(hub, HUB, view, true))).toEqual(expect.arrayContaining([["meetup-speaker", KELECHI], ["meetup-guest", UDUAK]]));
    expect(talks(actsHere(parlour, HOUSE, view, true))).toEqual(expect.arrayContaining([["after-service", EJIRO], ["friend-guest", TONYE]]));
    // Each in their own model where two share the thing.
    const standers = stageOf(withStanding(parlour, standingAt(HOUSE, view.people.candidates, true))).standing ?? [];
    expect(standers.map((one) => one.person).sort()).toEqual([EJIRO, TONYE].sort());
    // Once Ejiro is courted, Dele has the place after the service again.
    const game = banker();
    courted(game, EJIRO);
    expect(standingAt(HOUSE, game.view().people.candidates, true).find((one) => one.thing === "after-service")?.person).toBe(DELE);
  });

  test("[world:nobody-picked-from-list] given each meeting, when the city reads where it stands, then the place file declares its thing with one talk act and someone to stand there for each person, its mark is over them, the model is from the place's kit, and nobody is met in their room", () => {
    const files: Record<string, PlaceFile[]> = { [HUB]: [hub], [HOUSE]: [parlour] };
    expect(Object.keys(meetingThings).sort()).toEqual([HOUSE, HUB]);
    expect(stageOf(room).standing).toBeUndefined();
    for (const meeting of partnerMeetings) {
      const [file] = files[meeting.met.place] ?? [];
      expect(file, `${meeting.person} stands at ${meeting.met.place}`).toBeDefined();
      const stage = stageOf(file!);
      expect(meetingThingsAt(meeting.met.place).has(meeting.met.thing)).toBe(true);
      const thing = stage.things?.find((one) => one.id === meeting.met.thing);
      expect(thing?.acts).toEqual([expect.objectContaining({ kind: "command", command: COURT })]);
      const standers = (stage.standing ?? []).filter((one) => one.thing === meeting.met.thing && (one.person === undefined || one.person === meeting.person));
      expect(standers, `someone stands for ${meeting.person}`).toHaveLength(1);
      expect(thingSpot(stage, thing!)).toEqual([standers[0]?.at[0], standers[0]?.at[1]]);
      // The kit the place already uses: the hub's sample, or the family house's own for its guests.
      expect(file!.people.sample).toContain(standers[0]?.file);
    }
  });

  test("[world:place-is-one-screen] given people standing at their things, when the crowd is drawn, then residents give up their places only past the scope's cap, then players, and the residents at parts last", () => {
    const crowd = [
      { slot: 0, kind: "resident" as const },
      { slot: 1, kind: "resident" as const },
      { slot: 2, kind: "resident" as const },
      { slot: 3, kind: "player" as const },
    ];
    expect(makeRoom(crowd, 2).map((one) => one.slot)).toEqual([0, 3]);
    expect(makeRoom(crowd, 0)).toEqual(crowd);
    // city:residents-fill-to-target: once the other residents are gone, players give way; a resident at a part goes only after them, the highest spot first.
    const parts = [
      { slot: 0, kind: "resident" as const, part: 0 },
      { slot: 1, kind: "resident" as const },
      { slot: 2, kind: "player" as const },
      { slot: 3, kind: "resident" as const, part: 2 },
    ];
    expect(makeRoom(parts, 2).map((one) => one.slot)).toEqual([0, 3]);
    expect(makeRoom(parts, 3).map((one) => one.slot)).toEqual([0]);
    expect(makeRoom(parts, 4)).toEqual([]);
    // The parlour's Mama and Papa stay with two guests in a room of six; the hub's six make room for two.
    expect(roomFor(2, 2, 6)).toBe(0);
    expect(roomFor(6, 2, 6)).toBe(2);
    expect(roomFor(4, 0, 4)).toBe(0);
  });

  test("[world:place-is-one-screen] [city:players-shown-present-not-tracked] given players there now and a player seen only today, when people standing at their things take places, then the player seen today gives way before any player there now, the last first", () => {
    const crowd = [
      { slot: 0, kind: "resident" as const },
      { slot: 1, kind: "player" as const, today: true as const },
      { slot: 2, kind: "player" as const },
      { slot: 3, kind: "player" as const },
    ];
    expect(makeRoom(crowd, 2).map((one) => one.slot)).toEqual([2, 3]);
    expect(makeRoom(crowd, 3).map((one) => one.slot)).toEqual([3]);
    // The hub in its meetup, as the sample draws it: five players there now and one seen today, two standing at their things.
    const file = JSON.parse(readFileSync(join(import.meta.dirname, "..", "..", "..", "public", "assets", "places", "yaba-hub", "place.json"), "utf8")) as PlaceFile;
    const stage = stageOf(file);
    const parts = { spots: stage.people.length, prefer: stage.prefer, acts: stage.acts };
    const live = Array.from({ length: 5 }, (_, index) => ({ look: "person_tunde", name: `live${String(index)}` }));
    const place = { id: file.place as Id<"place">, crowd: { low: 6, high: 6, target: 6 }, traditionalBp: 0, occasion: false };
    const drawn = sampleCrowd(place, poolOf(file.people.sample), "2026-10-08", "high", crowdTuning(content.tuning.city, file.scope, false), live, [{ look: "person_tunde", name: "today0" }], [], parts).people;
    const shown = makeRoom(drawn, 2).map((one) => one.tag);
    expect(shown).not.toContain("today0");
    expect(shown).toEqual(expect.arrayContaining(["live0", "live1", "live2", "live3"]));
  });

  test("[world:place-is-one-screen] [city:residents-fill-to-target] given every shipped place with people standing at its things and more players present than slots, when the crowd is drawn in each mode, then the crowd and those standing stay within the scope's cap, and a part's resident gives way only once no player is left", () => {
    const folder = join(import.meta.dirname, "..", "..", "..", "public", "assets", "places");
    const many = Array.from({ length: 12 }, (_, index) => ({ look: "person_tunde", name: `player${String(index)}` }));
    let checked = 0;
    for (const name of readdirSync(folder)) {
      const path = join(folder, name, "place.json");
      if (!existsSync(path)) continue;
      const file = JSON.parse(readFileSync(path, "utf8")) as PlaceFile;
      const stage = stageOf(file);
      const standers = stage.standing?.length ?? 0;
      if (standers === 0) continue;
      const parts = { spots: stage.people.length, prefer: stage.prefer, acts: stage.acts };
      for (const mode of ["low", "high"] as const) {
        const cap = WORLD_LIMITS.people[file.scope][mode];
        const figure = Math.min(stage.people.length, cap);
        const place = { id: file.place as Id<"place">, crowd: { low: figure, high: figure, target: figure }, traditionalBp: 0, occasion: false };
        const drawn = sampleCrowd(place, poolOf(file.people.sample), "2026-10-08", mode, crowdTuning(content.tuning.city, file.scope, false), many, [], [], parts).people;
        const shown = makeRoom(drawn, roomFor(drawn.length, standers, cap));
        expect(shown.length + standers, `${name} in ${mode}`).toBeLessThanOrEqual(cap);
        const partGone = shown.filter((one) => one.part !== undefined).length < drawn.filter((one) => one.part !== undefined).length;
        const others = shown.filter((one) => one.kind !== "resident" || one.part === undefined);
        expect(partGone ? others : [], `${name} in ${mode}`).toEqual([]);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("the talk sheet", () => {
  test("[person:courting-opens-a-bond] [world:nobody-picked-from-list] [world:one-action-one-sheet] given Dele standing in the parlour, when he is talked to, then the card carries the computer mark, his meeting line and one button that courts him, and its button sends people/court with him", () => {
    const game = banker();
    const sent: string[] = [];
    const ask = talkAsk(DELE, game.view(), maxCourting, WORDS, { send: (person) => sent.push(person), dismiss: () => undefined });
    expect(ask.who).toBe(say("ui.people.mark.computer"));
    expect(ask.title).toBe(nameOf(DELE));
    expect(ask.line).toBe(text[`${DELE}.met`]);
    expect(ask.button).toBe(say("ui.people.court", { name: nameOf(DELE) }));
    expect(ask.blocked).toBeUndefined();
    expect(ask.cost).toBeNull();
    ask.act();
    expect(sent).toEqual([DELE]);
    // What the button sends, the engine takes: the bond opens at courting.
    game.accept({ type: COURT, with: sent[0] as Id<"person"> });
    expect(game.view().people.bonds.find((bond) => bond.person === DELE)?.stage).toBe("courting");
  });

  test("[person:courting-opens-a-bond] given the most bonds a life may court already courting, when another is talked to, then the card's button is shut, says Not yet, and the reason stands on it", () => {
    const game = banker();
    const others = game.view().people.candidates.map((candidate) => candidate.person).filter((person) => person !== DELE);
    expect(others.length).toBeGreaterThanOrEqual(maxCourting);
    for (const person of others.slice(0, maxCourting)) game.accept({ type: COURT, with: person });
    const ask = talkAsk(DELE, game.view(), maxCourting, WORDS, { send: () => undefined, dismiss: () => undefined });
    expect(ask.button).toBe(say("ui.needs.not-yet"));
    expect(ask.blocked).toBe(say("ui.people.court.full", { count: maxCourting }));
    // The engine says the same: one more is not legal.
    game.expectRejected({ type: COURT, with: DELE }, "not-legal");
  });
});

describe("seeing someone beside someone else", () => {
  // Hauwa is still offered while Dele is courted. The rules allow it (person:courting-opens-a-bond, up to
  // maxCourting), and courting beside courting costs nothing, so then the card says nothing more; beside a partner, gossip
  // follows (person:one-partner-at-a-time, person:gossip-when-two-timing), and the card says what it costs before the tap.
  test("[person:gossip-when-two-timing] [person:courting-opens-a-bond] given Dele only courted, when Hauwa is talked to, then her card adds nothing, since the rules ask nothing of courting two", () => {
    const game = banker();
    courted(game, DELE);
    const ask = talkAsk(HAUWA, game.view(), maxCourting, WORDS, { send: () => undefined, dismiss: () => undefined });
    expect(ask.blocked).toBeUndefined();
    expect(ask.note).toBeUndefined();
  });

  test("[person:gossip-when-two-timing] [person:one-partner-at-a-time] given Dele a partner, when Hauwa is talked to, then her card's button stays open and its second line says seeing her too costs standing if it comes out, and Dele may leave", () => {
    const game = peopleGame(eagerContent());
    const bond = partnered(game);
    expect(game.view().people.bonds.find((one) => one.id === bond)?.stage).toBe("partner");
    const ask = talkAsk(HAUWA, game.view(), maxCourting, WORDS, { send: () => undefined, dismiss: () => undefined });
    expect(ask.blocked).toBeUndefined();
    expect(ask.note).toBe(say("ui.people.court.partnered", { partner: nameOf(DELE), name: nameOf(HAUWA) }));
    expect(ask.note).toContain(nameOf(DELE));
    expect(ask.note).toContain(nameOf(HAUWA));
  });
});

describe("the answer once courted", () => {
  // The corner tells the person's own line, then the plain line
  // that they live in the game (person:computer-mark-is-quiet).
  test("[person:courting-opens-a-bond] [person:computer-mark-is-quiet] given a computer partner courted, when the corner is told, then their answer comes first in their own words, as theirs, and the plain line that they live in the game follows", () => {
    for (const { person } of partnerMeetings) {
      const told = courtedTold(person, {
        name: nameOf,
        answer: (one) => text[`${one}.courted`] ?? null,
        said: (name, line) => say("ui.people.courted.said", { name, line }),
        chosen: (name) => say("ui.people.chosen", { name }),
      });
      expect(told).toEqual([say("ui.people.courted.said", { name: nameOf(person), line: text[`${person}.courted`]! }), say("ui.people.chosen", { name: nameOf(person) })]);
      expect(told[0]?.startsWith(`${nameOf(person)}: "`)).toBe(true);
    }
    expect(courtedTold(DELE, { name: nameOf, answer: () => null, said: (name, line) => `${name}${line}`, chosen: (name) => name })).toEqual([nameOf(DELE)]);
  });
});

describe("their room", () => {
  test("[world:nobody-picked-from-list] given no bond courting, their room is not open; once Dele is courted it is, near his home in content", () => {
    const game = banker();
    expect(roomOpen(game.view())).toBe(false);
    courted(game, DELE);
    expect(roomOpen(game.view())).toBe(true);
    expect(roomNear(game.view())).toBe(partnerMeetings.find((meeting) => meeting.person === DELE)?.home.near);
  });

  test("[person:time-together-is-an-act] [world:nobody-picked-from-list] given Dele courted, when their room is entered, then the visit is staged there on its chair, and nobody stands there to be met", () => {
    const game = banker();
    courted(game, DELE);
    const view = game.view();
    expect(content.place[THEIR_ROOM]?.stages).toContain("activity.see-someone");
    const acts = actsHere(room, THEIR_ROOM, view, true);
    expect(acts).toEqual({ "time-together": ["activity.see-someone"], door: ["out"] });
  });
});
