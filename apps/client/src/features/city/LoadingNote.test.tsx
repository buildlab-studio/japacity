import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { LoadingNote } from "./LoadingNote";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

describe("a place loading", () => {
  test("[city:places-load-on-entry] given a place loading, when its note shows, then it names the place and shows the progress as a bar that fills, never as a figure in per cent", () => {
    render(<LoadingNote place="Ojuelegba" percent={42} />);
    const note = document.querySelector<HTMLElement>("[data-loading]");
    expect(note?.textContent).toContain("Ojuelegba");
    expect(note?.textContent).not.toMatch(/%|\d/);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
  });

  test("[city:places-load-on-entry] [engine:browser-authority-for-dev-only] given a place loading, when its note shows, then its bar is the one every wait takes, filled to the known share, with the note's words unchanged", () => {
    render(<LoadingNote place="Ojuelegba" percent={60} small />);
    const bar = screen.getByRole("progressbar", { name: "Getting Ojuelegba ready" });
    expect(bar.classList.contains("loader")).toBe(true);
    expect(bar.dataset["loader"]).toBe("share");
    expect(bar.querySelector("span")?.style.transform).toBe("scaleX(0.6)");
    expect(document.querySelector("[data-loading]")?.textContent).toBe("Getting Ojuelegba ready");
  });
});
