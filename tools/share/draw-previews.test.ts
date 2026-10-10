import { shareKinds, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { cardPage, previewFace } from "./draw-previews";

describe("the kept script that draws the link previews", () => {
  test("[R-SHARE-010] given every kind, when the script builds the words its preview carries, then they are content's own, with the game's address and nothing about a player", () => {
    for (const kind of shareKinds) {
      const face = previewFace(kind);
      expect(face).toEqual({
        kind,
        kicker: text[`share.${kind}.kicker`],
        title: text[`share.${kind}.title`],
        art: text[`share.${kind}.art`],
        sender: text["share.sender"],
        address: text["share.address"],
        disclaimer: text["share.disclaimer"],
      });
      expect(face["address"]).toBe("japacity.app");
    }
  });

  test("[R-SHARE-010] given the gate's card, when the script lays it out, then it carries the game's address and no script", () => {
    const page = cardPage(text["share.address"] ?? "");
    expect(page).toContain('<p class="address">japacity.app</p>');
    expect(page).not.toContain("<script");
  });
});
