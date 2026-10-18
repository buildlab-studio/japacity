// The marks the page's chips carry (prologue:printed-page-hands-over): a state is said by shape and colour together, and by its word.
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { say } from "../words/text";
import { Mark, type MarkState } from "./Mark";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

const STATES: readonly MarkState[] = ["done", "failed", "setback", "waiting"];
/** Tailwind's whole round, which the palette's own test counts as a pill (world:colours-are-role-tokens). */
const PILL = ["rounded", "full"].join("-");

describe("a mark", () => {
  test("[prologue:printed-page-hands-over] given each state, then its mark carries its word for a screen reader, and no two states share a glyph or a colour, none is a pill, and the setback's shape is turned on its point", () => {
    const seen = new Map<MarkState, { glyph: string; colour: string; turned: boolean }>();
    for (const state of STATES) {
      const { container, unmount } = render(<Mark state={state} />);
      const mark = container.querySelector<HTMLElement>("[data-mark]")!;
      expect(mark.getAttribute("role")).toBe("img");
      expect(mark.getAttribute("aria-label")).toBe(say(`ui.page.mark.${state}`));
      expect(mark.getAttribute("aria-label")).not.toBe(`ui.page.mark.${state}`);
      const glyph = mark.querySelector("svg")?.getAttribute("class") ?? "";
      const colour = mark.className.split(" ").filter((name) => name.startsWith("bg-")).join(" ");
      expect(mark.className.split(" ")).not.toContain(PILL);
      seen.set(state, { glyph, colour, turned: mark.className.includes("rotate-45") });
      unmount();
    }
    // Each glyph differs from every other: the shape alone tells the state, whatever the colours.
    expect(new Set([...seen.values()].map((one) => one.glyph)).size).toBe(STATES.length);
    expect(new Set([...seen.values()].map((one) => one.colour)).size).toBe(STATES.length);
    expect(seen.get("setback")?.turned).toBe(true);
    expect(seen.get("done")?.turned).toBe(false);
  });

  test("[text:show-then-tell] given a mark named for where it stands, then its shape and colour stay the state's and the screen reader hears the name it was given", () => {
    const { container } = render(<Mark state="setback" word="Warning sign" />);
    const mark = container.querySelector<HTMLElement>("[data-mark='setback']")!;
    expect(mark.getAttribute("aria-label")).toBe("Warning sign");
    expect(mark.getAttribute("title")).toBe("Warning sign");
    expect(mark.className).toContain("rotate-45");
    expect(mark.className).toContain("bg-signal");
  });
});
