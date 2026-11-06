// The small line over a sheet's title, its kicker (world:one-action-one-sheet), starts with a capital: a place's name that
// reads lower-case inside a sentence ("at the clinic") opens the kicker raised ("The clinic"), on the ask's card, its slip
// and the world's sheet alike. Every place content names in lower case is read.
import { content, text } from "@japacity/content";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import type { Ask } from "./contract";
import { AskSheet } from "./AskSheet";
import { WorldSheet } from "./WorldSheet";

afterEach(cleanup);

/** Every place whose name content writes in lower case, as a sentence reads it. */
const LOWER = Object.keys(content.place)
  .map((id) => text[`${id}.name`] ?? "")
  .filter((name) => /^[a-z]/.test(name));

function ask(form: Ask["form"], who: string): Ask {
  return { form, icon: "hand", who, title: "Apply", line: "A line.", cost: null, button: "Apply", act: () => undefined, dismiss: () => undefined };
}

function kickerOf(selector: string): string {
  const head = document.querySelector(selector);
  if (head === null) throw new Error(`No ${selector}.`);
  return head.textContent ?? "";
}

describe("a sheet's kicker", () => {
  test("[world:one-action-one-sheet] given the places content names in lower case, when they are read, then the clinic is among them", () => {
    expect(LOWER).toContain("the clinic");
  });

  test.each(LOWER)("[world:one-action-one-sheet] given %s as the kicker of an ask's card, a slip and the world's sheet, when each renders, then the kicker starts with a capital", (name) => {
    const raised = name.charAt(0).toUpperCase() + name.slice(1);
    render(<AskSheet ask={ask("card", name)} formatMoney={(amount) => String(amount)} />);
    expect(kickerOf("[data-ask-kicker]")).toBe(raised);
    cleanup();
    render(<AskSheet ask={ask("slip", name)} formatMoney={(amount) => String(amount)} />);
    expect(kickerOf("[data-ask-kicker]")).toBe(raised);
    cleanup();
    render(
      <WorldSheet open onClose={() => undefined} label={name} title="The board">
        <p />
      </WorldSheet>,
    );
    expect(kickerOf("[data-sheet-kicker]")).toBe(raised);
  });
});
