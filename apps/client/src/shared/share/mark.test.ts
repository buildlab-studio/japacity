// What a card says of the life, in words (share:card-contents, docs/rules/text.md
// text:bands-not-figures): the time played in years and months, how
// home sees the character as the standing's band, and the game's word mark in the plain face,
// since in the display caps its Y reads as a 3.
import { describe, expect, test } from "vitest";

import { recordedGame } from "../testing/fixtures";
import { bandWords } from "../words/text";
import { cardFace, playedWords, standingWords } from "./face";
import { cardSteps, previewSteps, type TextStep } from "./layout";
import { measure } from "./share.testing";

const SIZE = { width: 1080, height: 1920 };

describe("a card in words", () => {
  test("[share:card-contents] given months played at the edges, when said, then they read as years and months", () => {
    expect(playedWords(0)).toBe("Under a month");
    expect(playedWords(1)).toBe("1 month");
    expect(playedWords(11)).toBe("11 months");
    expect(playedWords(12)).toBe("1 year");
    expect(playedWords(13)).toBe("1 year and 1 month");
    expect(playedWords(24)).toBe("2 years");
    expect(playedWords(35)).toBe("2 years and 11 months");
  });

  test("[text:bands-not-figures] given a standing at each band's edge, when the card says it, then it is the band's words and never the figure", () => {
    for (const standing of [0, 24, 25, 50, 75, 100]) {
      expect(standingWords(standing)).toBe(bandWords("quality.standing", standing));
      expect(standingWords(standing)).not.toMatch(/\d/);
    }
  });

  test("[share:card-contents] given the graduate's send-off, when the card and its preview are laid out, then the word mark is drawn in the plain face", () => {
    const card = recordedGame("graduate-careful").view().card;
    if (card === null) throw new Error("The graduate's recorded life has no card.");
    const face = cardFace(card, "scenario.graduate");
    for (const steps of [cardSteps(face, SIZE, measure), previewSteps(face, SIZE, measure)]) {
      const mark = steps.find((step): step is TextStep => step.op === "text" && step.role === "sender");
      expect(mark?.family).toBe("sans");
    }
  });

  test("[share:card-contents] given every kind of card the recorded lives reach, when the card and its preview are laid out, then the title is drawn in the plain face, not the display caps", () => {
    const card = recordedGame("graduate-careful").view().card;
    if (card === null) throw new Error("The graduate's recorded life has no card.");
    const face = cardFace(card, "scenario.graduate");
    for (const steps of [cardSteps(face, SIZE, measure), previewSteps(face, SIZE, measure)]) {
      const titles = steps.filter((step): step is TextStep => step.op === "text" && step.role === "title");
      expect(titles.length).toBeGreaterThan(0);
      for (const title of titles) expect(title.family).toBe("sans");
    }
  });
});
