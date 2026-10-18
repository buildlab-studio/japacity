// What an act says once it lands, in every built place (docs/rules/world.md R-WORLD-005; text.md R-TEXT-008): a
// person at the thing speaks over their head in their own voice; a thing tells one short line
// in the corner, about the world and never the player's own act; an act the scene shows says nothing at all.
import { describe, expect, test } from "vitest";

import { words } from "../../shared/words/text";
import { lightBack, nowLands, plainActLine } from "./actLines";
import { cityWords } from "./city.words";
import { stageOf } from "./placeFile";
import { builtPlaces } from "./scene.testing";
import { sceneWords } from "./scene.words";
import { thingsOf } from "./things";
import { addLateWords } from "../../shared/words/late";
import { londonText } from "../../shared/words/tables/london.words";

// London's words ride their own chunk in the game (shared/words/late.ts); a test of London adds them as the city does.
addLateWords(londonText);

/** Every thing's acts in every built place, with the place's folder. */
const ACTS = builtPlaces().flatMap(({ folder, file }) => thingsOf(stageOf(file)).flatMap((thing) => thing.acts.map((act) => ({ folder, thing, act }))));

/** True when nothing has words for the key. */
function silent(key: string): boolean {
  return sceneWords(key) === key;
}

describe("an act's line as it lands", () => {
  test("[R-TEXT-008] [R-WORLD-005] given every act with a pose or a slot in every built place, when it lands, then it says no line: the scene shows it", () => {
    const shown = ACTS.filter(({ act }) => act.pose !== undefined || act.kind === "do");
    expect(shown.length).toBeGreaterThan(10);
    for (const { folder, thing, act } of shown) {
      expect({ act: `${folder} ${thing.id} ${act.id}`, done: silent(`${act.label}.done`), says: silent(`${act.label}.says`) }).toEqual({ act: `${folder} ${thing.id} ${act.id}`, done: true, says: true });
      expect(act.kind !== "plain" || plainActLine(thing, act) === null, `${folder} ${thing.id} ${act.id}`).toBe(true);
    }
  });

  test("[R-WORLD-005] given Mama at her stall, when she is greeted, then she says her welcome over her head and the corner tells the oranges after", () => {
    const greet = ACTS.find(({ act }) => act.label === "city.act.greet-mum");
    if (greet === undefined) throw new Error("No greeting at Mama's stall.");
    expect(plainActLine(greet.thing, greet.act)).toEqual({ kind: "say", who: greet.thing.id, name: "Mama", words: "You have eaten? Sit small.", then: "Mama presses a bag of oranges on you." });
  });

  test("[R-WORLD-005] given the agent and the visa officer at their desks, when asked, then each speaks in his own voice over his head, with no narration round the words", () => {
    const agent = ACTS.find(({ act }) => act.label === "city.act.ask-desk");
    const officer = ACTS.find(({ act }) => act.label === "city.act.ask-visa-desk");
    if (agent === undefined || officer === undefined) throw new Error("No agent or officer to ask.");
    expect(plainActLine(agent.thing, agent.act)).toMatchObject({ kind: "say", who: "agent", words: expect.stringMatching(/^Not today\. /) as string, then: null });
    expect(plainActLine(officer.thing, officer.act)).toEqual({ kind: "say", who: "officer", name: "The officer", words: "Nothing for you today.", then: null });
  });

  test("[R-TEXT-008] [R-WORLD-005] given every plain act that tells a line, when it is read, then it is short, in the third person about the world, and never a person's quoted words", () => {
    const tells = ACTS.filter(({ act }) => act.kind === "plain" && !silent(`${act.label}.done`) && act.label !== "city.act.papers");
    expect(tells.length).toBeGreaterThan(10);
    for (const { act } of tells) {
      const line = sceneWords(`${act.label}.done`);
      expect({ line, short: line.length <= 90, sentences: line.split(/(?<=\.) /).length <= 2 }).toEqual({ line, short: true, sentences: true });
      expect(line).not.toMatch(/^You\b|['‘“]/);
    }
  });

  test("[R-WORLD-019] [R-WORLD-005] given the papers box, when it is looked in, then nothing is told in the corner: the box opens the phone's Papers, which tells every paper", () => {
    const boxes = ACTS.filter(({ act }) => act.label === "city.act.papers");
    expect(boxes.length).toBeGreaterThanOrEqual(3);
    for (const { act } of boxes) expect([act.kind, act.app]).toEqual(["app", "papers"]);
    expect(silent("city.act.papers.done")).toBe(true);
  });

  test("[R-WORLD-005] [R-WORLD-026] given the light bill paid in the parlour, when the answer lands, then Mama says the light is back over her head, the corner tells the bill paid and the next compound is heard after; elsewhere, or for the bill left, nothing", () => {
    const parlour = builtPlaces().find(({ folder }) => folder === "home-family-house");
    if (parlour === undefined) throw new Error("No parlour.");
    const things = thingsOf(stageOf(parlour.file));
    const paid = [{ key: "line.offer.taken", params: { offer: "offer.nepa-bill", choice: "pay" } }];
    expect(lightBack(paid, things)).toEqual({ who: "mama", name: "Mama", words: "God bless you. Light is back.", told: "Light bill paid", heard: cityWords("city.heard.up-nepa") });
    expect(lightBack([{ key: "line.offer.taken", params: { offer: "offer.nepa-bill", choice: "leave" } }], things)).toBeNull();
    expect(lightBack(paid, things.filter((thing) => thing.id !== "mama"))).toBeNull();
  });
});

describe("where an act done at once lands its line", () => {
  const parlour = [
    { id: "mama", label: "scene.thing.mama" },
    { id: "bed", label: "scene.thing.bed" },
  ];
  const now = (activity: string) => ({ key: `line.activity.${activity.replace(/^activity\./, "")}.now`, params: { activity } });

  test("[R-WORLD-005] [R-ACTIVITY-019] given an act that repeats (a nap, a bath, a pot of your own, the TV, the shop), when it is done, then its line is told in the corner, every time, in its own words", () => {
    for (const activity of ["activity.nap", "activity.bucket-bath", "activity.cook-own-pot", "activity.watch-tv", "activity.help-shop", "activity.study-english"]) {
      expect(nowLands(now(activity), parlour)).toEqual({ kind: "tell", words: words(now(activity).key) });
      // A second time the same month lands it again: a repeat act is never done for the month.
      expect(nowLands(now(activity), parlour)).toEqual({ kind: "tell", words: words(now(activity).key) });
    }
  });

  test("[R-WORLD-005] given gist with Mama in the parlour, when it is done, then her words land over her head under her name, never in the corner", () => {
    const landed = nowLands(now("activity.family-time"), parlour);
    expect(landed).toEqual({ kind: "say", who: "mama", name: sceneWords("scene.thing.mama"), words: "You have eaten? Sit small.", then: null });
  });

  test("[R-WORLD-005] [R-HOME-012] given the big pot bought for the house with Mama in the place, when it is done, then her thanks land over her head under her name; with no Mama there, the corner tells it", () => {
    const landed = nowLands(now("activity.cook-jollof"), parlour);
    expect(landed).toEqual({ kind: "say", who: "mama", name: sceneWords("scene.thing.mama"), words: "God bless you. The whole house will eat well this week.", then: null });
    expect(nowLands(now("activity.cook-jollof"), parlour.filter((thing) => thing.id !== "mama"))).toEqual({ kind: "tell", words: words(now("activity.cook-jollof").key) });
  });

  test("[R-WORLD-005] given what the scene shows (the pot, the drum) or an act done once a month, when it is done, then nothing lands here: the scene shows the first, the second answers in its sheet", () => {
    for (const activity of ["activity.cook-at-home", "activity.cook-own", "activity.cook-own-uk", "activity.fetch-water", "activity.fill-drum"]) expect(nowLands(now(activity), parlour)).toBeNull();
    expect(nowLands(now("activity.job-hunt"), parlour)).toBeNull();
  });
});
