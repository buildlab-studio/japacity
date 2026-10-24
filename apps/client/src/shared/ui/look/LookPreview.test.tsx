// The preview page of the game's look (development only, `?look` at the boot): every primitive in both paints with sample
// words, to judge each one apart from the screens (decision 0025).
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { LookPreview } from "./LookPreview";
import { lookAsked } from "./preview";
// Registers Testing Library's cleanup for this file.
import "../../testing/render";

const PRIMITIVES = ["data-sticker", "data-sticker-chip", "data-press-button", "data-pill", "data-look-card", "data-face", "data-look-sheet"] as const;

describe("the look preview", () => {
  test("[world:colours-are-role-tokens] given the address, when the boot asks, then ?look opens the preview in a development build only", () => {
    expect(lookAsked("?look", true)).toBe(true);
    expect(lookAsked("?clock=night&look", true)).toBe(true);
    expect(lookAsked("", true)).toBe(false);
    expect(lookAsked("?look", false)).toBe(false);
  });

  test("[world:colours-are-role-tokens] given the preview, when it draws, then each paint has a panel and each panel shows every primitive", () => {
    render(<LookPreview />);
    const panels = [...document.querySelectorAll<HTMLElement>("[data-preview-paint]")];
    expect(panels.map((panel) => panel.getAttribute("data-paint"))).toEqual(["day", "night"]);
    for (const panel of panels) {
      for (const primitive of PRIMITIVES) expect({ paint: panel.dataset.paint, primitive, there: panel.querySelector(`[${primitive}]`) !== null }).toEqual({ paint: panel.dataset.paint, primitive, there: true });
    }
  });
});
