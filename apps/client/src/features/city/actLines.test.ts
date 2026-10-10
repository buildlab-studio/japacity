// What an act says once it lands, in every built place (docs/rules/world.md R-WORLD-005; text.md R-TEXT-008; the
// owner): a person at the thing speaks over their head in their own voice; a thing tells one short line
// in the corner, about the world and never the player's own act; an act the scene shows says nothing at all.
import { describe, expect, test } from "vitest";

import { lightBack, plainActLine } from "./actLines";
import { cityWords } from "./city.words";
import { stageOf } from "./placeFile";
import { builtPlaces } from "./scene.testing";
import { sceneWords } from "./scene.words";
import { thingsOf } from "./things";

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
      expect(act.kind !== "plain" || plainActLine(thing, act, []) === null, `${folder} ${thing.id} ${act.id}`).toBe(true);
    }
  });

  test("[R-WORLD-005] given Mama at her stall, when she is greeted, then she says her welcome over her head and the corner tells the oranges after", () => {
    const greet = ACTS.find(({ act }) => act.label === "city.act.greet-mum");
    if (greet === undefined) throw new Error("No greeting at Mama's stall.");
    expect(plainActLine(greet.thing, greet.act, [])).toEqual({ kind: "say", who: greet.thing.id, name: "Mama", words: "You have eaten? Sit small.", then: "Mama presses a bag of oranges on you." });
  });

  test("[R-WORLD-005] given the agent and the visa officer at their desks, when asked, then each speaks in his own voice over his head, with no narration round the words", () => {
    const agent = ACTS.find(({ act }) => act.label === "city.act.ask-desk");
    const officer = ACTS.find(({ act }) => act.label === "city.act.ask-visa-desk");
    if (agent === undefined || officer === undefined) throw new Error("No agent or officer to ask.");
    expect(plainActLine(agent.thing, agent.act, [])).toMatchObject({ kind: "say", who: "agent", words: expect.stringMatching(/^Not today\. /) as string, then: null });
    expect(plainActLine(officer.thing, officer.act, [])).toEqual({ kind: "say", who: "officer", name: "The officer", words: "Nothing for you today.", then: null });
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

  test("[R-WORLD-019] [R-WORLD-005] given the papers box, when it is looked in, then the corner tells what it holds", () => {
    const box = ACTS.find(({ act }) => act.label === "city.act.papers");
    if (box === undefined) throw new Error("No papers box.");
    expect(plainActLine(box.thing, box.act, [])).toEqual({ kind: "tell", words: cityWords("city.act.papers.empty") });
  });

  test("[R-WORLD-005] [R-WORLD-026] given the light bill paid in the parlour, when the answer lands, then Mama says the light is back over her head, the corner tells the bill paid and the next compound is heard after; elsewhere, or for the bill left, nothing", () => {
    const parlour = builtPlaces().find(({ folder }) => folder === "family-house-parlour");
    if (parlour === undefined) throw new Error("No parlour.");
    const things = thingsOf(stageOf(parlour.file));
    const paid = [{ key: "line.offer.taken", params: { offer: "offer.nepa-bill", choice: "pay" } }];
    expect(lightBack(paid, things)).toEqual({ who: "mama", name: "Mama", words: "God bless you. Light is back.", told: "Light bill paid", heard: cityWords("city.heard.up-nepa") });
    expect(lightBack([{ key: "line.offer.taken", params: { offer: "offer.nepa-bill", choice: "leave" } }], things)).toBeNull();
    expect(lightBack(paid, things.filter((thing) => thing.id !== "mama"))).toBeNull();
  });
});
