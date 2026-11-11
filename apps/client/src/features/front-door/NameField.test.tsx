// The door's name box says its state as every field does (world:field-says-its-state): the title, the help on what the name is
// for under it, the box with the dice, and directly under the box, over the pool's names, the one line that says what is wrong.
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { NameField, type NameProps } from "./YouScreen";

function field(over: Partial<NameProps>) {
  const props: NameProps = { name: "", suggestion: "Ada", typed: false, problem: null, tried: false, needed: false, suggestions: ["Ada", "Bisi", "Chioma"], onName: () => undefined, onReroll: () => undefined, onEnter: () => undefined, ...over };
  render(<NameField {...props} className="" />);
}

const box = () => screen.getByRole<HTMLInputElement>("textbox", { name: say("prologue.door.name.title") });
const before = (a: Element, b: Element): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

describe("the door's name box (world:field-says-its-state)", () => {
  test("[world:field-says-its-state] given Begin refused for the empty box, then the line that the story needs a name stands directly under the box and over the pool's names, in the out colour with its icon, the box marked and described by it", () => {
    field({ needed: true });
    const line = screen.getByRole("alert");
    expect(line.textContent).toBe(say("prologue.door.name.needed"));
    expect(line.className.split(" ")).toContain("text-out");
    expect(line.className.split(" ")).toContain("font-bold");
    expect(line.querySelector("svg")?.getAttribute("class")).toContain("lucide-circle-alert");
    expect(box().getAttribute("aria-invalid")).toBe("true");
    expect(box().getAttribute("aria-describedby")?.split(" ")).toContain(line.id);
    const row = box().parentElement!;
    expect(row.nextElementSibling).toBe(line);
    expect(before(line, document.querySelector("[data-door-suggested]")!)).toBe(true);
  });

  test("[world:field-says-its-state] given a name the box does not take, once tried, then its problem is the one line under the box, described by it; the help on what the name is for stands under the title in the quiet ink with no icon", () => {
    field({ name: "x", typed: true, tried: true, problem: "short", suggestions: [] });
    const line = screen.getByRole("alert");
    expect(line.className.split(" ")).toContain("text-out");
    expect(line.querySelector("svg")).not.toBeNull();
    expect(box().getAttribute("aria-describedby")?.split(" ")).toContain(line.id);
    const help = document.querySelector("[data-door-name-hint]")!;
    expect(help.className.split(" ")).toContain("text-text-2");
    expect(help.className).not.toMatch(/font-bold/);
    expect(help.querySelector("svg")).toBeNull();
    expect(before(document.querySelector("label[for='door-name']")!, help) && before(help, box()) && before(box(), line)).toBe(true);
  });
});
