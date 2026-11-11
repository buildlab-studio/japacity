// The line under a field (world:field-says-its-state): a problem in the out colour with its circle-and-mark icon, a good state
// with the tick in money in's colour, help in the quiet ink with no icon; and the stylesheet's out-coloured edge on a box marked
// invalid, with the yellow focus ring outside it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import "../testing/render";
import { FieldNote, type FieldState } from "./FieldNote";

const CSS = readFileSync(join(import.meta.dirname, "..", "..", "index.css"), "utf8");

function note(state: FieldState | null, words = "That name is taken."): HTMLElement {
  const { container } = render(
    <FieldNote state={state} id="note" data-probe="">
      {words}
    </FieldNote>,
  );
  return container.querySelector("[data-probe]") as HTMLElement;
}

const classes = (line: HTMLElement): string[] => line.className.split(/\s+/);

describe("the line under a field (world:field-says-its-state)", () => {
  test("[world:field-says-its-state] given a problem, then the line is in the out colour at the bold body weight with the circle-and-mark icon before its words", () => {
    const line = note("problem");
    expect(classes(line)).toContain("text-out");
    expect(classes(line)).toContain("font-bold");
    const icon = line.querySelector("svg");
    expect(icon?.getAttribute("class")).toContain("lucide-circle-alert");
    expect(icon?.getAttribute("aria-hidden")).toBe("true");
    expect(line.textContent).toBe("That name is taken.");
    expect(line.getAttribute("data-field-note")).toBe("problem");
    expect(line.id).toBe("note");
  });

  test("[world:field-says-its-state] given a good state, then the line is in money in's colour at the same weight with the tick before its words", () => {
    const line = note("good", "That name is free.");
    expect(classes(line)).toContain("text-in");
    expect(classes(line)).toContain("font-bold");
    expect(line.querySelector("svg")?.getAttribute("class")).toContain("lucide-check");
    expect(line.textContent).toBe("That name is free.");
  });

  test("[world:field-says-its-state] given help, then the line is in the quiet ink, never bold, with no icon and in no state colour", () => {
    const line = note("help", "Other players see this.");
    expect(classes(line)).toContain("text-text-2");
    expect(line.className).not.toMatch(/font-(bold|semibold|extrabold)/);
    expect(line.className).not.toMatch(/text-(out|in|bad|good|signal)\b/);
    expect(line.querySelector("svg")).toBeNull();
  });

  test("[world:field-says-its-state] given no state or no words, then the line stands empty: no icon, no colour, no room taken", () => {
    for (const line of [note(null), note("problem", "")]) {
      expect(line.querySelector("svg")).toBeNull();
      expect(line.className).not.toMatch(/text-(out|in)\b/);
      expect(line.getAttribute("data-field-note")).toBe("");
    }
    expect(note(null).textContent).toBe("That name is taken.");
  });

  test("[world:field-says-its-state] given the stylesheet, then a box marked invalid takes the out colour on its edge, and the yellow focus ring stands outside it", () => {
    const block = (selector: string): string => {
      const at = CSS.indexOf(selector);
      if (at < 0) throw new Error(`No block for ${selector} in index.css.`);
      return CSS.slice(CSS.indexOf("{", at) + 1, CSS.indexOf("}", at));
    };
    const marked = block(':is(input, select, textarea)[aria-invalid="true"]:not([data-field-inner]) {');
    expect(marked).toMatch(/border-color:\s*var\(--out\)/);
    expect(marked).toMatch(/box-shadow:\s*inset 0 0 0 1px var\(--out\)/);
    expect(block(':is(input, select, textarea)[aria-invalid="true"]:not([data-field-inner]):focus {')).toMatch(/box-shadow:\s*inset 0 0 0 1px var\(--out\), 0 0 0 2px var\(--action\)/);
  });
});
