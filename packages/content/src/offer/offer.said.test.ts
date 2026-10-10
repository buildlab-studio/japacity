// What came of an answer (docs/rules/world.md R-WORLD-008): the recruiter's
// take-home task was taken, and the content added to the portfolio and the network with no line ever saying what
// came of it. Every choice whose effects move a quality has its own words for the results, `<offer>.said.<choice>`,
// as the acts tell what they came to, and the task has its own.
import { describe, expect, test } from "vitest";

import { content, text } from "../index";

/** Every offer choice whose effects move a quality, as `<offer>.said.<choice>`. */
const MOVING = Object.values(content.offer).flatMap((offer) =>
  offer === undefined ? [] : offer.choices.filter((choice) => choice.effects.some((effect) => effect.type === "quality/add")).map((choice) => `${offer.id}.said.${choice.id}`),
);

describe("an answer that moves a quality says what came of it", () => {
  test("[R-WORLD-008] given the offers on the real content, when the choices that move a quality are listed, then there are some", () => {
    expect(MOVING.length).toBeGreaterThan(0);
  });

  test.each(MOVING)("[R-WORLD-008] given the choice %s, when its words are read, then content tells what came of it in one line with no figure to fill", (key) => {
    const said = text[key];
    expect(said, `${key} has no words`).toBeDefined();
    expect(said!.trim().length).toBeGreaterThan(0);
    expect(said).not.toMatch(/[{}]/);
    expect(said).not.toMatch(/\d/);
  });

  test("[R-WORLD-008] given the recruiter's take-home task done, when its words are read, then they say what came of it, not the ask again", () => {
    const said = text["offer.recruiter-message.said.do-it"];
    expect(said).toBeDefined();
    expect(said).not.toBe(text["offer.recruiter-message.body"]);
    expect(said).toMatch(/task/);
  });
});
