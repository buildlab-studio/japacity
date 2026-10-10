// A fact chip on the page (prologue.md R-PROLOGUE-014): an icon, a word or two, a note, and the state's mark.
import { render } from "@testing-library/react";
import { GraduationCap } from "lucide-react";
import { describe, expect, test } from "vitest";

import { say } from "../words/text";
import { FactChip } from "./FactChip";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

describe("a fact chip", () => {
  test("[R-PROLOGUE-014] given a fact with a note and a state, then the chip shows the icon, the label, the note and the state's mark in that order; without a state it carries no mark", () => {
    const { container, rerender } = render(<FactChip icon={GraduationCap} label="University" note="Nursing" state="done" id="university" />);
    const chip = container.querySelector<HTMLElement>("[data-fact='university']")!;
    expect(chip.dataset["state"]).toBe("done");
    expect(chip.firstElementChild?.tagName.toLowerCase()).toBe("svg");
    expect(chip.textContent).toBe("UniversityNursing");
    expect(chip.querySelector("[data-mark='done']")?.getAttribute("aria-label")).toBe(say("ui.page.mark.done"));
    expect(chip.lastElementChild?.getAttribute("data-mark")).toBe("done");
    rerender(<FactChip icon={GraduationCap} label="University" id="university" />);
    expect(container.querySelector("[data-mark]")).toBeNull();
    expect(container.querySelector("[data-fact='university']")?.textContent).toBe("University");
  });

  test("[R-PROLOGUE-014] [R-TEXT-008] given a label too long for half the page, when the chip shows, then its words wrap and are never cut", () => {
    const { container } = render(<FactChip icon={GraduationCap} label="Shop counter" note="4 years" state="done" id="shop" />);
    for (const part of container.querySelectorAll<HTMLElement>("[data-fact-label], [data-fact-note]")) expect(part.className).not.toMatch(/\btruncate\b/);
    expect(container.querySelector("[data-fact-label]")?.textContent).toBe("Shop counter");
  });
});
