// The marks the page's chips carry (prologue.md R-PROLOGUE-014): a state is said by shape and colour together, and by its word.
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { say } from "../words/text";
import { Mark, type MarkState } from "./Mark";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

const STATES: readonly MarkState[] = ["done", "failed", "setback", "waiting"];

describe("a mark", () => {
  test("[R-PROLOGUE-014] given each state, then its mark carries its word for a screen reader, and no two states share both glyph and colour, and the setback's shape is not round", () => {
    const seen = new Map<MarkState, { glyph: string; colour: string; round: boolean }>();
    for (const state of STATES) {
      const { container, unmount } = render(<Mark state={state} />);
      const mark = container.querySelector<HTMLElement>("[data-mark]")!;
      expect(mark.getAttribute("role")).toBe("img");
      expect(mark.getAttribute("aria-label")).toBe(say(`ui.page.mark.${state}`));
      expect(mark.getAttribute("aria-label")).not.toBe(`ui.page.mark.${state}`);
      const glyph = mark.querySelector("svg")?.getAttribute("class") ?? "";
      const colour = mark.className.split(" ").filter((name) => name.startsWith("bg-")).join(" ");
      seen.set(state, { glyph, colour, round: mark.className.includes("rounded-full") });
      unmount();
    }
    // Each glyph differs from every other: the shape alone tells the state, whatever the colours.
    expect(new Set([...seen.values()].map((one) => one.glyph)).size).toBe(STATES.length);
    expect(new Set([...seen.values()].map((one) => one.colour)).size).toBe(STATES.length);
    expect(seen.get("setback")?.round).toBe(false);
    expect(seen.get("done")?.round).toBe(true);
  });
});
