// The archetypes' presets in content (prologue.md R-PROLOGUE-010, server.md R-SERVER-046): the one answer function the
// client plays offline and the server plays online. Its edges: the preset's answer allowed, shut (the open answer that
// suits the tile), a step the preset does not name, every answer shut, an unknown tile; the door's age step and home.
import { startYearOf } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { content } from "../index";
import { AGE_CARDS, lowestYear, PRESET_STEPS_OLDER, presetAges, presetAnswer, presetHomes, presetOf, presetOffered, PRESETS } from "./prologue.preset";

const open = (...ids: string[]) => ids.map((id) => ({ id, allowed: true }));
const shut = (...ids: string[]) => ids.map((id) => ({ id, allowed: false }));

/** Every year an age card offers, open, as the view lists them. */
function ageAnswers(card: string): { id: string; allowed: boolean }[] {
  return (content.prologue[card]?.answers ?? []).map((answer) => ({ id: answer.id, allowed: true }));
}

describe("the preset's answer", () => {
  test("[R-PROLOGUE-010] [R-SERVER-046] given the tile's preset answer allowed, when the answer is asked, then it is the preset's, whatever its place on the card", () => {
    expect(presetAnswer("developer", 0, "family-house", "subjects", open("arts", "commercial", "science"))).toBe("science");
    expect(presetAnswer("nurse", 0, "family-house", "course", open("computer-science", "nursing"))).toBe("nursing");
    // The second of the preset's answers goes when only it is open.
    expect(presetAnswer("developer", 0, "family-house", "friend", [...shut("tech"), ...open("canada", "uk")])).toBe("uk");
  });

  test("[R-PROLOGUE-010] [R-SERVER-046] given every preset answer shut by a draw, when the answer is asked, then the open answer that suits the tile goes, else the first open one", () => {
    // The developer leans to tech at the send-off; with tech and uk shut the first open one goes.
    expect(presetAnswer("developer", 0, "family-house", "friend", [...shut("tech", "uk"), ...open("canada", "care")])).toBe("canada");
    // The accountant's preset is canada alone, and its leaning the same: shut, the first open answer goes.
    expect(presetAnswer("accountant", 0, "family-house", "friend", [...shut("canada"), ...open("uk", "tech")])).toBe("uk");
    // A leaning that is open goes before the card's order.
    expect(presetAnswer("trader", 0, "family-house", "friend", [...open("uk"), ...open("drivers")])).toBe("drivers");
  });

  test("[R-PROLOGUE-010] [R-SERVER-046] given a step the preset does not name, when the answer is asked, then the first open answer goes", () => {
    expect(presetOf("shop-worker")?.answers["course"]).toBeUndefined();
    expect(presetAnswer("shop-worker", 0, "family-house", "course", [...shut("computer-science"), ...open("nursing", "accounting")])).toBe("nursing");
  });

  test("[R-PROLOGUE-010] [R-SERVER-046] given every answer shut, or a tile no one has, when the answer is asked, then there is none", () => {
    expect(presetAnswer("developer", 0, "family-house", "friend", shut("tech", "uk", "canada"))).toBeNull();
    expect(presetAnswer("pilot", 0, "family-house", "subjects", open("science"))).toBeNull();
    expect(presetAnswer("", 0, "family-house", "draw", open("begin"))).toBeNull();
  });

  test("[R-PROLOGUE-010] [R-SERVER-046] given the home picked on the door, when the home step is asked, then that home goes; a home the door has not leaves the tile's own", () => {
    const homes = open("family-house", "compound-room", "hostel-room", "makoko");
    expect(presetAnswer("developer", 0, "hostel-room", "home", homes)).toBe("hostel-room");
    expect(presetAnswer("developer", 0, "compound-room", "home", homes)).toBe("compound-room");
    expect(presetAnswer("water", 0, "makoko", "home", homes)).toBe("makoko");
    expect(presetAnswer("water", 0, "penthouse", "home", homes)).toBe("makoko");
    expect(presetAnswer("developer", 0, "penthouse", "home", homes)).toBe("family-house");
    // A room the life cannot pay for is shut: the open answer that suits goes instead.
    expect(presetAnswer("developer", 0, "compound-room", "home", [...shut("compound-room"), ...open("hostel-room", "family-house")])).toBe("hostel-room");
  });

  test("[R-PROLOGUE-009] [R-PROLOGUE-010] [R-SERVER-046] given the door's age step, when an age card is asked, then the tile's own year goes at 0 and each step one year older; a year shut gives way to the nearest open above, then below", () => {
    for (const preset of PRESETS) {
      const own = lowestYear(preset.answers);
      for (const card of AGE_CARDS) {
        for (const age of presetAges(preset.answers)) expect(startYearOf(presetAnswer(preset.id, age, "family-house", card, ageAnswers(card)) ?? ""), `${preset.id} ${card} ${String(age)}`).toBe(own + age);
      }
    }
    const card = AGE_CARDS[0] ?? "";
    const own = lowestYear(presetOf("developer")?.answers ?? {});
    const at = (year: number) => `start-${String(year)}`;
    const wanted = ageAnswers(card).map((answer) => (answer.id === at(own + 1) ? { ...answer, allowed: false } : answer));
    expect(presetAnswer("developer", 1, "family-house", card, wanted)).toBe(at(own + 2));
    const onlyBelow = ageAnswers(card).map((answer) => ({ ...answer, allowed: (startYearOf(answer.id) ?? 0) <= own }));
    expect(presetAnswer("developer", 1, "family-house", card, onlyBelow)).toBe(at(own));
    // A step below the tile's own counts as its own.
    expect(presetAnswer("developer", -2, "family-house", card, ageAnswers(card))).toBe(at(own));
  });
});

