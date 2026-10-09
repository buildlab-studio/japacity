// A card's title in the plain face (docs/rules/share.md R-SHARE-004):
// in the display caps "A CHAPTER CLOSES" and "THE SEND-OFF" read hard on a phone, as the word mark did.
import { text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { recordedGame } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { CardView } from "./ShareCard";

type Shared = NonNullable<PlayerView["card"]>;

function adaWith(kind: Shared["kind"]): PlayerView {
  const view = recordedGame("ada-careful").view();
  if (view.card === null) throw new Error("Ada's recorded life has no card.");
  return { ...view, card: { ...view.card, kind, ...(kind === "chapter" ? { chapter: "chapter.landing" as const } : {}) } };
}

describe("a card's title", () => {
  test.each([
    ["chapter", "share.chapter.title"],
    ["send-off", "share.send-off.title"],
  ] as const)("[R-SHARE-004] given the %s card, when it shows, then its title is in the plain face, not the display caps", async (kind, key) => {
    await renderWithView(<CardView />, adaWith(kind));
    const title = screen.getByRole("heading", { name: text[key] });
    expect(title.className).toContain("font-sans");
    expect(title.className).not.toContain("font-display");
  });
});
