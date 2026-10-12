// The lively layer's preview page (development only, `?lively` at the boot): every primitive in both paints with sample
// words, for the maintainer and the maintainer to look at before the screens are dressed (decision 0038).
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { LivelyPreview } from "./LivelyPreview";
import { livelyAsked } from "./preview";
// Registers Testing Library's cleanup for this file.
import "../../testing/render";

const PRIMITIVES = ["data-sticker", "data-sticker-chip", "data-press-button", "data-pill", "data-lively-card", "data-face", "data-lively-sheet"] as const;

describe("the lively preview", () => {
  test("[R-WORLD-021] given the address, when the boot asks, then ?lively opens the preview in a development build only", () => {
    expect(livelyAsked("?lively", true)).toBe(true);
    expect(livelyAsked("?clock=night&lively", true)).toBe(true);
    expect(livelyAsked("", true)).toBe(false);
    expect(livelyAsked("?lively", false)).toBe(false);
  });

  test("[R-WORLD-021] given the preview, when it draws, then each paint has a panel and each panel shows every primitive", () => {
    render(<LivelyPreview />);
    const panels = [...document.querySelectorAll<HTMLElement>("[data-preview-paint]")];
    expect(panels.map((panel) => panel.getAttribute("data-paint"))).toEqual(["day", "night"]);
    for (const panel of panels) {
      for (const primitive of PRIMITIVES) expect({ paint: panel.dataset.paint, primitive, there: panel.querySelector(`[${primitive}]`) !== null }).toEqual({ paint: panel.dataset.paint, primitive, there: true });
    }
  });
});
