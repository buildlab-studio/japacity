// A computer character is never shown as a player on a card or in a news line (person:computers-never-shown-as-players).
// The card is read from a recorded life whose family are computer characters, the news from the real content.
import { content, shareKinds, text, type ShareKind } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { recordedGame } from "../testing/fixtures";
import { cardFace, type ShareCard } from "./face";
import { cardSteps, previewSteps } from "./layout";
import { measure } from "./share.testing";

const tuning = content.tuning.share;
const SIZE = { width: tuning.width, height: tuning.height };
const PREVIEW = { width: tuning.previewWidth, height: tuning.previewHeight };

/** Every computer character's shown name that is a given name, not a relation ("Your brother"). */
const COMPUTER_NAMES = Object.keys(content.person)
  .map((id) => text[`${id}.name`] ?? "")
  .filter((name) => /^[A-Z][a-z]+/.test(name) && !/^(The|Your|A|An) /.test(name))
  .map((name) => name.split(/[\s,]+/)[0]!);

const naming = (words: string) => COMPUTER_NAMES.filter((name) => new RegExp(`\\b${name}\\b`).test(words));

describe("a computer character is never shown as a player", () => {
  test("[person:computers-never-shown-as-players] given a recorded life with computer bonds, when every kind of card is laid out and previewed, then no computer character's name is on it, only the player's own", () => {
    const game = recordedGame("graduate-careful");
    const computers = Object.values(game.state.people.slots).filter((slot) => slot.state === "computer").length + Object.values(game.state.people.bonds).filter((bond) => bond.with.kind === "computer").length;
    expect(computers).toBeGreaterThan(0);
    expect(COMPUTER_NAMES.length).toBeGreaterThan(3);
    const card = game.view().card;
    if (card === null) throw new Error("The graduate's recorded life has no card.");
    for (const kind of shareKinds as readonly ShareKind[]) {
      const shown: ShareCard = { ...card, kind, ...(kind === "chapter" ? { chapter: "chapter.build-the-file" as const } : {}) };
      const face = cardFace(shown, "scenario.graduate");
      const drawn = [...cardSteps(face, SIZE, measure), ...previewSteps(face, PREVIEW, measure)].map((step) => ("text" in step ? String(step.text) : "")).join(" ");
      expect(naming(`${JSON.stringify(face)} ${drawn}`).map((name) => `${kind}: ${name}`)).toEqual([]);
      expect(COMPUTER_NAMES).not.toContain(face.name ?? "");
    }
  });

  test("[person:computers-never-shown-as-players] given every news story and every share card's words in content, when they are read, then none names a computer character", () => {
    const keys = Object.keys(text).filter((key) => key.startsWith("news.") || key.startsWith("share."));
    expect(keys.length).toBeGreaterThan(100);
    expect(keys.flatMap((key) => naming(text[key] ?? "").map((name) => `${key}: ${name}`))).toEqual([]);
  });
});