describe("what the door offers", () => {
  test("[R-PROLOGUE-009] [R-PROLOGUE-013] [R-SERVER-046] given each tile, then its age steps run from 0 to at most three and never past the oldest start, and its homes are the three rooms, Makoko for the child of the water alone", () => {
    const oldest = Math.max(...AGE_CARDS.flatMap((card) => ageAnswers(card).map((answer) => startYearOf(answer.id) ?? 0)));
    for (const preset of PRESETS) {
      const ages = presetAges(preset.answers);
      expect(ages[0]).toBe(0);
      expect(ages.length - 1).toBe(Math.min(PRESET_STEPS_OLDER, oldest - lowestYear(preset.answers)));
      expect(presetHomes(preset.answers)).toEqual(preset.id === "water" ? ["compound-room", "hostel-room", "family-house", "makoko"] : ["compound-room", "hostel-room", "family-house"]);
    }
  });

  test("[R-SERVER-046] given a tile, an age step and a home, when they are checked, then only what the door offers passes, at each edge", () => {
    const most = presetAges(presetOf("developer")?.answers ?? {}).at(-1) ?? 0;
    expect(presetOffered("developer", 0, "family-house")).toBe(true);
    expect(presetOffered("developer", most, "hostel-room")).toBe(true);
    expect(presetOffered("developer", -1, "family-house")).toBe(false);
    expect(presetOffered("developer", most + 1, "family-house")).toBe(false);
    expect(presetOffered("developer", 0, "makoko")).toBe(false);
    expect(presetOffered("water", 0, "makoko")).toBe(true);
    expect(presetOffered("developer", 0, "self-contain")).toBe(false);
    expect(presetOffered("pilot", 0, "family-house")).toBe(false);
  });

  test("[R-PROLOGUE-010] given every preset, then each step and answer it names, and each leaning, is on the prologue's own step", () => {
    expect(PRESETS.map((preset) => preset.id)).toEqual(["developer", "nurse", "accountant", "writer", "trader", "shop-worker", "water"]);
    for (const preset of PRESETS) {
      for (const [step, answers] of Object.entries(preset.answers)) {
        for (const answer of answers) expect(content.prologue[step]?.answers.some((one) => one.id === answer), `${preset.id}: ${step}.${answer}`).toBe(true);
      }
      for (const [step, answer] of Object.entries(preset.leaning)) expect(content.prologue[step]?.answers.some((one) => one.id === answer), `${preset.id}: ${step}.${answer}`).toBe(true);
    }
  });
});
