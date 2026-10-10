// A gain or a cost as a tag (prologue.md R-PROLOGUE-014): the arrow says the way as well as the colour.
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { say } from "../words/text";
import { ToneTag } from "./ToneTag";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

describe("a tone tag", () => {
  test("[R-PROLOGUE-014] given an up, a down and a plain tag, then up carries an arrow named up in green, down an arrow named down in red, and plain no arrow", () => {
    const { container } = render(
      <>
        <ToneTag tone="up">Parents schooled</ToneTag>
        <ToneTag tone="down">Small town</ToneTag>
        <ToneTag tone="plain">Four siblings</ToneTag>
      </>,
    );
    const [up, down, plain] = [...container.querySelectorAll<HTMLElement>("[data-tone]")];
    expect(up?.textContent).toBe("Parents schooled");
    expect(up?.querySelector("svg")?.getAttribute("aria-label")).toBe(say("ui.page.tone.up"));
    expect(up?.querySelector("svg")?.getAttribute("class")).toContain("text-in");
    expect(down?.querySelector("svg")?.getAttribute("aria-label")).toBe(say("ui.page.tone.down"));
    expect(down?.querySelector("svg")?.getAttribute("class")).toContain("text-out");
    expect(plain?.querySelector("svg")).toBeNull();
    expect(plain?.textContent).toBe("Four siblings");
  });
});
