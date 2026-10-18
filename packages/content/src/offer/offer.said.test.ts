// What came of an answer (world:month-end-results-sheet): the recruiter's
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
  test("[world:month-end-results-sheet] given the offers on the real content, when the choices that move a quality are listed, then there are some", () => {
    expect(MOVING.length).toBeGreaterThan(0);
  });

  test.each(MOVING)("[world:month-end-results-sheet] given the choice %s, when its words are read, then content tells what came of it in one line with no figure to fill", (key) => {
    const said = text[key];
    expect(said, `${key} has no words`).toBeDefined();
    expect(said!.trim().length).toBeGreaterThan(0);
    expect(said).not.toMatch(/[{}]/);
    expect(said).not.toMatch(/\d/);
  });

  test("[world:month-end-results-sheet] given the recruiter's take-home task done, when its words are read, then they say what came of it, not the ask again", () => {
    const said = text["offer.recruiter-message.said.do-it"];
    expect(said).toBeDefined();
    expect(said).not.toBe(text["offer.recruiter-message.body"]);
    expect(said).toMatch(/task/);
  });
});

describe("the family's light bill, wherever the character is", () => {
  test("[abroad-money:family-asks-more-abroad] given the NEPA bill, which comes abroad as at home, when its name and what came of each answer are read, then each says it is the bill at home, never a bill where the character lives", () => {
    // In London "NEPA has brought the bill, next month" read as London's own bill.
    expect(content.offer["offer.nepa-bill"]?.where).toBe("any");
    for (const key of ["offer.nepa-bill.name", "offer.nepa-bill.said.pay", "offer.nepa-bill.said.leave"]) {
      expect(text[key]).toMatch(/\bthe NEPA bill at home\b|\bthe bill at home\b/);
    }
  });
});
